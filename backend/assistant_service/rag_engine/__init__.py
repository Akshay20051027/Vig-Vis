"""RAG Engine Package - Multilingual Voice & Text Assistant.

This package provides a complete FAISS-based Retrieval Augmented Generation system
with multilingual voice and text support.

Main Components:
- QueryEngine: Core RAG orchestration
- VoiceAssistant: Voice and text interface with multilingual support
- Configuration: Easy customization via config.py

Quick Start:
    from rag_engine.query_engine import QueryEngine
    
    engine = QueryEngine()
    chunks = engine.ingest_json("data/knowledge.json")
    engine.index_chunks(chunks)
    answer = engine.ask("Your question here")
"""

from .query_engine import QueryEngine
# from .voice_assistant import VoiceAssistant  # Temporarily disabled - requires pygame

__all__ = ['QueryEngine']  # 'VoiceAssistant' removed temporarily
__version__ = '1.0.0'
