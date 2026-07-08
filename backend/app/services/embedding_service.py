"""
Phase 2 — Semantic Embedding Service
BGE Large (1024-dim) for chunk indexing and query embedding
"""
from sentence_transformers import SentenceTransformer

_model = None

_MODEL_NAME = "BAAI/bge-large-en-v1.5"


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        print(f"Loading embedding model {_MODEL_NAME}...")
        _model = SentenceTransformer(_MODEL_NAME)
        print("Embedding model loaded.")
    return _model


# BGE Large requires this prefix on queries (not on document chunks) for best retrieval
_QUERY_PREFIX = "Represent this sentence for searching relevant passages: "


def embed_query(text: str) -> list[float]:
    """Embed a search query — uses BGE query prefix for better retrieval accuracy."""
    model = _get_model()
    return model.encode(_QUERY_PREFIX + text, normalize_embeddings=True).tolist()


def embed_text(text: str) -> list[float]:
    """Embed a document chunk — no prefix needed."""
    model = _get_model()
    return model.encode(text, normalize_embeddings=True).tolist()


def embed_batch(texts: list[str]) -> list[list[float]]:
    """Embed document chunks in batch — no prefix needed."""
    model = _get_model()
    return model.encode(texts, normalize_embeddings=True, batch_size=64).tolist()
