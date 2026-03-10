"""Flask API server for the Vignan RAG Voice Assistant.

This provides a comprehensive REST API with:
- Multi-language support (9 Indian languages)
- Lab/classroom smart routing
- Time-based greetings
- Text-to-speech (TTS)
- Natural language translations
- FAISS-powered Q&A

Endpoints:
    POST /api/assistant/query - Main question-answering endpoint
    GET  /api/assistant/status - Health check
    GET  /api/assistant/greeting - Time-based greeting
    POST /api/assistant/tts - Text-to-speech generation
    GET  /api/assistant/languages - List supported languages
    GET  /api/assistant/history - Query history

Usage:
    python api_server.py

Frontend integration example in INTEGRATION_EXAMPLES.md
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import json
import tempfile
import sys
from pathlib import Path
from datetime import datetime
from deep_translator import GoogleTranslator
from gtts import gTTS

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from rag_engine import QueryEngine
from rag_engine.query_normalizer import light_normalize_query
from config import DATA_PATH, MODEL_NAME, TOP_K, SUPPORTED_LANGUAGES

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Initialize the RAG engine
engine = None
history_path = os.path.join(tempfile.gettempdir(), "vignan_assistant_history.json")

# Language mapping for speech recognition (en-IN format)
LANGUAGES = {
    "en-IN": {"code": "en", "name": "English"},
    "hi-IN": {"code": "hi", "name": "Hindi"},
    "te-IN": {"code": "te", "name": "Telugu"},
    "ta-IN": {"code": "ta", "name": "Tamil"},
    "kn-IN": {"code": "kn", "name": "Kannada"},
    "ml-IN": {"code": "ml", "name": "Malayalam"},
    "mr-IN": {"code": "mr", "name": "Marathi"},
    "bn-IN": {"code": "bn", "name": "Bengali"},
    "gu-IN": {"code": "gu", "name": "Gujarati"},
}


def make_natural_language(text, lang_code):
    """Post-process translations to make them more natural and conversational."""
    
    if lang_code == "te":  # Telugu - Tanglish
        replacements = {
            "విజ్ఞాన్ విశ్వవిద్యాలయంలో": "విజ్ఞాన్ కాలేజీలో",
            "విశ్వవిద్యాలయం": "యూనివర్సిటీ",
            "కళాశాల": "కాలేజీ",
            "ఫీజు నిర్మాణం": "ఫీజు స్ట్రక్చర్",
            "సమాచారం": "ఇన్ఫో",
            "వివరాలు": "డిటైల్స్",
            "ప్రవేశ ప్రక్రియ": "అడ్మిషన్ ప్రాసెస్",
            "దరఖాస్తు": "అప్లికేషన్",
            "పరీక్ష": "ఎగ్జామ్",
            "అర్హత": "ఎలిజిబిలిటీ",
            "పత్రాలు": "డాక్యుమెంట్స్",
            "విద్యార్థులు": "స్టూడెంట్స్",
            "సౌకర్యాలు": "ఫెసిలిటీస్",
            "గ్రంథాలయం": "లైబ్రరీ",
            "ప్రయోగశాల": "ల్యాబ్",
            "మెరిట్ ఆధారితంగా": "మెరిట్ బేస్ మీద",
        }
        for old, new in replacements.items():
            text = text.replace(old, new)
    
    elif lang_code == "hi":  # Hindi - Hinglish
        replacements = {
            "विश्वविद्यालय": "यूनिवर्सिटी",
            "महाविद्यालय": "कॉलेज",
            "शुल्क": "फीस",
            "जानकारी": "इन्फो",
            "विवरण": "डिटेल्स",
            "प्रवेश": "एडमिशन",
            "आवेदन": "अप्लीकेशन",
            "परीक्षा": "एग्जाम",
            "पात्रता": "एलिजिबिलिटी",
            "दस्तावेज": "डॉक्यूमेंट्स",
            "छात्र": "स्टूडेंट्स",
            "सुविधाएं": "फैसिलिटीज",
            "पुस्तकालय": "लाइब्रेरी",
            "प्रयोगशाला": "लैब",
        }
        for old, new in replacements.items():
            text = text.replace(old, new)
    
    return text


def translate_text(text, target_code):
    """Translate text to target language with natural language processing."""
    if target_code == 'en':
        return text
    
    try:
        translated = GoogleTranslator(source='en', target=target_code).translate(text)
        # Make it more natural/conversational
        translated = make_natural_language(translated, target_code)
        return translated
    except Exception as e:
        print(f"Translation error: {e}")
        return text


def save_history(question, answer):
    """Save query history."""
    try:
        if os.path.exists(history_path):
            with open(history_path, 'r', encoding='utf-8') as f:
                history = json.load(f)
        else:
            history = []
        
        history.append({
            'timestamp': datetime.now().isoformat(),
            'question': question,
            'answer': answer
        })
        
        # Keep only last 100 entries
        history = history[-100:]
        
        with open(history_path, 'w', encoding='utf-8') as f:
            json.dump(history, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error saving history: {e}")


def time_greeting():
    """Generate time-based greeting in English."""
    hour = datetime.now().hour
    
    if 5 <= hour < 12:
        return "Good morning! Welcome to Vignan University Assistant."
    elif 12 <= hour < 17:
        return "Good afternoon! Welcome to Vignan University Assistant."
    elif 17 <= hour < 21:
        return "Good evening! Welcome to Vignan University Assistant."
    else:
        return "Hello! Welcome to Vignan University Assistant."


def get_natural_greeting(lang_code):
    """Get natural greeting in target language."""
    greetings = {
        'en': time_greeting(),
        'te': "హలో! విజ్ఞాన్ యూనివర్సిటీ అసిస్టెంట్‌కి స్వాగతం.",
        'hi': "नमस्ते! विग्नन यूनिवर्सिटी असिस्टेंट में आपका स्वागत है।",
        'ta': "வணக்கம்! விக்னன் யூனிவர்சிட்டி அசிஸ்டண்ட்க்கு வரவேற்கிறோம்.",
        'kn': "ನಮಸ್ಕಾರ! ವಿಗ್ನನ್ ಯೂನಿವರ್ಸಿಟಿ ಅಸಿಸ್ಟೆಂಟ್‌ಗೆ ಸುಸ್ವಾಗತ.",
        'ml': "നമസ്കാരം! വിഗ്നൻ യൂണിവേഴ്സിറ്റി അസിസ്റ്റന്റിലേക്ക് സ്വാഗതം.",
        'mr': "नमस्कार! विग्नन युनिव्हर्सिटी असिस्टंटमध्ये आपले स्वागत आहे.",
        'bn': "নমস্কার! ভিগনান বিশ্ববিদ্যালয় সহায়কে স্বাগতম।",
        'gu': "નમસ્તે! વિગ્નન યુનિવર્સિટી સહાયકમાં તમારું સ્વાગત છે.",
    }
    return greetings.get(lang_code, greetings['en'])


# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.route('/api/assistant/query', methods=['POST'])
def query():
    """Handle text queries from the frontend with smart lab routing."""
    try:
        data = request.json
        question = data.get('question', '').strip()
        language = data.get('language', 'en-IN')
        
        if not question:
            return jsonify({'error': 'No question provided'}), 400
        
        if len(question.strip()) < 3:
            return jsonify({
                'error': 'Question too short. Please ask a complete question.',
                'success': False
            }), 400
        
        if engine is None:
            return jsonify({'error': 'Engine not initialized'}), 500
        
        # Get translation language code
        if language not in LANGUAGES:
            if language in ['en', 'hi', 'te', 'ta', 'kn', 'ml', 'mr', 'bn', 'gu']:
                language = f"{language}-IN"
            else:
                language = 'en-IN'
        
        lang_info = LANGUAGES[language]
        translation_code = lang_info['code']
        lang_name = lang_info['name']
        
        lowered = question.lower().strip()
        
        # PRIORITY 1: Handle lab/classroom navigation requests
        lab_keywords = ["lab", "labs", "laboratory", "లాబ", "ల్యాబ", "प्रयोगशाला", "लैब"]
        classroom_keywords = ["classroom", "classrooms", "class room", "క్లాస", "कक्षा"]
        info_keywords = ["about", "facility", "facilities", "equipment", "tell", "what is",
                        "గురించి", "సౌకర్యాలు", "के बारे में", "सुविधाएं"]
        show_keywords = ["show", "display", "see", "చూపించు", "दिखाओ"]
        
        is_show_request = any(keyword in lowered for keyword in show_keywords)
        is_info_query = any(keyword in lowered for keyword in info_keywords)
        is_simple_show = is_show_request and not is_info_query
        is_lab_query = any(keyword.lower() in lowered for keyword in lab_keywords)
        is_classroom_query = any(keyword.lower() in lowered for keyword in classroom_keywords)
        
        if is_lab_query or is_classroom_query:
            query_type = "labs" if is_lab_query else "classrooms"
            
            options = {
                "labs": [
                    {"id": "cse-lab", "name": "CSE Lab", "name_te": "CSE లాబ్", "name_hi": "CSE प्रयोगशाला", "block": "a-block", "section": "labs"},
                    {"id": "physics-lab", "name": "Physics Lab", "name_te": "ఫిజిక్స్ లాబ్", "name_hi": "भौतिकी प्रयोगशाला", "block": "a-block", "section": "labs"},
                    {"id": "chemistry-lab", "name": "Chemistry Lab", "name_te": "కెమిస్ట్రీ లాబ్", "name_hi": "रसायन प्रयोगशाला", "block": "a-block", "section": "labs"}
                ],
                "classrooms": [
                    {"id": "classroom-1", "name": "Classroom 1", "name_te": "క్లాస్‌రూమ్ 1", "name_hi": "कक्षा 1", "block": "a-block", "section": "classrooms"},
                    {"id": "classroom-2", "name": "Classroom 2", "name_te": "క్లాస్‌రూమ్ 2", "name_hi": "कक्षा 2", "block": "a-block", "section": "classrooms"}
                ]
            }
            
            if is_info_query or not is_simple_show:
                # Return COMBINED response: FAISS answer + lab grid
                english_question = question
                if translation_code != 'en':
                    try:
                        english_question = GoogleTranslator(source=translation_code, target='en').translate(question)
                    except:
                        pass
                
                # Light normalization for better FAISS matching
                normalized_question = light_normalize_query(english_question)
                answer = engine.ask(normalized_question)
                translated_answer = translate_text(answer, translation_code)
                save_history(question, answer)
                
                return jsonify({
                    'question': question,
                    'answer': answer,
                    'translated_answer': translated_answer,
                    'query_type': query_type,
                    'options': options[query_type],
                    'language': language,
                    'language_name': lang_name,
                    'success': True,
                    'type': 'combined_response'
                })
            
            # Pure navigation request
            return jsonify({
                'question': question,
                'query_type': query_type,
                'options': options[query_type],
                'language': language,
                'language_name': lang_name,
                'success': True,
                'type': 'lab_selection'
            })
        
        # Handle greetings
        greeting_words = {"hi", "hello", "hey", "హలో", "నమస్కారం", "नमस्ते", "வணக்கம்"}
        is_greeting = lowered in greeting_words
        
        if is_greeting:
            answer = time_greeting()
            translated_answer = get_natural_greeting(translation_code)
            save_history(question, answer)
            
            return jsonify({
                'question': question,
                'answer': answer,
                'translated_answer': translated_answer,
                'language': language,
                'language_name': lang_name,
                'success': True,
                'type': 'greeting'
            })
        
        # Standard RAG query
        english_question = question
        if translation_code != 'en':
            try:
                english_question = GoogleTranslator(source=translation_code, target='en').translate(question)
            except Exception as e:
                print(f"Translation error: {e}")
        
        # Light normalization: only fix spelling, don't expand to full questions
        # This preserves the user's query structure for better FAISS matching
        normalized_question = light_normalize_query(english_question)
        print(f"[*] Original: {english_question}")
        if normalized_question != english_question:
            print(f"[*] Corrected: {normalized_question}")
        
        answer = engine.ask(normalized_question)
        translated_answer = translate_text(answer, translation_code)
        save_history(question, answer)
        
        return jsonify({
            'question': question,
            'answer': answer,
            'translated_answer': translated_answer,
            'language': language,
            'language_name': lang_name,
            'success': True,
            'type': 'standard'
        })
    
    except Exception as e:
        print(f"Error in query: {e}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/assistant/status', methods=['GET'])
def status():
    """Health check endpoint."""
    return jsonify({
        'ready': engine is not None,
        'message': 'Assistant is ready' if engine else 'Assistant not initialized'
    })


@app.route('/api/assistant/greeting', methods=['GET'])
def greeting():
    """Get time-based greeting."""
    language = request.args.get('language', 'en-IN')
    
    if language not in LANGUAGES:
        language = 'en-IN'
    
    lang_info = LANGUAGES[language]
    translation_code = lang_info['code']
    
    greeting_text = get_natural_greeting(translation_code)
    
    return jsonify({
        'greeting': greeting_text,
        'language_name': lang_info['name'],
        'language': language
    })


@app.route('/api/assistant/history', methods=['GET'])
def history():
    """Get query history."""
    try:
        if os.path.exists(history_path):
            with open(history_path, 'r', encoding='utf-8') as f:
                history_data = json.load(f)
            return jsonify({'history': history_data})
        return jsonify({'history': []})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/assistant/languages', methods=['GET'])
def languages():
    """Get supported languages."""
    languages = [
        {'code': code, 'name': info['name']}
        for code, info in LANGUAGES.items()
    ]
    return jsonify({'languages': languages})


@app.route('/api/assistant/tts', methods=['POST'])
def text_to_speech():
    """Convert text to speech using gTTS."""
    try:
        data = request.json
        text = data.get('text', '').strip()
        language = data.get('language', 'en-IN')
        
        if not text:
            return jsonify({'error': 'No text provided'}), 400
        
        if language not in LANGUAGES:
            if language in ['en', 'hi', 'te', 'ta', 'kn', 'ml', 'mr', 'bn', 'gu']:
                language = f"{language}-IN"
            else:
                language = 'en-IN'
        
        lang_code = LANGUAGES[language]['code']
        
        # Generate audio using gTTS at normal speed
        tts = gTTS(text=text, lang=lang_code, slow=False)
        
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mp3')
        tts.save(temp_file.name)
        temp_file.close()
        
        return send_file(
            temp_file.name,
            mimetype='audio/mpeg',
            as_attachment=False,
            download_name='speech.mp3'
        )
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================================================
# INITIALIZATION
# ============================================================================

def initialize_engine():
    """Initialize RAG engine with warm-up."""
    global engine
    
    print("="*60)
    print("[*] Initializing Vignan RAG API Server...")
    print("="*60)
    print(f"[DATA] {DATA_PATH}")
    print(f"[MODEL] {MODEL_NAME}")
    print(f"[TOP-K] {TOP_K}")
    print("="*60)
    print("\n[*] Loading knowledge base...")
    
    try:
        engine = QueryEngine(model_name=MODEL_NAME, top_k=TOP_K)
        chunks = engine.ingest_json(DATA_PATH)
        engine.index_chunks(chunks)
        print(f"[OK] Indexed {len(chunks)} knowledge chunks")
        
        # Warm-up FAISS index
        print("[*] Warming up FAISS index with test query...")
        warmup_result = engine.ask("What is Vignan University?")
        print(f"[OK] Warmup complete. Model ready for queries.")
        print(f"     (Warmup result preview: {warmup_result[:50]}...)")
        print(f"\n[OK] Starting Flask server on http://localhost:5001")
        
    except Exception as e:
        print(f"[ERROR] Error loading knowledge base: {e}")
        sys.exit(1)


if __name__ == '__main__':
    initialize_engine()
    
    print("\n" + "="*60)
    print("[*] API Server Ready!")
    print("="*60)
    print("[URL] http://localhost:5001")
    print("\n[ENDPOINTS]")
    print("   POST   /api/assistant/query")
    print("   GET    /api/assistant/status")
    print("   GET    /api/assistant/greeting")
    print("   POST   /api/assistant/tts")
    print("   GET    /api/assistant/languages")
    print("   GET    /api/assistant/history")
    print("="*60)
    print("\n[*] Server starting...\n")
    
    app.run(
        host='0.0.0.0',
        port=5001,
        debug=False
    )
