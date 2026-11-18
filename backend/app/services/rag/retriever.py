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


async def hybrid_search_and_rerank(
    db,
    user_id: int,
    query: str,
    doc_id: int | None = None,
    candidate_pool: int = 15,
    top_n: int = 4,
) -> list[dict]:
    query_vector = embed_query(query)
    doc_filter = "AND document_id = :doc_id" if doc_id else ""

    # Fetch candidate chunks for this user/doc
    sql = f"""
    SELECT id, chunk_text, page_number, document_id, embedding
    FROM document_chunks
    WHERE user_id = :user_id {doc_filter}
    LIMIT 200;
    """

    params = {"user_id": user_id}
    if doc_id:
        params["doc_id"] = doc_id

    rows = db.execute(text(sql), params).fetchall()
    if not rows:
        return []

    # Score candidates using cosine similarity
    scored_candidates = []
    for r in rows:
        chunk_id, chunk_text, page_number, document_id, embedding = r
        sim = cosine_similarity(query_vector, embedding) if embedding else 0.0
        scored_candidates.append({
            "id": chunk_id,
            "chunk_text": chunk_text,
            "page_number": page_number,
            "document_id": document_id,
            "semantic_score": sim,
        })

    # Sort by semantic similarity and take candidate pool
    scored_candidates.sort(key=lambda x: x["semantic_score"], reverse=True)
    candidates = scored_candidates[:candidate_pool]

    # Re-rank candidates down to the top_n most precise snippets using FlashRank
    return rerank_chunks(query, candidates, top_n=top_n)