#!/usr/bin/env python3
"""Debug FAISS retrieval for lab queries."""

from src.query_engine import QueryEngine
from pathlib import Path

data_path = Path('.') / 'data' / 'vignan_university_dataset.json'
print("Loading FAISS engine...")
engine = QueryEngine(model_name='all-MiniLM-L6-v2', top_k=3)
chunks = engine.ingest_json(str(data_path))
engine.index_chunks(chunks)

# Test what documents are retrieved
test_queries = [
    'about Vignan labs',
    'lab facilities',
    'tell me about labs',
    'physics lab',
    'Robotics Club',
    'what is Robotics Club'
]

print("\n" + "="*80)
print("FAISS RETRIEVAL DEBUG TEST")
print("="*80)

for q in test_queries:
    results = engine.retriever.retrieve(q, top_k=3)
    print(f'\n🔍 Query: "{q}"')
    for i, (score, meta) in enumerate(results):
        title = meta.get("title", "N/A")
        print(f'  [{i+1}] [Score: {score:.4f}] {title[:70]}')
    
    # Also show the full answer
    answer = engine.ask(q)
    print(f'  📝 Answer: {answer[:120]}...\n')
