"""Hybrid TTS system with AI4Bharat Indic-TTS support for superior Indian language voices."""

import io
import os
import tempfile
import requests
import base64
from typing import Optional

try:
    import pygame
    HAS_PYGAME = True
except ImportError:
    HAS_PYGAME = False

try:
    from gtts import gTTS
    HAS_GTTS = True
except ImportError:
    HAS_GTTS = False

try:
    import pyttsx3
    HAS_PYTTSX3 = True
except ImportError:
    HAS_PYTTSX3 = False

# AI4Bharat Indic-TTS API endpoint
INDIC_TTS_API = "https://api.dhruva.ai4bharat.org/services/inference/tts"
INDIC_TTS_API_KEY = None  # Set this if you have API key, otherwise uses rate-limited public access


class HybridTTS:
    """
    Hybrid Text-to-Speech engine with AI4Bharat Indic-TTS:
    1. AI4Bharat Indic-TTS API for Telugu, Hindi, Tamil, Kannada, Malayalam (neural quality)
    2. gTTS fallback for all languages
    3. Pyttsx3 for English (offline, fast)
    
    Indic-TTS provides natural, human-like voices for Indian languages
    """
    
    # Languages supported by AI4Bharat Indic-TTS (neural quality)
    INDIC_TTS_LANGUAGES = {
        'te': 'telugu',
        'hi': 'hindi', 
        'ta': 'tamil',
        'kn': 'kannada',
        'ml': 'malayalam',
        'mr': 'marathi',
        'gu': 'gujarati',
        'bn': 'bengali',
        'or': 'odia',
        'pa': 'punjabi'
    }
    
    # Language name mapping
    LANGUAGE_NAMES = {
        'te': 'Telugu',
        'hi': 'Hindi',
        'ta': 'Tamil',
        'kn': 'Kannada',
        'ml': 'Malayalam',
        'mr': 'Marathi',
        'gu': 'Gujarati',
        'bn': 'Bengali',
        'or': 'Odia',
        'pa': 'Punjabi',
        'en': 'English'
    }
    
    # Gender/voice preferences for Indic-TTS
    VOICE_PREFERENCES = {
        'te': 'female',  # Telugu female voice
        'hi': 'female',  # Hindi female voice
        'ta': 'female',  # Tamil female voice
        'default': 'female'
    }

    def __init__(self, language: str = 'en', use_indic_tts: bool = True):
        """
        Initialize TTS engine.
        
        Args:
            language: Language code (en, te, hi, ta, etc.)
            use_indic_tts: If True, use AI4Bharat Indic-TTS for Indian languages
        """
        self.language = language
        self.use_indic_tts = use_indic_tts
        self.pyttsx3_engine = None
        self.indic_tts_failed_count = 0  # Track failures to avoid spam
        self.use_indic_tts_fallback = False  # Disable after repeated failures
        
        # Initialize pygame for audio playback
        if HAS_PYGAME and not pygame.mixer.get_init():
            try:
                pygame.mixer.init()
            except:
                pass
        
        # Initialize pyttsx3 for English
        if language == 'en' and HAS_PYTTSX3:
            try:
                self.pyttsx3_engine = pyttsx3.init()
                self.pyttsx3_engine.setProperty('rate', 165)
                self.pyttsx3_engine.setProperty('volume', 1.0)
            except Exception as e:
                print(f"⚠️ Pyttsx3 initialization failed: {e}")

    def speak(self, text: str, lang: Optional[str] = None) -> bool:
        """
        Generate and play speech for the given text.
        
        Args:
            text: Text to speak
            lang: Language code (overrides instance language if provided)
        
        Returns:
            True if successful, False otherwise
        """
        if not text.strip():
            return False
        
        # Use provided language or default to instance language
        language = lang if lang else self.language
        
        # Try AI4Bharat Indic-TTS first for Indian languages (BEST QUALITY)
        # But skip if it has failed multiple times to avoid spam
        if self.use_indic_tts and language in self.INDIC_TTS_LANGUAGES and not self.use_indic_tts_fallback:
            try:
                return self._speak_indic_tts(text, language)
            except Exception as e:
                self.indic_tts_failed_count += 1
                if self.indic_tts_failed_count >= 3:
                    print(f"⚠️ AI4Bharat Indic-TTS disabled after {self.indic_tts_failed_count} failures. Using gTTS.")
                    self.use_indic_tts_fallback = True
                # Don't print error every time, only first few times
                if self.indic_tts_failed_count <= 2:
                    print(f"⚠️ Indic-TTS failed ({self.indic_tts_failed_count}/3): {str(e)[:100]}")
        
        # Try pyttsx3 for English (offline, fast)
        if language == 'en' and self.pyttsx3_engine:
            try:
                return self._speak_pyttsx3(text)
            except Exception as e:
                print(f"⚠️ Pyttsx3 failed: {e}, trying gTTS...")
        
        # Fallback to gTTS (works for all languages, requires internet)
        if HAS_GTTS:
            try:
                return self._speak_gtts(text, language)
            except Exception as e:
                print(f"❌ gTTS failed: {e}")
                return False
        
        print("❌ No TTS engine available")
        return False
    
    def _speak_indic_tts(self, text: str, language: str) -> bool:
        """Use AI4Bharat Indic-TTS API for natural Indian language speech."""
        lang_name = self.LANGUAGE_NAMES.get(language, language)
        print(f"🎙️ Using AI4Bharat Indic-TTS (Neural {lang_name} Voice)")
        
        # Prepare API request
        lang_full = self.INDIC_TTS_LANGUAGES[language]
        gender = self.VOICE_PREFERENCES.get(language, 'female')
        
        payload = {
            "input": [{"source": text}],
            "config": {
                "language": {
                    "sourceLanguage": lang_full
                },
                "gender": gender,
                "samplingRate": 22050
            }
        }
        
        headers = {
            "Content-Type": "application/json"
        }
        
        if INDIC_TTS_API_KEY:
            headers["Authorization"] = f"Bearer {INDIC_TTS_API_KEY}"
        
        # Make API call
        try:
            response = requests.post(INDIC_TTS_API, json=payload, headers=headers, timeout=10)
            response.raise_for_status()
            
            result = response.json()
            
            # Extract audio data (usually base64 encoded)
            if 'audio' in result:
                audio_data = base64.b64decode(result['audio'][0]['audioContent'])
            elif 'audioContent' in result:
                audio_data = base64.b64decode(result['audioContent'])
            else:
                raise Exception("No audio data in API response")
            
            # Play audio
            if HAS_PYGAME:
                # Save to temporary file
                with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_audio:
                    temp_audio.write(audio_data)
                    temp_path = temp_audio.name
                
                try:
                    pygame.mixer.music.load(temp_path)
                    pygame.mixer.music.play()
                    while pygame.mixer.music.get_busy():
                        pygame.time.Clock().tick(10)
                finally:
                    # Cleanup
                    try:
                        os.unlink(temp_path)
                    except:
                        pass
            
            return True
            
        except requests.exceptions.RequestException as e:
            print(f"⚠️ Indic-TTS API error: {e}")
            raise
        except Exception as e:
            print(f"⚠️ Indic-TTS processing error: {e}")
            raise

    def _speak_pyttsx3(self, text: str) -> bool:
        """Use pyttsx3 for English (offline, fast)."""
        print("🎙️ Using pyttsx3 (English)")
        self.pyttsx3_engine.say(text)
        self.pyttsx3_engine.runAndWait()
        return True

    def _speak_gtts(self, text: str, language: str = 'en') -> bool:
        """Use gTTS for all languages (requires internet, enhanced quality)."""
        lang_name = self.LANGUAGE_NAMES.get(language, language)
        
        # Use slow=True for Indian languages for BETTER CLARITY and pronunciation
        # This makes the voice clearer and easier to understand
        indian_languages = ['te', 'hi', 'ta', 'kn', 'ml', 'mr', 'gu', 'bn', 'or', 'pa']
        use_slow = language in indian_languages
        
        mode = "CLEAR/SLOW" if use_slow else "NORMAL"
        print(f"🎙️ Using gTTS ({lang_name} - {mode} mode for better quality)")
        
        # Use gTTS with slow=True for Indian languages
        tts = gTTS(text=text, lang=language, slow=use_slow)
        
        # Save to memory buffer
        audio_fp = io.BytesIO()
        tts.write_to_fp(audio_fp)
        audio_fp.seek(0)
        
        # Play using pygame
        if HAS_PYGAME:
            pygame.mixer.music.load(audio_fp, 'mp3')
            pygame.mixer.music.play()
            while pygame.mixer.music.get_busy():
                pygame.time.Clock().tick(10)
        
        return True

    def generate_audio_file(self, text: str, output_path: str, lang: Optional[str] = None) -> bool:
        """
        Generate audio file without playing it.
        Useful for caching common phrases.
        
        Args:
            text: Text to convert to speech
            output_path: Path to save audio file (.wav or .mp3)
            lang: Language code (overrides instance language if provided)
        
        Returns:
            True if successful
        """
        language = lang if lang else self.language
        
        try:
            if HAS_GTTS:
                # Use gTTS
                tts = gTTS(text=text, lang=language, slow=False)
                tts.save(output_path)
                return True
            return False
        except Exception as e:
            print(f"❌ Audio generation failed: {e}")
            return False


