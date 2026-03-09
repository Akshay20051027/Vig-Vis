"""Parse structured knowledge JSON into text chunks."""

from dataclasses import dataclass
from typing import List, Dict, Any


@dataclass
class KnowledgeChunk:
    subject: str | None
    category: str | None
    doc_id: str | None
    title: str
    definition: str | None
    explanation: str | None
    examples: List[str]

    def to_text(self) -> str:
        """Combine fields into a single text block for embedding."""
        parts: List[str] = [f"Topic: {self.title}"]
        if self.category:
            parts.append(f"Category: {self.category}")
        if self.doc_id:
            parts.append(f"ID: {self.doc_id}")
        if self.definition:
            parts.append(f"Definition: {self.definition}")
        if self.explanation:
            parts.append(f"Explanation: {self.explanation}")
        if self.examples:
            examples_str = ", ".join(self.examples)
            parts.append(f"Examples: {examples_str}")
        if self.subject:
            parts.append(f"Subject: {self.subject}")
        return "\n".join(parts)


def parse_topics(data: Dict[str, Any]) -> List[KnowledgeChunk]:
    """Convert JSON dict into a list of KnowledgeChunk objects."""
    subject_raw = data.get("subject") or data.get("university_name")
    subject = subject_raw if isinstance(subject_raw, str) else None

    chunks: List[KnowledgeChunk] = []

    topics = data.get("topics") or []
    if isinstance(topics, list):
        for topic in topics:
            title = topic.get("title") or "Unknown Topic"
            definition = topic.get("definition") if isinstance(topic.get("definition"), str) else None
            explanation = topic.get("explanation") if isinstance(topic.get("explanation"), str) else None
            examples_raw = topic.get("examples", [])
            examples = [ex for ex in examples_raw if isinstance(ex, str)]

            chunks.append(
                KnowledgeChunk(
                    subject=subject,
                    category=topic.get("category") if isinstance(topic.get("category"), str) else None,
                    doc_id=topic.get("id") if isinstance(topic.get("id"), str) else None,
                    title=title,
                    definition=definition,
                    explanation=explanation,
                    examples=examples,
                )
            )

    documents = data.get("documents") or []
    if isinstance(documents, list):
        for doc in documents:
            title = doc.get("title") or "Unknown Document"
            content = doc.get("content") if isinstance(doc.get("content"), str) else None
            definition = _first_sentence(content) if content else None
            explanation = content

            chunks.append(
                KnowledgeChunk(
                    subject=subject,
                    category=doc.get("category") if isinstance(doc.get("category"), str) else None,
                    doc_id=doc.get("id") if isinstance(doc.get("id"), str) else None,
                    title=title,
                    definition=definition,
                    explanation=explanation,
                    examples=[],
                )
            )

    return chunks


def _first_sentence(text: str) -> str:
    """Return a coarse first-sentence summary for use as a definition."""
    if not text:
        return ""
    for sep in [". ", "? ", "! "]:
        if sep in text:
            return text.split(sep)[0].strip()
    return text.strip()
