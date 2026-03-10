"""Voice-enabled assistant that answers Vignan questions via the FAISS RAG engine.

Features:
- Time-aware greeting (offers lunch info in the afternoon).
- Voice or text input, text-to-speech output.
- All queries are answered only through the RAG engine (no extra utilities).
"""

from __future__ import annotations

import gc
import argparse
import json
import os
import tempfile
from datetime import datetime
from typing import Optional

import pyttsx3
import speech_recognition as sr
from deep_translator import GoogleTranslator
from gtts import gTTS
import pygame
import io

from .query_engine import QueryEngine

# Import configuration
try:
    from config import (
        SUPPORTED_LANGUAGES as LANGUAGES,
        LISTEN_TIMEOUT,
        PHRASE_TIME_LIMIT,
        NOISE_CALIBRATION_TIME,
        MAX_LISTEN_FAILURES,
        LUNCH_REMINDER,
        CUSTOM_GREETING
    )
except ImportError:
    # Fallback defaults if config not available
    LANGUAGES = {
        "english": {"code": "en", "sr_code": "en-IN", "name": "English"},
        "hindi": {"code": "hi", "sr_code": "hi-IN", "name": "Hindi"},
        "telugu": {"code": "te", "sr_code": "te-IN", "name": "Telugu"},
        "tamil": {"code": "ta", "sr_code": "ta-IN", "name": "Tamil"},
        "kannada": {"code": "kn", "sr_code": "kn-IN", "name": "Kannada"},
        "malayalam": {"code": "ml", "sr_code": "ml-IN", "name": "Malayalam"},
        "marathi": {"code": "mr", "sr_code": "mr-IN", "name": "Marathi"},
        "bengali": {"code": "bn", "sr_code": "bn-IN", "name": "Bengali"},
        "gujarati": {"code": "gu", "sr_code": "gu-IN", "name": "Gujarati"},
    }
    LISTEN_TIMEOUT = 8
    PHRASE_TIME_LIMIT = 12
    NOISE_CALIBRATION_TIME = 1.5
    MAX_LISTEN_FAILURES = 3
    LUNCH_REMINDER = {
        "start_hour": 12,
        "end_hour": 16,
        "message": "It's lunchtime; the boys hostel is serving lunch now."
    }
    CUSTOM_GREETING = ""


def time_greeting(now: Optional[datetime] = None) -> str:
    """Generate time-based greeting message."""
    if CUSTOM_GREETING:
        return CUSTOM_GREETING
    
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
    if LUNCH_REMINDER and LUNCH_REMINDER.get("start_hour") <= hour < LUNCH_REMINDER.get("end_hour"):
        extra = f" {LUNCH_REMINDER.get('message', '')}"
    
    return f"{greet}! The time is {now.strftime('%I:%M %p')}.{extra}"


