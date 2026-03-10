"""High-level orchestration for ingestion, retrieval, and answer generation."""

from typing import List, Dict, Any

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

    def ask(self, question: str) -> str:
        results = self.retriever.retrieve(question, top_k=self.top_k)
        only_meta = [meta for _, meta in results]
        answer = generate_answer(question, only_meta)
        return answer

    def save(self, index_path: str, metadata_path: str) -> None:
        self.store.save(index_path, metadata_path)

    def load(self, index_path: str, metadata_path: str) -> None:
        self.store.load(index_path, metadata_path)
