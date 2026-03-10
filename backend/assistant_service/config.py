"""Configuration file for the Vignan RAG Agent.

CUSTOMIZE THIS FILE:
- Change DATA_PATH to point to your knowledge base JSON file
- Update MODEL_NAME if you want a different embedding model
- Adjust TOP_K for more/fewer search results
- Modify SUPPORTED_LANGUAGES to add/remove languages
"""

import os
from pathlib import Path

# =============================================================================
# DATA CONFIGURATION - CHANGE THIS FOR YOUR USE CASE
# =============================================================================

# Path to your knowledge base JSON file
# The JSON should have this structure:
# {
#   "university_name": "Your University",
#   "documents": [
#     {"id": "1", "category": "Category", "title": "Title", "content": "Content"},
#     ...
#   ]
# }
DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "vignan_university_dataset.json")

# =============================================================================
# MODEL CONFIGURATION
# =============================================================================

# SentenceTransformer model for embeddings
# Options: "all-MiniLM-L6-v2" (fast, smaller), "all-mpnet-base-v2" (slower, better)
MODEL_NAME = "all-MiniLM-L6-v2"

# Number of similar documents to retrieve for each query
TOP_K = 3

# =============================================================================
# LANGUAGE CONFIGURATION
# =============================================================================

# Supported languages with speech recognition codes
SUPPORTED_LANGUAGES = {
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

# Default language
DEFAULT_LANGUAGE = "english"

# =============================================================================
# VOICE SETTINGS
# =============================================================================

# Speech recognition timeout (seconds)
LISTEN_TIMEOUT = 8

# Maximum phrase duration (seconds)
PHRASE_TIME_LIMIT = 12

# Ambient noise adjustment duration (seconds)
NOISE_CALIBRATION_TIME = 1.5

# Maximum consecutive listen failures before auto-switching to text mode
MAX_LISTEN_FAILURES = 3

# =============================================================================
# GREETING SETTINGS
# =============================================================================

# Custom greeting message (leave empty for time-based greeting)
CUSTOM_GREETING = ""

# Lunch time reminder (set to None to disable)
LUNCH_REMINDER = {
    "start_hour": 12,  # 12 PM
    "end_hour": 16,    # 4 PM
    "message": "It's lunchtime; the boys hostel is serving lunch now."
}
