"""Check available TTS voices"""
import pyttsx3

engine = pyttsx3.init()
voices = engine.getProperty('voices')

print("\n=== AVAILABLE PYTTSX3 VOICES ===\n")
for i, voice in enumerate(voices):
    print(f"{i}: {voice.name}")
    print(f"   ID: {voice.id}")
    print(f"   Languages: {voice.languages if hasattr(voice, 'languages') else 'Not specified'}")
    print()
