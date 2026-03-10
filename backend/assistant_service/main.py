"""Main entry point for the Vignan RAG Voice/Text Assistant.

Usage:
    python run.py                           # Text mode, English
    python run.py --voice                   # Voice mode, will ask language
    python run.py --language hindi          # Text mode, Hindi
    python run.py --voice --language telugu # Voice mode, Telugu
"""

import argparse
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from rag_engine.voice_assistant import VoiceAssistant
from rag_engine.query_engine import QueryEngine
from config import (
    DATA_PATH, MODEL_NAME, TOP_K, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE
)


def main():
    """Run the Vignan RAG Voice/Text Assistant."""
    parser = argparse.ArgumentParser(
        description="Vignan RAG Voice/Text Assistant with Multilingual Support"
    )
    parser.add_argument(
        "--voice",
        action="store_true",
        help="Start in voice mode (default: text mode)"
    )
    parser.add_argument(
        "--language",
        default=DEFAULT_LANGUAGE,
        choices=list(SUPPORTED_LANGUAGES.keys()),
        help=f"Language for speech and responses (default: {DEFAULT_LANGUAGE})"
    )
    parser.add_argument(
        "--data",
        default=DATA_PATH,
        help="Path to knowledge JSON file"
    )
    parser.add_argument(
        "--model",
        default=MODEL_NAME,
        help="SentenceTransformer model name"
    )
    parser.add_argument(
        "--top-k",
        type=int,
        default=TOP_K,
        help="Number of results to retrieve"
    )
    
    args = parser.parse_args()
    
    # Validate data file exists
    if not Path(args.data).exists():
        print(f"❌ Error: Data file not found: {args.data}")
        print(f"Please update DATA_PATH in config.py or provide --data argument")
        sys.exit(1)
    
    # Initialize RAG engine
    print("="*60)
    print("🚀 Initializing Vignan RAG Agent...")
    print("="*60)
    print(f"📁 Data: {args.data}")
    print(f"🤖 Model: {args.model}")
    print(f"🔍 Top-K: {args.top_k}")
    print(f"🌐 Language: {SUPPORTED_LANGUAGES[args.language]['name']}")
    print("="*60)
    print("\n⏳ Loading knowledge base...")
    
    try:
        engine = QueryEngine(model_name=args.model, top_k=args.top_k)
        chunks = engine.ingest_json(args.data)
        engine.index_chunks(chunks)
        print(f"✅ Loaded {len(chunks)} knowledge chunks successfully!\n")
    except Exception as e:
        print(f"❌ Error loading knowledge base: {e}")
        sys.exit(1)
    
    # Start voice assistant
    try:
        assistant = VoiceAssistant(
            rag_engine=engine,
            use_voice=args.voice,
            language=args.language
        )
        assistant.run()
    except KeyboardInterrupt:
        print("\n\n👋 Goodbye!")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
