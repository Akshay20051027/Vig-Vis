"""Utilities for loading and validating JSON knowledge files."""

from pathlib import Path
import json
from typing import Any, Dict


def load_json_file(path: str | Path) -> Dict[str, Any]:
    """Load a JSON file from disk and return its content.

    Raises:
        FileNotFoundError: if the file does not exist.
        ValueError: if the JSON is invalid or the expected keys are missing.
    """

    json_path = Path(path)
    if not json_path.exists():
        raise FileNotFoundError(f"JSON file not found: {json_path}")

    try:
        with json_path.open("r", encoding="utf-8") as f:
            raw_data = json.load(f)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON format in {json_path}: {exc}") from exc

    # Handle different JSON formats
    if isinstance(raw_data, list):
        # Q&A format: convert to documents format
        data = {
            "university_name": "Knowledge Base",
            "documents": [
                {
                    "id": str(item.get("id", i)),
                    "category": item.get("category", "General"),
                    "title": item.get("question", item.get("title", f"Document {i}")),
                    "content": item.get("answer", item.get("content", ""))
                }
                for i, item in enumerate(raw_data, 1)
            ]
        }
        return data
    
    # Dictionary format
    data: Dict[str, Any] = raw_data
    has_topics = isinstance(data.get("topics"), list)
    has_documents = isinstance(data.get("documents"), list)

    if not (has_topics or has_documents):
        raise ValueError("JSON must contain either a 'topics' list, a 'documents' list, or be a Q&A array.")

    return data
