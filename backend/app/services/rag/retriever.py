import asyncio
import numpy as np
from sqlalchemy import text
from app.services.rag.embeddings import embed_query
from app.services.rag.reranker import rerank_chunks


def cosine_similarity(v1: list[float], v2: list[float]) -> float:
    a = np.array(v1, dtype=np.float32)
    b = np.array(v2, dtype=np.float32)
    norm = np.linalg.norm(a) * np.linalg.norm(b)
    if norm == 0:
        return 0.0
    return float(np.dot(a, b) / norm)


def _score_and_rank_candidates(query_vector: list[float], rows: list) -> list[dict]:
    """Helper running inside worker thread to prevent event loop blocking."""
    scored = []
    for r in rows:
        chunk_id, chunk_text, page_number, document_id, filename, embedding = r
        sim = cosine_similarity(query_vector, embedding) if embedding else 0.0
        scored.append({
            "id": chunk_id,
            "chunk_text": chunk_text,
            "page_number": page_number,
            "document_id": document_id,
            "filename": filename,
            "semantic_score": sim,
        })
    scored.sort(key=lambda x: x["semantic_score"], reverse=True)
    return scored


async def hybrid_search_and_rerank(
    db,
    user_id: int,
    query: str,
    doc_ids: list[int] | None = None,
    candidate_pool: int = 20,
    top_n: int = 4,
) -> list[dict]:
    # 1. Non-blocking ONNX embedding in thread pool
    query_vector = await asyncio.to_thread(embed_query, query)
    
    # Filter across 1 or 2 documents if provided
    doc_filter = ""
    params = {"user_id": user_id}

    if doc_ids and len(doc_ids) > 0:
        doc_filter = "AND dc.document_id = ANY(:doc_ids)"
        params["doc_ids"] = doc_ids

    # 2. Query candidates from PostgreSQL joined with user_documents to get filename
    sql = f"""
    SELECT dc.id, dc.chunk_text, dc.page_number, dc.document_id, ud.filename, dc.embedding
    FROM document_chunks dc
    JOIN user_documents ud ON dc.document_id = ud.id
    WHERE dc.user_id = :user_id {doc_filter}
    LIMIT 300;
    """

    rows = db.execute(text(sql), params).fetchall()
    if not rows:
        return []

    # 3. Non-blocking vector scoring in thread pool
    scored_candidates = await asyncio.to_thread(_score_and_rank_candidates, query_vector, rows)
    candidates = scored_candidates[:candidate_pool]

    # 4. Non-blocking FlashRank reranker in thread pool
    return await asyncio.to_thread(rerank_chunks, query, candidates, top_n)