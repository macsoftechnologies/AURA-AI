from fastembed import TextEmbedding
from typing import List

# Exactly supported 384-dim multilingual ONNX model
_embed_model = TextEmbedding(
    model_name="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
    threads=2
)

def embed_documents(texts: List[str], batch_size: int = 32) -> List[List[float]]:
    """Generates 384-dimensional dense vectors in memory-safe batches of 32."""
    all_embeddings = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        batch_embeddings = list(_embed_model.embed(batch))
        all_embeddings.extend([e.tolist() for e in batch_embeddings])
    return all_embeddings

def embed_query(text: str) -> List[float]:
    """Generates 384-dimensional dense vector for a user query."""
    embeddings = list(_embed_model.embed([text]))
    return embeddings[0].tolist()