class VoiceAssistant:
    def __init__(self, rag_engine: QueryEngine, use_voice: bool = False, language: str = "english") -> None:
        self.rag_engine = rag_engine
        self.use_voice = use_voice
        self.language = language if language in LANGUAGES else "english"
        self.recognizer = sr.Recognizer()
        self.tts = pyttsx3.init()
        self.history_path = os.path.join(tempfile.gettempdir(), "voice_assistant_history.json")
        self._init_tts()
        self.consecutive_listen_failures = 0
        self.pending_language_selection = False
        # Initialize pygame mixer for gTTS audio playback
        try:
            pygame.mixer.init()
        except Exception:
            pass
        # Initialize Hybrid TTS for better quality Indian language voices
        # Note: AI4Bharat currently has connectivity issues, using enhanced gTTS with slow mode
        try:
            # Set use_indic_tts=False to use enhanced gTTS instead of AI4Bharat
            # gTTS with slow=True provides clearer pronunciation for Telugu/Hindi/Tamil
            self.hybrid_tts = HybridTTS(use_indic_tts=False)
            print("✅ Hybrid TTS initialized with ENHANCED gTTS (slow/clear mode)")
            print("   🎙️ Clear voices: Telugu, Hindi, Tamil, Kannada, Malayalam")
        except Exception as e:
            print(f"⚠️ Hybrid TTS initialization failed: {e}. Using traditional TTS.")
            self.hybrid_tts = None

    def _init_tts(self) -> None:
        rate = self.tts.getProperty("rate")
        self.tts.setProperty("rate", int(rate * 0.95))

    def _fresh_tts(self) -> pyttsx3.Engine:
        """Create a fresh TTS engine to avoid Windows audio suppression."""
        try:
            engine = pyttsx3.init("sapi5")
        except Exception:
            engine = pyttsx3.init()
        try:
            voices = engine.getProperty("voices")
            if voices:
                # Try to find a voice matching the current language
                target_lang_code = LANGUAGES[self.language]["code"]
                selected_voice = None
                
                # Look for language-specific voice
                for voice in voices:
                    # Check if voice ID or name contains language code
                    if target_lang_code in voice.id.lower() or target_lang_code in voice.name.lower():
                        selected_voice = voice
                        break
                
                # If no language-specific voice found, use default
                if selected_voice:
                    engine.setProperty("voice", selected_voice.id)
                else:
                    engine.setProperty("voice", voices[0].id)
        except Exception:
            pass
        try:
            base_rate = engine.getProperty("rate")
            engine.setProperty("rate", int(base_rate * 0.95))
        except Exception:
            pass
        return engine

    def speak(self, text: str) -> None:
        # Translate if not in English
        display_text = text
        if self.language != "english":
            try:
                translated = GoogleTranslator(source='en', target=LANGUAGES[self.language]["code"]).translate(text)
                print(f"Assistant [{LANGUAGES[self.language]['name']}]: {translated}")
                display_text = translated
            except Exception as e:
                print(f"⚠️ Translation failed: {e}")
                print(f"Assistant: {text}")
                display_text = text
        else:
            print(f"Assistant: {text}")
        
        # Try Hybrid TTS first (Indic-TTS for Indian languages, fallback to gTTS/pyttsx3)
        if self.hybrid_tts:
            try:
                lang_code = LANGUAGES[self.language]["code"]
                self.hybrid_tts.speak(display_text, lang=lang_code)
                return
            except Exception as e:
                print(f"⚠️ Hybrid TTS failed: {e}. Falling back to traditional TTS.")
        
        # Fallback: Use gTTS for non-English languages, pyttsx3 for English
        if self.language != "english":
            try:
                # Generate speech using Google TTS
                tts = gTTS(text=display_text, lang=LANGUAGES[self.language]["code"], slow=False)
                
                # Save to temporary file and play
                audio_fp = io.BytesIO()
                tts.write_to_fp(audio_fp)
                audio_fp.seek(0)
                
                # Play using pygame
                pygame.mixer.music.load(audio_fp)
                pygame.mixer.music.play()
                while pygame.mixer.music.get_busy():
                    pygame.time.Clock().tick(10)
            except Exception as e:
                print(f"⚠️ Voice output failed: {e}")
        else:
            # Use pyttsx3 for English
            engine = self._fresh_tts()
            try:
                engine.say(display_text)
                engine.runAndWait()
            except Exception:
                pass
            finally:
                try:
                    engine.stop()
                except Exception:
                    pass

    def listen(self, timeout: int = None, phrase_time_limit: int = None) -> str:
        """Listen for voice input and convert to text."""
        timeout = timeout or LISTEN_TIMEOUT
        phrase_time_limit = phrase_time_limit or PHRASE_TIME_LIMIT
        
        try:
            lang_name = LANGUAGES[self.language]["name"]
            sr_code = LANGUAGES[self.language]["sr_code"]
            print(f"🎤 Listening in {lang_name}... (speak now)")
            with sr.Microphone() as source:
                print("📊 Adjusting for ambient noise... (please wait)")
                self.recognizer.adjust_for_ambient_noise(source, duration=NOISE_CALIBRATION_TIME)
                print(f"✅ Ready! Speak your question in {lang_name}...")
                audio = self.recognizer.listen(source, timeout=timeout, phrase_time_limit=phrase_time_limit)
                print("🔄 Processing your speech...")
                text = self.recognizer.recognize_google(audio, language=sr_code)
                print(f"✅ You said: {text}")
                
                # Translate to English for RAG processing if needed
                if self.language != "english":
                    try:
                        translated = GoogleTranslator(source=LANGUAGES[self.language]["code"], target='en').translate(text)
                        print(f"🔄 Translated to English: {translated}")
                        text = translated
                    except Exception as e:
                        print(f"⚠️ Translation failed: {e}, using original text")
                
                self.consecutive_listen_failures = 0
                return text
        except AttributeError as e:
            # PyAudio missing
            print(f"❌ PyAudio error: {e}")
            self.consecutive_listen_failures += 1
            return "__pyaudio_missing__"
        except sr.WaitTimeoutError:
            print("⏱️ No speech detected (timeout)")
            self.consecutive_listen_failures += 1
            return ""
        except sr.UnknownValueError:
            print("❓ Could not understand audio")
            self.consecutive_listen_failures += 1
            return ""
        except Exception as e:
            print(f"❌ Listen error: {e}")
            self.consecutive_listen_failures += 1
            return ""

    def _save_history(self, query: str, response: str) -> None:
        record = {"ts": datetime.now().isoformat(), "query": query, "response": response}
        data = []
        if os.path.exists(self.history_path):
            try:
                with open(self.history_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception:
                data = []
        data.append(record)
        with open(self.history_path, "w", encoding="utf-8") as f:
            json.dump(data[-200:], f, indent=2)

    def process_query(self, query: str) -> str:
        lowered = query.lower().strip()
        
        # Check if we're waiting for language selection for voice mode
        if self.pending_language_selection:
            for lang_key, lang_info in LANGUAGES.items():
                lang_name_lower = lang_info["name"].lower()
                if (lang_key[:4] in lowered or lang_name_lower[:4] in lowered or 
                    lang_key in lowered or lang_name_lower in lowered):
                    self.language = lang_key
                    self.use_voice = True
                    self.pending_language_selection = False
                    reply = f"Perfect! Voice mode enabled with {lang_info['name']}. I will listen and respond in {lang_info['name']}."
                    self._save_history(query, reply)
                    return reply
            # If no valid language detected
            reply = "Please select a valid language: English, Hindi, Telugu, Tamil, Kannada, Malayalam, Marathi, Bengali, or Gujarati."
            self._save_history(query, reply)
            return reply
        
        # Handle language switching - robust detection with typos and variations
        has_switch_word = any(word in lowered for word in ["switch", "swith", "chang", "use", "enable", "select", "mode", "language"])
        
        # Check each language with flexible matching
        for lang_key, lang_info in LANGUAGES.items():
            # Match partial language names (e.g., "hind" for hindi, "telu" for telugu)
            lang_name_lower = lang_info["name"].lower()
            if (lang_key[:4] in lowered or  # Match first 4 chars of key
                lang_name_lower[:4] in lowered or  # Match first 4 chars of name
                lang_key in lowered or  # Full key match
                lang_name_lower in lowered):  # Full name match
                if has_switch_word or "to" in lowered or len(lowered.split()) <= 2:
                    old_lang = LANGUAGES[self.language]["name"]
                    self.language = lang_key
                    reply = f"Language changed from {old_lang} to {lang_info['name']}. I will now listen and respond in {lang_info['name']}."
                    self._save_history(query, reply)
                    return reply
        
        # Handle mode switching - robust detection
        has_voice_word = any(word in lowered for word in ["voice", "voic", "speak", "mic", "microphone", "audio"])
        has_text_word = any(word in lowered for word in ["text", "type", "typing", "keyboard", "write"])
        has_mode_word = any(word in lowered for word in ["switch", "swith", "change", "enable", "disable", "use", "turn on", "turn off", "mode"])
        
        # Switch to voice mode - ask for language preference
        if has_voice_word and (has_mode_word or "mode" in lowered):
            self.pending_language_selection = True
            lang_list = ", ".join([info["name"] for info in LANGUAGES.values()])
            reply = f"Voice mode requested! Which language would you like to speak in?\nAvailable: {lang_list}\nPlease type or say the language name."
            self._save_history(query, reply)
            return reply
        
        # Switch to text mode
        if has_text_word and (has_mode_word or "mode" in lowered):
            self.use_voice = False
            reply = "Switched to text mode. You can type your questions now."
            self._save_history(query, reply)
            return reply
        
        # Handle greetings
        if lowered in {"hi", "hello", "hey", "good morning", "good afternoon", "good evening", "namaste", "vanakkam"}:
            reply = time_greeting()
            self._save_history(query, reply)
            return reply
        
        # Always answer via the RAG engine for other inputs.
        rag_answer = self.rag_engine.ask(query)
        self._save_history(query, rag_answer)
        return rag_answer

    def run(self) -> None:
        greeting = time_greeting()
        self.speak(greeting)
        self._save_history("__greeting__", greeting)

        current_lang = LANGUAGES[self.language]["name"]
        if self.use_voice:
            print("\n" + "="*60)
            print(f"🎤 VOICE MODE ENABLED - Language: {current_lang}")
            print("="*60)
            print("Instructions:")
            print("  - Wait for '✅ Ready! Speak your question...' prompt")
            print("  - Speak clearly into microphone")
            print("  - Say 'switch to text' to type instead")
            print(f"  - Say 'switch to [language]' to change language")
            print("  - Supported: English, Hindi, Telugu, Tamil, Kannada, etc.")
            print("  - Say 'exit' or 'quit' to stop")
            print("  - System will auto-switch to text if mic fails")
            print("="*60 + "\n")
        else:
            print("\n" + "="*60)
            print("⌨️  TEXT MODE ENABLED")
            print("="*60)
            print("Instructions:")
            print("  - Type your questions and press Enter")
            print("  - Type 'switch to voice' to enable voice mode")
            print("    (You'll be asked to choose a language)")
            print("  - Supported: English, Hindi, Telugu, Tamil, Kannada, etc.")
            print("  - Type 'exit' or 'quit' to stop")
            print("="*60 + "\n")

        while True:
            if self.use_voice:
                print("\n" + "="*50)
                query = self.listen()
                if query == "__pyaudio_missing__":
                    print("\n❌ PyAudio not available")
                    self.speak("Microphone driver missing. Switching to text mode. You can type your questions.")
                    self.use_voice = False
                    continue
                if self.consecutive_listen_failures >= MAX_LISTEN_FAILURES:
                    print(f"\n⚠️ Too many failures ({self.consecutive_listen_failures})")
                    self.speak("Having trouble hearing you. Switching to text mode. You can type your questions.")
                    self.use_voice = False
                    continue
            else:
                try:
                    query = input("\nYou: ").strip()
                except (KeyboardInterrupt, EOFError):
                    query = "exit"
            if not query:
                print("⚠️ No input detected. Try again or say 'exit' to quit.")
                continue
            if query.lower() in {"exit", "quit", "bye"}:
                self.speak("Goodbye!")
                break

            response = self.process_query(query)
            self.speak(response)
            gc.collect()


def build_voice_assistant(use_voice: bool = False, language: str = "english") -> VoiceAssistant:
    rag = QueryEngine()
    chunks = rag.ingest_json("data/vignan_university_dataset.json")
    rag.index_chunks(chunks)
    return VoiceAssistant(rag, use_voice=use_voice, language=language)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Voice/Text assistant over Vignan FAISS RAG")
    parser.add_argument("--voice", action="store_true", help="Enable microphone input instead of text prompt")
    parser.add_argument("--language", default="english", choices=list(LANGUAGES.keys()), help="Language for speech and responses")
    args = parser.parse_args()

    assistant = build_voice_assistant(use_voice=args.voice, language=args.language)
    assistant.run()
