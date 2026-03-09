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
            data: Dict[str, Any] = json.load(f)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON format in {json_path}: {exc}") from exc

    has_topics = isinstance(data.get("topics"), list)
    has_documents = isinstance(data.get("documents"), list)

    if not (has_topics or has_documents):
        raise ValueError("JSON must contain either a 'topics' list or a 'documents' list.")

    return data
