"""High-level orchestration for ingestion, retrieval, and answer generation."""

from typing import List, Dict, Any, Tuple

import re

import numpy as np

from .json_loader import load_json_file
from .knowledge_parser import parse_topics, KnowledgeChunk
from .embeddings import EmbeddingModel
from .faiss_store import FaissStore
from .retriever import Retriever
from .answer_generator import generate_answer


class QueryEngine:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2", top_k: int = 3) -> None:
        self.embedder = EmbeddingModel(model_name)
        self.store = FaissStore(dimension=self.embedder.dimension)
        self.retriever = Retriever(self.embedder, self.store)
        self.top_k = top_k

    def ingest_json(self, json_path: str) -> List[KnowledgeChunk]:
        data = load_json_file(json_path)
        chunks = parse_topics(data)
        return chunks

    def index_chunks(self, chunks: List[KnowledgeChunk]) -> None:
        texts = [chunk.to_text() for chunk in chunks]
        embeddings = self.embedder.encode_texts(texts)
        metadata: List[Dict[str, Any]] = []
        for chunk, text in zip(chunks, texts):
            metadata.append(
                {
                    "subject": chunk.subject,
                    "category": chunk.category,
                    "doc_id": chunk.doc_id,
                    "title": chunk.title,
                    "definition": chunk.definition,
                    "explanation": chunk.explanation,
                    "examples": chunk.examples,
                    "text": text,
                }
            )
        self.store.add(embeddings.astype(np.float32), metadata)

    def retrieve(self, question: str, top_k: int | None = None) -> List[Tuple[float, Dict[str, Any]]]:
        """Return raw retrieval results as (distance, metadata)."""
        results = self.retriever.retrieve(question, top_k=top_k or self.top_k)
        return results

    @staticmethod
    def _keyword_overlap_score(question: str, candidate_text: str) -> int:
        """Very small heuristic to prefer chunks that mention key query terms."""
        q = (question or "").lower()
        t = (candidate_text or "").lower()

        # Keep it simple: only count >=3-char alphanum tokens to avoid noise.
        tokens = set(re.findall(r"[a-z0-9]{3,}", q))
        if not tokens:
            return 0

        return sum(1 for tok in tokens if tok in t)

    def ask(self, question: str) -> str:
        results = self.retrieve(question, top_k=self.top_k)

        # Re-rank by keyword overlap, then by distance (lower is better).
        if results:
            ranked = sorted(
                results,
                key=lambda pair: (
                    -self._keyword_overlap_score(question, (pair[1] or {}).get("text", "")),
                    pair[0],
                ),
            )
        else:
            ranked = []

        only_meta = [meta for _, meta in ranked]
        answer = generate_answer(question, only_meta)
        return answer

    def save(self, index_path: str, metadata_path: str) -> None:
        self.store.save(index_path, metadata_path)

    def load(self, index_path: str, metadata_path: str) -> None:
        self.store.load(index_path, metadata_path)
