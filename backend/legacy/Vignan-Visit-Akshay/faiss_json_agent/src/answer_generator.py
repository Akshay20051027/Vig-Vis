"""Generate exam-style answers from retrieved knowledge."""

from typing import Dict, Any, List


def format_context_snippet(metadata: Dict[str, Any]) -> str:
    parts: List[str] = []
    if title := metadata.get("title"):
        parts.append(f"Topic: {title}")
    if category := metadata.get("category"):
        parts.append(f"Category: {category}")
    if doc_id := metadata.get("doc_id"):
        parts.append(f"ID: {doc_id}")
    if definition := metadata.get("definition"):
        parts.append(f"Definition: {definition}")
    if explanation := metadata.get("explanation"):
        parts.append(f"Explanation: {explanation}")
    examples = metadata.get("examples") or []
    if examples:
        parts.append(f"Examples: {', '.join(examples)}")
    return "\n".join(parts)


def generate_answer(question: str, retrieved: List[Dict[str, Any]]) -> str:
    if not retrieved:
        return "No relevant information found."

    primary = retrieved[0]
    
    # Build concise answer
    answer_parts = []
    
    # Combine definition and explanation
    definition = primary.get("definition", "").strip()
    explanation = primary.get("explanation", "").strip()
    
    if explanation and explanation != definition:
        answer_parts.append(explanation)
    elif definition:
        answer_parts.append(definition)
    
    # Add first example only if it adds value
    examples = primary.get("examples") or []
    if examples and examples[0].strip():
        answer_parts.append(f"Example: {examples[0]}")
    
    # Add category reference if available
    if primary.get("category"):
        answer_parts.append(f"({primary.get('category')})")
    
    return " ".join(answer_parts) if answer_parts else "Information not available."
