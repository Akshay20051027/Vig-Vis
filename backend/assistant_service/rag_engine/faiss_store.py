"""FAISS index wrapper for storing and searching embeddings."""

from pathlib import Path
from typing import List, Dict, Any, Tuple
import json

import faiss
import numpy as np


class FaissStore:
    def __init__(self, dimension: int) -> None:
        self.dimension = dimension
        self.index = faiss.IndexFlatL2(dimension)
        self.metadata: List[Dict[str, Any]] = []

    def add(self, embeddings: np.ndarray, metadata: List[Dict[str, Any]]) -> None:
        if embeddings.ndim != 2 or embeddings.shape[1] != self.dimension:
            raise ValueError("Embeddings shape mismatch.")
        if embeddings.shape[0] != len(metadata):
            raise ValueError("Embeddings and metadata length mismatch.")

        self.index.add(embeddings.astype(np.float32))
        self.metadata.extend(metadata)

    def search(self, query_embedding: np.ndarray, top_k: int = 3) -> List[Tuple[float, Dict[str, Any]]]:
        if self.index.ntotal == 0:
            return []
        if query_embedding.ndim == 1:
            query_embedding = query_embedding.reshape(1, -1)
        if query_embedding.shape[1] != self.dimension:
            raise ValueError("Query embedding dimension mismatch.")

        distances, indices = self.index.search(query_embedding.astype(np.float32), top_k)
        results: List[Tuple[float, Dict[str, Any]]] = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx == -1 or idx >= len(self.metadata):
                continue
            results.append((float(dist), self.metadata[idx]))
        return results

    def save(self, index_path: str | Path, metadata_path: str | Path) -> None:
        index_file = Path(index_path)
        meta_file = Path(metadata_path)
        faiss.write_index(self.index, str(index_file))
        with meta_file.open("w", encoding="utf-8") as f:
            json.dump(self.metadata, f, indent=2)

    def load(self, index_path: str | Path, metadata_path: str | Path) -> None:
        index_file = Path(index_path)
        meta_file = Path(metadata_path)
        if not index_file.exists() or not meta_file.exists():
            raise FileNotFoundError("Index or metadata file not found.")
        self.index = faiss.read_index(str(index_file))
        with meta_file.open("r", encoding="utf-8") as f:
            self.metadata = json.load(f)
