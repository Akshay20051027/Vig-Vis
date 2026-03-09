"""Retriever that combines embedding model and FAISS store."""

from typing import List, Dict, Any, Tuple

import numpy as np

from .embeddings import EmbeddingModel
from .faiss_store import FaissStore


class Retriever:
    def __init__(self, embedder: EmbeddingModel, store: FaissStore) -> None:
        self.embedder = embedder
        self.store = store

    def retrieve(self, query: str, top_k: int = 3) -> List[Tuple[float, Dict[str, Any]]]:
        query_emb = self.embedder.encode_query(query)
        results = self.store.search(query_emb, top_k=top_k)
        return results
