"""Embedding utilities using SentenceTransformers."""

from typing import List
import numpy as np
from sentence_transformers import SentenceTransformer


class EmbeddingModel:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2") -> None:
        self.model = SentenceTransformer(model_name)
        self.dimension = self.model.get_sentence_embedding_dimension()

    def encode_texts(self, texts: List[str]) -> np.ndarray:
        """Encode a list of texts into a 2D numpy array of embeddings."""
        embeddings = self.model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
        return embeddings

    def encode_query(self, text: str) -> np.ndarray:
        """Encode a single query string into an embedding."""
        return self.encode_texts([text])
