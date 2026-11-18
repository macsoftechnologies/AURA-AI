from fastembed import TextEmbedding
from typing import List

# Exactly supported 384-dim multilingual ONNX model
_embed_model = TextEmbedding(
    model_name="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
    threads=2
)

def embed_documents(texts: List[str]) -> List[List[float]]:
    """Generates 384-dimensional dense vectors for document chunks."""
    embeddings = list(_embed_model.embed(texts))
    return [e.tolist() for e in embeddings]

def embed_query(text: str) -> List[float]:
    """Generates 384-dimensional dense vector for a user query."""
    embeddings = list(_embed_model.embed([text]))
    return embeddings[0].tolist()