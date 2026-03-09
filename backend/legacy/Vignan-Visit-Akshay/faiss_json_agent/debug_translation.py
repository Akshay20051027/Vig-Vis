#!/usr/bin/env python3
"""Debug Telugu to English translation for lab queries."""

from src.query_engine import QueryEngine
from deep_translator import GoogleTranslator
from pathlib import Path

data_path = Path('.') / 'data' / 'vignan_university_dataset.json'
print("Loading FAISS engine...")
engine = QueryEngine(model_name='all-MiniLM-L6-v2', top_k=3)
chunks = engine.ingest_json(str(data_path))
engine.index_chunks(chunks)

# Test Telugu questions
telugu_queries = [
    ("విజ్ఞాన్ లాబ్స్ గురించి చెప్పు", "about Vignan labs"),
    ("విజ్ఞాన్ ఫిజిక్స్ ల్యాబ్ గురించి చెప్పు", "about Vignan physics lab"),
    ("ఫిజిక్స్ ల్యాబ్ గురించి చెప్పు", "about physics lab"),
    ("ల్యాబ్ సౌకర్యాలు చెప్పు", "tell about lab facilities"),
]

print("\n" + "="*80)
print("TELUGU TRANSLATION & RETRIEVAL DEBUG TEST")
print("="*80)

for telugu_q, expected_en in telugu_queries:
    # Translate Telugu to English
    try:
        translated_en = GoogleTranslator(source='te', target='en').translate(telugu_q)
    except Exception as e:
        translated_en = f"ERROR: {e}"
    
    print(f'\n🇮🇳 Telugu: {telugu_q}')
    print(f'📝 Translated: "{translated_en}"')
    print(f'✓ Expected: "{expected_en}"')
    
    # Get FAISS results for BOTH translated and expected
    print(f'\n  With translated text:')
    results = engine.retriever.retrieve(translated_en, top_k=3)
    for i, (score, meta) in enumerate(results):
        title = meta.get("title", "N/A")
        print(f'    [{i+1}] [Score: {score:.4f}] {title[:60]}')
    
    print(f'\n  With expected English:')
    results = engine.retriever.retrieve(expected_en, top_k=3)
    for i, (score, meta) in enumerate(results):
        title = meta.get("title", "N/A")
        print(f'    [{i+1}] [Score: {score:.4f}] {title[:60]}')
