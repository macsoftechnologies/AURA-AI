from flashrank import Ranker, RerankRequest

# Lightweight cross-encoder model (~40 MB RAM)
_ranker = Ranker(model_name="ms-marco-TinyBERT-L-2-v2", cache_dir="/tmp/flashrank")


def rerank_chunks(query: str, chunks: list[dict], top_n: int = 4) -> list[dict]:
    """Re-scores candidate chunks down to top_n in ~25ms on CPU."""
    if not chunks:
        return []

    passages = [{"id": i, "text": c["chunk_text"], "meta": c} for i, c in enumerate(chunks)]
    rerank_req = RerankRequest(query=query, passages=passages)
    results = _ranker.rerank(rerank_req)

    top_results = []
    for r in results[:top_n]:
        item = r["meta"]
        item["rerank_score"] = float(r["score"])
        top_results.append(item)
    return top_results