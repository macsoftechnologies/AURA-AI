from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel

from app.database.connection import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.rag import UserDocument, DocumentChunk
from app.services.rag.extractors import (
    extract_text_from_pdf, extract_text_from_docx, extract_text_from_url
)
from app.services.rag.chunker import chunk_extracted_pages
from app.services.rag.embeddings import embed_documents
from app.services.rag.retriever import hybrid_search_and_rerank
from app.services.rag.cache import get_rag_cache, set_rag_cache
from app.services.llm.sarvam_service import generate_response
from app.services.tts.sarvam_tts_service import generate_speech

router = APIRouter(prefix="/api/rag", tags=["Document RAG"])


class URLIngestRequest(BaseModel):
    url: str


class RAGQueryRequest(BaseModel):
    query: str
    document_id: int | None = None
    language_code: str = "hi-IN"
    with_voice: bool = True


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contents = await file.read()
    filename = file.filename.lower()

    if filename.endswith(".pdf"):
        pages = extract_text_from_pdf(contents)
        doc_type = "pdf"
    elif filename.endswith(".docx"):
        pages = extract_text_from_docx(contents)
        doc_type = "docx"
    else:
        raise HTTPException(status_code=400, detail="Only .pdf and .docx files are supported.")

    chunks = chunk_extracted_pages(pages)
    if not chunks:
        raise HTTPException(status_code=400, detail="Could not extract text from document.")

    # 1. Save Document Record
    user_doc = UserDocument(
        user_id=current_user.id,
        filename=file.filename,
        doc_type=doc_type,
        file_size_bytes=len(contents),
        total_pages=len(pages),
        chunk_count=len(chunks),
    )
    db.add(user_doc)
    db.commit()
    db.refresh(user_doc)

    # 2. FastEmbed Multilingual ONNX Embeddings
    texts = [c["chunk_text"] for c in chunks]
    vectors = embed_documents(texts)

    # 3. Insert Chunks with tsvector
    for c, vec in zip(chunks, vectors):
        chunk_obj = DocumentChunk(
            document_id=user_doc.id,
            user_id=current_user.id,
            page_number=c["page_number"],
            chunk_index=c["chunk_index"],
            chunk_text=c["chunk_text"],
            embedding=vec,
        )
        db.add(chunk_obj)
    db.commit()

    # Generate full-text search vector
    db.execute(text("""
        UPDATE document_chunks 
        SET search_vector = to_tsvector('simple', chunk_text)
        WHERE document_id = :doc_id
    """), {"doc_id": user_doc.id})
    db.commit()

    return {"status": "success", "document_id": user_doc.id, "chunks_indexed": len(chunks)}


@router.post("/url")
async def ingest_url(
    req: URLIngestRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        pages = extract_text_from_url(req.url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    chunks = chunk_extracted_pages(pages)
    if not chunks:
        raise HTTPException(status_code=400, detail="No readable content found on URL.")

    user_doc = UserDocument(
        user_id=current_user.id,
        filename=req.url[:120],
        doc_type="url",
        source_url=req.url,
        total_pages=1,
        chunk_count=len(chunks),
    )
    db.add(user_doc)
    db.commit()
    db.refresh(user_doc)

    texts = [c["chunk_text"] for c in chunks]
    vectors = embed_documents(texts)

    for c, vec in zip(chunks, vectors):
        chunk_obj = DocumentChunk(
            document_id=user_doc.id,
            user_id=current_user.id,
            page_number=c["page_number"],
            chunk_index=c["chunk_index"],
            chunk_text=c["chunk_text"],
            embedding=vec,
        )
        db.add(chunk_obj)
    db.commit()

    db.execute(text("""
        UPDATE document_chunks 
        SET search_vector = to_tsvector('simple', chunk_text)
        WHERE document_id = :doc_id
    """), {"doc_id": user_doc.id})
    db.commit()

    return {"status": "success", "document_id": user_doc.id, "chunks_indexed": len(chunks)}


@router.get("/documents")
async def list_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    docs = db.query(UserDocument).filter(UserDocument.user_id == current_user.id).order_by(UserDocument.id.desc()).all()
    return [
        {
            "id": d.id,
            "filename": d.filename,
            "doc_type": d.doc_type,
            "total_pages": d.total_pages,
            "chunk_count": d.chunk_count,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in docs
    ]


@router.delete("/documents/{doc_id}")
async def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(UserDocument).filter(UserDocument.id == doc_id, UserDocument.user_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    db.delete(doc)
    db.commit()
    return {"status": "deleted", "document_id": doc_id}


@router.post("/query")
async def query_rag(
    req: RAGQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 1. Check Redis Cache (<50ms)
    cached = get_rag_cache(current_user.id, req.query, req.language_code)
    if cached:
        return cached

    # 2. Hybrid Retrieval + FlashRank Rerank
    top_chunks = await hybrid_search_and_rerank(
        db=db,
        user_id=current_user.id,
        query=req.query,
        doc_id=req.document_id,
        top_n=4,
    )

    if not top_chunks:
        return {
            "answer": "No relevant information found in your documents.",
            "citations": [],
            "audio": None,
        }

    context_str = "\n\n".join(
        [f"[Page {c['page_number']}]: {c['chunk_text']}" for c in top_chunks]
    )

    grounded_prompt = f"""Use the following document context to answer the user's question accurately.
If the answer cannot be found in the context, clearly state that.
Mention the page number where the information was found.
Keep the answer concise (2-4 sentences) so it sounds natural when spoken aloud.

DOCUMENT CONTEXT:
{context_str}

USER QUESTION: {req.query}"""

    # 3. Grounded Answer using Sarvam LLM
    answer = await generate_response(
        message=grounded_prompt,
        language=req.language_code,
    )

    # 4. Voice Synthesis via Sarvam Bulbul
    audio_base64 = None
    if req.with_voice:
        try:
            audio_base64 = await generate_speech(
                text=answer,
                language_code=req.language_code,
            )
        except Exception:
            pass

    response_payload = {
        "answer": answer,
        "citations": [
            {"page": c["page_number"], "snippet": c["chunk_text"][:140] + "..."}
            for c in top_chunks
        ],
        "audio": audio_base64,
    }

    # 5. Cache result
    set_rag_cache(current_user.id, req.query, req.language_code, response_payload)

    return response_payload