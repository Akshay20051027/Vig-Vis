"""CLI entrypoint for the FAISS-based JSON RAG agent."""

import argparse
from datetime import datetime
from pathlib import Path

from src.query_engine import QueryEngine


def build_engine(args: argparse.Namespace) -> QueryEngine:
    engine = QueryEngine(model_name=args.model, top_k=args.top_k)
    chunks = engine.ingest_json(args.json_path)
    engine.index_chunks(chunks)
    return engine


def time_greeting(now: datetime | None = None) -> str:
    now = now or datetime.now()
    hour = now.hour
    if 5 <= hour < 12:
        greet = "Good morning"
    elif 12 <= hour < 17:
        greet = "Good afternoon"
    elif 17 <= hour < 22:
        greet = "Good evening"
    else:
        greet = "Hello"

    extra = ""
    if 12 <= hour < 16:
        extra = " It's lunchtime; the boys hostel is serving lunch now."
    return f"{greet}! The time is {now.strftime('%I:%M %p')}.{extra}"


def interactive_loop(engine: QueryEngine) -> None:
    print("RAG agent ready. Ask questions (type 'exit' to quit).")
    while True:
        try:
            question = input("\nQuestion: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nGoodbye!")
            break
        if question.lower() in {"exit", "quit"}:
            print("Goodbye!")
            break
        if question.lower() in {"hi", "hello", "hey", "good morning", "good afternoon", "good evening"}:
            print("\n" + time_greeting())
            continue
        if not question:
            continue
        answer = engine.ask(question)
        print("\n" + answer)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="FAISS-based RAG over JSON knowledge.")
    parser.add_argument("--json-path", default=str(Path("data/vignan_university_dataset.json")), help="Path to knowledge JSON file.")
    parser.add_argument("--model", default="all-MiniLM-L6-v2", help="SentenceTransformer model name.")
    parser.add_argument("--top-k", type=int, default=3, help="Number of chunks to retrieve for each question.")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    engine = build_engine(args)
    interactive_loop(engine)