def get_tts_status() -> dict:
    """Get status of available TTS engines."""
    return {
        'gtts': HAS_GTTS,
        'pyttsx3': HAS_PYTTSX3,
        'pygame': HAS_PYGAME,
        'recommended': 'gTTS+pyttsx3' if (HAS_GTTS and HAS_PYTTSX3) else 'gTTS only' if HAS_GTTS else 'Limited'
    }


# Example usage
if __name__ == "__main__":
    print("🎙️ Testing Hybrid TTS System\n")
    
    status = get_tts_status()
    print("Available TTS engines:")
    for engine, available in status.items():
        status_icon = "✅" if available else "❌"
        print(f"  {status_icon} {engine.upper()}")
    
    print(f"\n📢 Recommended: {status['recommended']}\n")
    
    # Test Telugu with Indic-TTS (if available)
    print("Testing Telugu:")
    tts_te = HybridTTS(language='te')
    tts_te.speak("యూనివర్సిటీలో స్టూడెంట్స్‌కి లైబ్రరీ ఫెసిలిటీస్ ఉన్నాయి")
    
    # Test Hindi
    print("\nTesting Hindi:")
    tts_hi = HybridTTS(language='hi')
    tts_hi.speak("यूनिवर्सिटी में स्टूडेंट्स के लिए लाइब्रेरी है")
    
    # Test English
    print("\nTesting English:")
    tts_en = HybridTTS(language='en')
    tts_en.speak("Welcome to Vignan University")
