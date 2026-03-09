# FAISS JSON RAG Agent

A minimal Retrieval-Augmented Generation (RAG) pipeline that ingests structured JSON knowledge, builds a FAISS vector index with `all-MiniLM-L6-v2` sentence embeddings, retrieves relevant chunks for a user question, and produces exam-style answers.

## Project layout

```
faiss_json_agent/
├── data/
│   ├── knowledge.json                    # Small demo knowledge base
│   └── vignan_university_dataset.json    # Full Vignan University dataset (default)
├── src/
│   ├── json_loader.py          # Load and validate JSON
│   ├── knowledge_parser.py     # Convert JSON into chunk objects
│   ├── embeddings.py           # SentenceTransformer wrapper
│   ├── faiss_store.py          # FAISS index wrapper
│   ├── retriever.py            # Query-to-FAISS retrieval
│   ├── answer_generator.py     # Exam-style answer formatting
│   └── query_engine.py         # Orchestrates ingestion + Q&A
├── main.py                     # CLI entrypoint
└── requirements.txt
```

## Installation

Use Python 3.9+.

```bash
python -m venv .venv
.venv/Scripts/activate  # Windows PowerShell
pip install -r requirements.txt
```

## Usage

```bash
python main.py --json-path data/vignan_university_dataset.json --top-k 3
```

Then type a question (e.g., `Tell me about the Vignan University campus`). Type `exit` to quit.

### Voice + chat assistant (mic + TTS, RAG-only)

```bash
python -m src.voice_assistant
```

- Answers only from the FAISS RAG over Vignan data (no extra utilities).
- Default is text input; set `use_voice=True` inside `build_voice_assistant` to listen via microphone.
- Time-aware greeting offers a lunch reminder in the afternoon (boys hostel lunch).

## How it works

1. Load JSON via `json_loader` and validate the `topics` list.
2. Parse topics into `KnowledgeChunk` objects with `knowledge_parser`.
3. Convert chunk text to embeddings with `EmbeddingModel` (SentenceTransformers).
4. Store embeddings and metadata in a FAISS `IndexFlatL2` via `FaissStore`.
5. For a question, embed it, retrieve top-k matches, and format an exam-style answer.

## Persistence (optional)

`FaissStore.save(index_path, metadata_path)` and `FaissStore.load(...)` let you persist and reload the index and metadata if desired.

## Extending

- Swap in a different SentenceTransformer by passing `--model`.
- Add chunking/overlap or richer metadata in `KnowledgeChunk.to_text()`.
- Plug in a generative LLM in `answer_generator` for more fluent responses.
