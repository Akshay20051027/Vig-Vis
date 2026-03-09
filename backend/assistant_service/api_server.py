"""Flask API server for the FAISS voice assistant."""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import json
import re
import tempfile
from pathlib import Path
from datetime import datetime
from deep_translator import GoogleTranslator
from gtts import gTTS

from src.query_engine import QueryEngine
from src.answer_generator import generate_answer

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# Initialize the RAG engine
engine = None
history_path = os.path.join(tempfile.gettempdir(), "web_assistant_history.json")

# Language mapping (matching voice_assistant.py)
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


_LEADING_TRAILING_PUNCT_RE = re.compile(r"^[\s\W_]+|[\s\W_]+$")
_WHITESPACE_RE = re.compile(r"\s+")
_FEE_CURRENCY_RE = re.compile(r"(₹|\binr\b|\brs\.?\b)\s*[\d,]+", re.IGNORECASE)
_FEE_NEAR_NUMBER_RE = re.compile(r"\bfee(?:s)?\b.{0,20}\b[\d,]{4,}\b", re.IGNORECASE)
_FEE_VARIANT_WORD_RE = re.compile(r"\b(fee|fees|pees|feez|fess)\b", re.IGNORECASE)
_FEE_STRUCTURE_WORD_RE = re.compile(r"\b(structure|stracture|stucture|struct)\b", re.IGNORECASE)


def _normalize_for_intent(text: str) -> str:
    """Normalize user input for intent checks (greeting/fee/etc.)."""
    if not text:
        return ""
    s = text.strip().lower()
    s = _WHITESPACE_RE.sub(" ", s)
    s = _LEADING_TRAILING_PUNCT_RE.sub("", s)
    return s


def _is_fee_query(normalized_text: str) -> bool:
    if not normalized_text:
        return False

    # Telugu ASR sometimes outputs fee/fees as "పీస్"/"పీజ్" (similar to "pees").
    # Only treat as a fee intent when it appears in a fee-structure-like context.
    if ("పీస్" in normalized_text or "పీజ్" in normalized_text) and (
        "స్ట్రక్చర్" in normalized_text or "structure" in normalized_text):
        return True

    # Common ASR/typing variations (especially when user speaks Telugu but ASR outputs English letters).
    # Examples seen in practice: "pees" (fee -> pee), "feez", "fess".
    if _FEE_VARIANT_WORD_RE.search(normalized_text):
        return True

    return any(
        phrase in normalized_text
        for phrase in [
            "fee structure",
            "fees structure",
            "tuition fee",
            "tuition fees",
            "hostel fee",
            "hostel fees",
            "fee details",
            "fee amount",
            # Common non-English tokens that often appear even after ASR.
            "फीस",
            "ఫీస్",
            "ఫీజ్",
            "ఫీజు",
            "ఫీజులు",
            "கட்டணம்",
            "ಫೀಸ್",
            "ഫീസ്",
        ]
    )



def _has_fee_amount_evidence(text: str) -> bool:
    """True if text appears to contain an actual fee amount (currency + number).

    We keep this intentionally strict to avoid presenting generic admissions info as "fee structure".
    """
    if not text:
        return False
    return bool(_FEE_CURRENCY_RE.search(text) or _FEE_NEAR_NUMBER_RE.search(text))


def _is_where_is_block_query(normalized_text: str) -> bool:
    if not normalized_text:
        return False
    return bool(re.search(r"\bwhere\s+is\b", normalized_text)) and bool(
        re.search(r"\b[a-z]\s*-?\s*block\b|\bu\s*-?\s*block\b", normalized_text)
    )


def _make_unknown_answer(normalized_text: str) -> str:
    if _is_fee_query(normalized_text):
        return (
            "I don't have the official Vignan fee structure details in my current knowledge base. "
            "For exact fee amounts (course-wise / year-wise), please check the official Vignan admissions website "
            "or contact the college admissions office."
        )
    return (
        "I’m not fully sure about that from my current campus knowledge base. "
        "You can ask me about blocks, labs/classrooms, hostels, library, and campus facilities."
    )


def make_natural_language(text, lang_code):
    """Post-process translations to make them more natural and conversational for all languages."""
    
    # Telugu - Mix Telugu + English (Tanglish) - Enhanced with more casual expressions
    if lang_code == "te":
        replacements = {
            # University/College terms
            "విజ్ఞాన్ విశ్వవిద్యాలయంలో": "విజ్ఞాన్ కాలేజీలో",
            "విశ్వవిద్యాలయం": "యూనివర్సిటీ",
            "విశ్వవిద్యాలయంలో": "యూనివర్సిటీలో",
            "కళాశాల": "కాలేజీ",
            
            # Fee/Payment terms
            "ఫీజు నిర్మాణం గురించిన సమాచారం": "ఫీజు డిటైల్స్",
            "ఫీజు నిర్మాణం": "ఫీజు స్ట్రక్చర్",
            "ఫీజులు": "ఫీస్",
            "చెల్లింపు": "పేమెంట్",
            "అవసరం": "కావాలి",
            
            # Information terms
            "గురించిన సమాచారం": "గురించి",
            "సమాచారం": "ఇన్ఫో",
            "వివరాలు": "డిటైల్స్",
            "వివరణాత్మక సమాచారం": "పూర్తి డిటైల్స్",
            "అందుబాటులో ఉంది": "దొరుకుతుంది",
            "అందుబాటులో": "అవైలబుల్",
            
            # Admission terms
            "ప్రవేశ ప్రక్రియ": "అడ్మిషన్ ప్రాసెస్",
            "ప్రవేశం": "అడ్మిషన్",
            "దరఖాస్తు": "అప్లికేషన్",
            "దరఖాస్తు చేసుకోవాలి": "అప్లై చేయాలి",
            "అధికారిక వెబ్‌సైట్ ద్వారా ఆన్‌లైన్‌లో దరఖాస్తు చేసుకోవాలి": "ఆఫీషియల్ వెబ్‌సైట్‌లో ఆన్‌లైన్ అప్లై చేయాలి",
            "దరఖాస్తులను సమీక్షిస్తుంది": "అప్లికేషన్స్ రివ్యూ చేస్తారు",
            
            # Exam/Merit terms
            "పారదర్శకంగా మరియు మెరిట్ ఆధారితంగా ఉంటుంది": "మెరిట్ బేస్ మీద జరుగుతుంది",
            "మెరిట్ ఆధారితంగా": "మెరిట్ బేస్ మీద",
            "జాతీయ మరియు రాష్ట్ర స్థాయి ప్రవేశ పరీక్షల": "నేషనల్ మరియు స్టేట్ లెవల్ ఎంట్రన్స్ ఎగ్జామ్స్",
            "పరీక్ష": "ఎగ్జామ్",
            "పరీక్షలు": "ఎగ్జామ్స్",
            "స్కోర్‌లను అంగీకరిస్తుంది": "స్కోర్స్ తీసుకుంతారు",
            "స్కోర్లు": "స్కోర్స్",
            "మార్కులు": "మార్క్స్",
            
            # Eligibility/Document terms
            "అర్హత ప్రమాణాలను తనిఖీ చేయాలి": "ఎలిజిబిలిటీ చెక్ చేసుకోవాలి",
            "అర్హత": "ఎలిజిబిలిటీ",
            "అవసరమైన పత్రాలను సిద్ధం చేయాలి": "డాక్యుమెంట్స్ రెడీ చేసుకోవాలి",
            "పత్రాలు": "డాక్యుమెంట్స్",
            "ప్రమాణపత్రాలు": "సర్టిఫికేట్స్",
            
            # Counseling/Selection terms
            "అర్హులైన అభ్యర్థులకు కౌన్సెలింగ్ నిర్వహిస్తుంది": "ఎలిజిబుల్ స్టూడెంట్స్‌కి కౌన్సెలింగ్ ఉంటుంది",
            "అభ్యర్థులు": "క్యాండిడేట్స్",
            "మెరిట్, ప్రాధాన్యతల ఆధారంగా సీట్లు కేటాయిస్తారు": "మెరిట్ మరియు ప్రిఫరెన్స్ ప్రకారం సీట్లు ఇస్తారు",
            "ప్రాధాన్యత": "ప్రిఫరెన్స్",
            "ఎంపిక": "సెలెక్షన్",
            
            # People terms
            "విద్యార్థులకు": "స్టూడెంట్స్‌కి",
            "విద్యార్థులు": "స్టూడెంట్స్",
            "సిబ్బందికి": "స్టాఫ్‌కి",
            "ఉపాధ్యాయులు": "టీచర్స్",
            "ప్రొఫెసర్లు": "ప్రొఫెసర్స్",
            
            # Facilities/Services terms
            "సౌకర్యంగా ఉండేలా చేస్తుంది": "రీజనబుల్‌గా ఉంటుంది",
            "సౌకర్యాలు": "ఫెసిలిటీస్",
            "సేవలు": "సర్వీసెస్",
            "అద్భుతమైన సేవలను అందిస్తుంది": "మంచి సర్వీసెస్ అందిస్తుంది",
            "గ్రంథాలయం": "లైబ్రరీ",
            "వసతి గృహం": "హాస్టల్",
            "ప్రయోగశాల": "ల్యాబ్",
            "ప్రయోగశాలలు": "ల్యాబ్స్",
            
            # Time/Process terms
            "ప్రక్రియ": "ప్రాసెస్",
            "సమయం": "టైం",
            "తేదీ": "డేట్",
            "షెడ్యూల్": "షెడ్యూల్",
            "నమోదు": "రిజిస్ట్రేషన్",
            
            # Quality/Description terms
            "అద్భుతమైన": "బాగుంది",
            "అత్యుత్తమ": "బెస్ట్",
            "అందమైన": "బ్యూటిఫుల్",
            "ఆధునిక": "మోడర్న్",
            "విస్తృతమైన": "లార్జ్",
            
            # Common verbs
            "అందిస్తుంది": "ఇస్తారు",
            "కలిగి ఉంది": "ఉంది",
            "చేస్తుంది": "చేస్తారు",
            "తెలియజేస్తుంది": "చెప్తారు",
        }
    
    # Hindi - Hinglish style - Enhanced with more casual expressions
    elif lang_code == "hi":
        replacements = {
            # University/College terms
            "विग्नन विश्वविद्यालय में": "विग्नन यूनिवर्सिटी में",
            "विश्वविद्यालय": "यूनिवर्सिटी",
            "महाविद्यालय": "कॉलेज",
            
            # Fee/Payment terms
            "शुल्क संरचना के बारे में जानकारी": "फीस डिटेल्स",
            "शुल्क संरचना": "फीस स्ट्रक्चर",
            "शुल्क": "फीस",
            "भुगतान": "पेमेंट",
            "आवश्यक": "जरूरी",
            
            # Information terms
            "के बारे में जानकारी": "के बारे में",
            "जानकारी": "इन्फो",
            "विवरण": "डिटेल्स",
            "विस्तृत जानकारी": "पूरी डिटेल्स",
            "उपलब्ध": "अवेलेबल",
            
            # Admission terms
            "प्रवेश प्रक्रिया": "एडमिशन प्रोसेस",
            "प्रवेश": "एडमिशन",
            "आवेदन": "अप्लीकेशन",
            "आवेदन करें": "अप्लाई करें",
            "आधिकारिक वेबसाइट के माध्यम से ऑनलाइन आवेदन करें": "ऑफिशियल वेबसाइट पर ऑनलाइन अप्लाई करें",
            "आधिकारिक": "ऑफिशियल",
            
            # Exam/Merit terms
            "पारदर्शी और योग्यता आधारित": "मेरिट बेस पर",
            "योग्यता आधारित": "मेरिट बेस पर",
            "राष्ट्रीय और राज्य स्तरीय प्रवेश परीक्षाओं": "नेशनल और स्टेट लेवल एंट्रेंस एग्जाम्स",
            "परीक्षा": "एग्जाम",
            "परीक्षाएं": "एग्जाम्स",
            "अंक": "मार्क्स",
            "स्कोर": "स्कोर",
            
            # Eligibility/Document terms
            "पात्रता मानदंड जांचें": "एलिजिबिलिटी चेक करें",
            "पात्रता": "एलिजिबिलिटी",
            "आवश्यक दस्तावेज तैयार करें": "डॉक्यूमेंट्स रेडी करें",
            "दस्तावेज": "डॉक्यूमेंट्स",
            "प्रमाण पत्र": "सर्टिफिकेट",
            "प्रमाण पत्र": "सर्टिफिकेट्स",
            
            # Counseling/Selection terms
            "परामर्श": "काउंसलिंग",
            "उम्मीदवारों": "कैंडिडेट्स",
            "चयन": "सिलेक्शन",
            "वरीयता": "प्रिफरेंस",
            
            # People terms
            "छात्रों के लिए": "स्टूडेंट्स के लिए",
            "छात्र": "स्टूडेंट्स",
            "कर्मचारियों के लिए": "स्टाफ के लिए",
            "शिक्षकों": "टीचर्स",
            "प्रोफेसरों": "प्रोफेसर्स",
            
            # Facilities/Services terms
            "सुविधाएं": "फैसिलिटीज",
            "सेवाएं": "सर्विसेज",
            "पुस्तकालय": "लाइब्रेरी",
            "छात्रावास": "हॉस्टल",
            "प्रयोगशाला": "लैब",
            "प्रयोगशालाओं": "लैब्स",
            
            # Time/Process terms
            "प्रक्रिया": "प्रोसेस",
            "समय": "टाइम",
            "तारीख": "डेट",
            "अनुसूची": "शेड्यूल",
            "पंजीकरण": "रजिस्ट्रेशन",
            
            # Quality/Description terms
            "उत्कृष्ट": "बेस्ट",
            "आधुनिक": "मॉडर्न",
            "विशाल": "लार्ज",
            "सुंदर": "ब्यूटीफुल",
            
            # Common verbs
            "प्रदान करता है": "देता है",
            "उपलब्ध कराता है": "देता है",
        }
    
    # Tamil - Tanglish style - Enhanced with more casual expressions
    elif lang_code == "ta":
        replacements = {
            # University/College terms
            "விக்னன் பல்கலைக்கழகத்தில்": "விக்னன் கல்லூரியில்",
            "பல்கலைக்கழகம்": "யூனிவர்சிட்டி",
            "கல்லூரி": "காலேஜ்",
            
            # Fee/Payment terms
            "கட்டண அமைப்பு பற்றிய தகவல்": "ஃபீஸ் டீடெய்ல்ஸ்",
            "கட்டண அமைப்பு": "ஃபீஸ் ஸ்ட்ரக்சர்",
            "கட்டணம்": "ஃபீஸ்",
            "செலுத்துதல்": "பேமண்ட்",
            
            # Information terms
            "பற்றிய தகவல்": "பற்றி",
            "தகவல்": "இன்ஃபோ",
            "விவரங்கள்": "டீடெய்ல்ஸ்",
            "கிடைக்கும்": "அவைலபிள்",
            
            # Admission terms
            "சேர்க்கை செயல்முறை": "அட்மிஷன் ப்ராசஸ்",
            "சேர்க்கை": "அட்மிஷன்",
            "விண்ணப்பம்": "அப்ளிகேஷன்",
            "அதிகாரப்பூர்வ": "ஆஃபிஷியல்",
            
            # Exam/Merit terms
            "தகுதி அடிப்படையில்": "மெரிட் பேஸ்ல",
            "நுழைவுத் தேர்வுகள்": "என்ட்ரன்ஸ் எக்ஸாம்ஸ்",
            "தேர்வு": "எக்ஸாம்",
            "மதிப்பெண்கள்": "மார்க்ஸ்",
            
            # Eligibility/Document terms
            "தகுதி": "எலிஜிபிலிட்டி",
            "ஆவணங்கள்": "டாகுமெண்ட்ஸ்",
            "சான்றிதழ்கள்": "சர்டிஃபிகேட்ஸ்",
            
            # Counseling/Selection terms
            "ஆலோசனை": "கவுன்சலிங்",
            "வேட்பாளர்கள்": "கேண்டிடேட்ஸ்",
            "தேர்வு": "செலக்ஷன்",
            "முன்னுரிமை": "ப்ரிஃபரன்ஸ்",
            
            # People terms
            "மாணவர்களுக்கு": "ஸ்டூடண்ட்ஸ்க்கு",
            "மாணவர்கள்": "ஸ்டூடண்ட்ஸ்",
            "ஊழியர்களுக்கு": "ஸ்டாஃப்க்கு",
            "ஆசிரியர்கள்": "டீச்சர்ஸ்",
            "பேராசிரியர்கள்": "ப்ராபஸர்ஸ்",
            
            # Facilities/Services terms
            "வசதிகள்": "ஃபசிலிட்டீஸ்",
            "சேவைகள்": "சர்வீஸஸ்",
            "நூலகம்": "லைப்ரரி",
            "விடுதி": "ஹாஸ்டல்",
            "ஆய்வகம்": "லேப்",
            "ஆய்வகங்கள்": "லேப்ஸ்",
            
            # Time/Process terms
            "செயல்முறை": "ப்ராசஸ்",
            "நேரம்": "டைம்",
            "தேதி": "டேட்",
            "அட்டவணை": "ஷெட்யூல்",
            "பதிவு": "ரெஜிஸ்ட்ரேஷன்",
            
            # Quality/Description terms
            "சிறந்த": "பெஸ்ட்",
            "நவீன": "மாடர்ன்",
            "பெரிய": "லார்ஜ்",
            "அழகான": "ப்யூட்டிஃபுள்",
        }
    
    # Kannada - Kanglish style - Enhanced with more casual expressions
    elif lang_code == "kn":
        replacements = {
            # University/College terms
            "ವಿಗ್ನನ್ ವಿಶ್ವವಿದ್ಯಾಲಯದಲ್ಲಿ": "ವಿಗ್ನನ್ ಕಾಲೇಜಿನಲ್ಲಿ",
            "ವಿಶ್ವವಿದ್ಯಾಲಯ": "ಯೂನಿವರ್ಸಿಟಿ",
            "ಕಾಲೇಜು": "ಕಾಲೇಜ್",
            
            # Fee/Payment terms
            "ಶುಲ್ಕ ರಚನೆಯ ಬಗ್ಗೆ ಮಾಹಿತಿ": "ಫೀಸ್ ಡಿಟೇಲ್ಸ್",
            "ಶುಲ್ಕ ರಚನೆ": "ಫೀಸ್ ಸ್ಟ್ರಕ್ಚರ್",
            "ಶುಲ್ಕ": "ಫೀಸ್",
            "ಪಾವತಿ": "ಪೇಮೆಂಟ್",
            
            # Information terms
            "ಬಗ್ಗೆ ಮಾಹಿತಿ": "ಬಗ್ಗೆ",
            "ಮಾಹಿತಿ": "ಇನ್ಫೋ",
            "ವಿವರಗಳು": "ಡಿಟೇಲ್ಸ್",
            "ಲಭ್ಯವಿದೆ": "ಅವೈಲಬಲ್",
            
            # Admission terms
            "ಪ್ರವೇಶ ಪ್ರಕ್ರಿಯೆ": "ಅಡ್ಮಿಷನ್ ಪ್ರಾಸೆಸ್",
            "ಪ್ರವೇಶ": "ಅಡ್ಮಿಷನ್",
            "ಅರ್ಜಿ": "ಅಪ್ಲಿಕೇಶನ್",
            "ಅಧಿಕೃತ": "ಆಫೀಷಿಯಲ್",
            
            # Exam/Merit terms
            "ಅರ್ಹತೆ ಆಧಾರದ ಮೇಲೆ": "ಮೆರಿಟ್ ಬೇಸ್ ಮೇಲೆ",
            "ಪ್ರವೇಶ ಪರೀಕ್ಷೆಗಳು": "ಎಂಟ್ರನ್ಸ್ ಎಗ್ಜಾಮ್ಸ್",
            "ಪರೀಕ್ಷೆ": "ಎಗ್ಜಾಮ್",
            "ಅಂಕಗಳು": "ಮಾರ್ಕ್ಸ್",
            
            # Eligibility/Document terms
            "ಅರ್ಹತೆ": "ಎಲಿಜಿಬಿಲಿಟಿ",
            "ದಾಖಲೆಗಳು": "ಡಾಕ್ಯುಮೆಂಟ್ಸ್",
            "ಪ್ರಮಾಣಪತ್ರಗಳು": "ಸರ್ಟಿಫಿಕೇಟ್ಸ್",
            
            # Counseling/Selection terms
            "ಸಲಹೆ": "ಕೌನ್ಸಲಿಂಗ್",
            "ಅಭ್ಯರ್ಥಿಗಳು": "ಕ್ಯಾಂಡಿಡೇಟ್ಸ್",
            "ಆಯ್ಕೆ": "ಸೆಲೆಕ್ಷನ್",
            "ಆದ್ಯತೆ": "ಪ್ರಿಫರೆನ್ಸ್",
            
            # People terms
            "ವಿದ್ಯಾರ್ಥಿಗಳಿಗೆ": "ಸ್ಟೂಡೆಂಟ್ಸ್‌ಗೆ",
            "ವಿದ್ಯಾರ್ಥಿಗಳು": "ಸ್ಟೂಡೆಂಟ್ಸ್",
            "ಸಿಬ್ಬಂದಿಗೆ": "ಸ್ಟಾಫ್‌ಗೆ",
            "ಶಿಕ್ಷಕರು": "ಟೀಚರ್ಸ್",
            "ಪ್ರಾಧ್ಯಾಪಕರು": "ಪ್ರೊಫೆಸರ್ಸ್",
            
            # Facilities/Services terms
            "ಸೌಲಭ್ಯಗಳು": "ಫೆಸಿಲಿಟೀಸ್",
            "ಸೇವೆಗಳು": "ಸರ್ವಿಸಸ್",
            "ಗ್ರಂಥಾಲಯ": "ಲೈಬ್ರರಿ",
            "ವಸತಿ ನಿಲಯ": "ಹಾಸ್ಟೆಲ್",
            "ಪ್ರಯೋಗಾಲಯ": "ಲ್ಯಾಬ್",
            "ಪ್ರಯೋಗಾಲಯಗಳು": "ಲ್ಯಾಬ್ಸ್",
            
            # Time/Process terms
            "ಪ್ರಕ್ರಿಯೆ": "ಪ್ರಾಸೆಸ್",
            "ಸಮಯ": "ಟೈಮ್",
            "ದಿನಾಂಕ": "ಡೇಟ್",
            "ವೇಳಾಪಟ್ಟಿ": "ಷೆಡ್ಯೂಲ್",
            "ನೋಂದಣಿ": "ರೆಜಿಸ್ಟ್ರೇಶನ್",
            
            # Quality/Description terms
            "ಅತ್ಯುತ್ತಮ": "ಬೆಸ್ಟ್",
            "ಆಧುನಿಕ": "ಮಾಡರ್ನ್",
            "ದೊಡ್ಡ": "ಲಾರ್ಜ್",
            "ಸುಂದರ": "ಬ್ಯೂಟಿಫುಲ್",
        }
    
    # Malayalam - Manglish style - Enhanced with more casual expressions
    elif lang_code == "ml":
        replacements = {
            # University/College terms
            "വിഗ്നൻ സർവകലാശാലയിൽ": "വിഗ്നൻ കോളേജിൽ",
            "സർവകലാശാല": "യൂണിവേഴ്സിറ്റി",
            "കോളേജ്": "കോളേജ്",
            
            # Fee/Payment terms
            "ഫീസ് ഘടനയെക്കുറിച്ചുള്ള വിവരങ്ങൾ": "ഫീസ് ഡീറ്റെയിൽസ്",
            "ഫീസ് ഘടന": "ഫീസ് സ്ട്രക്ചർ",
            "ഫീസ്": "ഫീസ്",
            "പേയ്മെന്റ്": "പേമെന്റ്",
            
            # Information terms
            "കുറിച്ചുള്ള വിവരങ്ങൾ": "കുറിച്ച്",
            "വിവരങ്ങൾ": "ഇൻഫോ",
            "വിശദാംശങ്ങൾ": "ഡീറ്റെയിൽസ്",
            "ലഭ്യമാണ്": "അവൈലബിൾ",
            
            # Admission terms
            "പ്രവേശന പ്രക്രിയ": "അഡ്മിഷൻ പ്രോസസ്",
            "പ്രവേശനം": "അഡ്മിഷൻ",
            "അപേക്ഷ": "അപ്ലിക്കേഷൻ",
            "ഔദ്യോഗിക": "ഓഫീഷ്യൽ",
            
            # Exam/Merit terms
            "യോഗ്യത അടിസ്ഥാനത്തിൽ": "മെറിറ്റ് ബേസിസിൽ",
            "പ്രവേശന പരീക്ഷകൾ": "എൻട്രൻസ് എഗ്സാമുകൾ",
            "പരീക്ഷ": "എഗ്സാം",
            "മാർക്കുകൾ": "മാർക്ക്സ്",
            
            # Eligibility/Document terms
            "യോഗ്യത": "എലിജിബിലിറ്റി",
            "രേഖകൾ": "ഡോക്യുമെന്റ്സ്",
            "സർട്ടിഫിക്കറ്റുകൾ": "സർട്ടിഫിക്കറ്റ്സ്",
            
            # Counseling/Selection terms
            "കൗൺസലിംഗ്": "കൗൺസിലിംഗ്",
            "ഉദ്യോഗാർത്ഥികൾ": "കാൻഡിഡേറ്റ്സ്",
            "തിരഞ്ഞെടുപ്പ്": "സെലക്ഷൻ",
            "മുൻഗണന": "പ്രിഫറൻസ്",
            
            # People terms
            "വിദ്യാർത്ഥികൾക്ക്": "സ്റ്റൂഡന്റ്സിന്",
            "വിദ്യാർത്ഥികൾ": "സ്റ്റൂഡന്റ്സ്",
            "ജീവനക്കാർക്ക്": "സ്റ്റാഫിന്",
            "അധ്യാപകർ": "ടീച്ചർസ്",
            "പ്രൊഫസർമാർ": "പ്രൊഫസർസ്",
            
            # Facilities/Services terms
            "സൗകര്യങ്ങൾ": "ഫെസിലിറ്റീസ്",
            "സേവനങ്ങൾ": "സർവീസസ്",
            "ലൈബ്രറി": "ലൈബ്രറി",
            "ഹോസ്റ്റൽ": "ഹോസ്റ്റൽ",
            "ലബോറട്ടറി": "ലാബ്",
            "ലബോറട്ടറികൾ": "ലാബുകൾ",
            
            # Time/Process terms
            "പ്രക്രിയ": "പ്രോസസ്",
            "സമയം": "ടൈം",
            "തീയതി": "ഡേറ്റ്",
            "ഷെഡ്യൂൾ": "ഷെഡ്യൂൾ",
            "രജിസ്ട്രേഷൻ": "രജിസ്ട്രേഷൻ",
            
            # Quality/Description terms
            "മികച്ച": "ബെസ്റ്റ്",
            "ആധുനിക": "മോഡേൺ",
            "വലിയ": "ലാർജ്",
            "മനോഹരമായ": "ബ്യൂട്ടിഫുൾ",
        }
    
    else:
        return text  # No processing for other languages
    
    result = text
    for formal, casual in replacements.items():
        result = result.replace(formal, casual)
    
    return result


def translate_text(text, target_lang_code):
    """Translate text to target language using GoogleTranslator (matching voice_assistant.py)."""
    try:
        if target_lang_code == "en":
            return text  # No translation needed for English
        
        translated = GoogleTranslator(source='en', target=target_lang_code).translate(text)
        
        # Post-process to make more natural
        translated = make_natural_language(translated, target_lang_code)
        
        return translated
    except Exception as e:
        print(f"⚠️ Translation failed: {e}")
        return text  # Return original text if translation fails


def time_greeting(now=None):
    """Generate time-based greeting with lunch notification."""
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
    return f"{greet}! Welcome to Mahotsav-26 Campus Assistant.{extra}"


def get_natural_greeting(lang_code, now=None):
    """Get natural conversational greeting in any language."""
    now = now or datetime.now()
    hour = now.hour
    
    # Telugu
    if lang_code == 'te':
        if 5 <= hour < 12:
            greet = "శుభోదయం"
        elif 12 <= hour < 17:
            greet = "నమస్కారం"
        elif 17 <= hour < 22:
            greet = "శుభ సాయంత్రం"
        else:
            greet = "హలో"
        extra = " లంచ్ టైమ్, బాయ్స్ హాస్టల్‌లో లంచ్ రెడీ అయ్యింది." if 12 <= hour < 16 else ""
        return f"{greet}! మహోత్సవ్-26 క్యాంపస్ అసిస్టెంట్‌కి స్వాగతం.{extra}"
    
    # Hindi
    elif lang_code == 'hi':
        if 5 <= hour < 12:
            greet = "सुप्रभात"
        elif 12 <= hour < 17:
            greet = "नमस्ते"
        elif 17 <= hour < 22:
            greet = "शुभ संध्या"
        else:
            greet = "हैलो"
        extra = " लंच टाइम है, बॉयज हॉस्टल में लंच रेडी है।" if 12 <= hour < 16 else ""
        return f"{greet}! महोत्सव-26 कैंपस असिस्टेंट में आपका स्वागत है।{extra}"
    
    # Tamil
    elif lang_code == 'ta':
        if 5 <= hour < 12:
            greet = "காலை வணக்கம்"
        elif 12 <= hour < 17:
            greet = "வணக்கம்"
        elif 17 <= hour < 22:
            greet = "மாலை வணக்கம்"
        else:
            greet = "ஹலோ"
        extra = " லஞ்ச் டைம், பாய்ஸ் ஹாஸ்டலில் லஞ்ச் ரெடியாகிவிட்டது." if 12 <= hour < 16 else ""
        return f"{greet}! மஹோத்ஸவ்-26 கேம்பஸ் அசிஸ்டெண்ட்-க்கு வரவேற்கிறோம்.{extra}"
    
    # Kannada
    elif lang_code == 'kn':
        if 5 <= hour < 12:
            greet = "ಶುಭೋದಯ"
        elif 12 <= hour < 17:
            greet = "ನಮಸ್ಕಾರ"
        elif 17 <= hour < 22:
            greet = "ಶುಭ ಸಂಜೆ"
        else:
            greet = "ಹಲೋ"
        extra = " ಲಂಚ್ ಟೈಮ್, ಬಾಯ್ಸ್ ಹಾಸ್ಟಲ್‌ನಲ್ಲಿ ಲಂಚ್ ಸಿದ್ಧವಾಗಿದೆ." if 12 <= hour < 16 else ""
        return f"{greet}! ಮಹೋತ್ಸವ್-26 ಕ್ಯಾಂಪಸ್ ಅಸಿಸ್ಟೆಂಟ್‌ಗೆ ಸ್ವಾಗತ.{extra}"
    
    # Malayalam
    elif lang_code == 'ml':
        if 5 <= hour < 12:
            greet = "ശുഭോദയം"
        elif 12 <= hour < 17:
            greet = "നമസ്കാരം"
        elif 17 <= hour < 22:
            greet = "ശുഭ സന്ധ്യ"
        else:
            greet = "ഹലോ"
        extra = " ലഞ്ച് ടൈം, ബോയ്സ് ഹോസ്റ്റലിൽ ലഞ്ച് തയ്യാറായി." if 12 <= hour < 16 else ""
        return f"{greet}! മഹോത്സവ്-26 കാമ്പസ് അസിസ്റ്റന്റിലേക്ക് സ്വാഗതം.{extra}"
    
    # Default: use translation
    else:
        greeting_en = time_greeting(now)
        return translate_text(greeting_en, lang_code)


def get_natural_telugu_greeting(now=None):
    """Get natural conversational Telugu greeting (kept for backward compatibility)."""
    return get_natural_greeting('te', now)
    now = now or datetime.now()
    hour = now.hour
    if 5 <= hour < 12:
        greet = "శుభోదయం"  # Good morning
    elif 12 <= hour < 17:
        greet = "నమస్కారం"  # Good afternoon/Hello
    elif 17 <= hour < 22:
        greet = "శుభ సాయంత్రం"  # Good evening
    else:
        greet = "హలో"  # Hello
    
    extra = ""
    if 12 <= hour < 16:
        extra = " లంచ్ టైమ్, బాయ్స్ హాస్టల్‌లో లంచ్ రెడీ అయ్యింది."
    
    return f"{greet}! మహోత్సవ్-26 క్యాంపస్ అసిస్టెంట్‌కి స్వాగతం.{extra}"


def save_history(query, response):
    """Save query-response history to temp file."""
    try:
        record = {"ts": datetime.now().isoformat(), "query": query, "response": response}
        data = []
        if os.path.exists(history_path):
            try:
                with open(history_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception:
                data = []
        data.append(record)
        with open(history_path, "w", encoding="utf-8") as f:
            json.dump(data[-200:], f, indent=2)  # Keep last 200 interactions
    except Exception as e:
        print(f"Warning: Could not save history: {e}")


def initialize_engine():
    """Initialize the QueryEngine with the dataset."""
    global engine
    data_path = Path(__file__).parent / "data" / "vignan_university_dataset.json"
    
    if not data_path.exists():
        # Try knowledge.json as fallback
        data_path = Path(__file__).parent / "data" / "knowledge.json"
    
    if not data_path.exists():
        raise FileNotFoundError(f"Dataset not found at {data_path}")
    
    print(f"Loading dataset from {data_path}...")
    engine = QueryEngine(model_name="all-MiniLM-L6-v2", top_k=3)
    chunks = engine.ingest_json(str(data_path))
    engine.index_chunks(chunks)
    print(f"✅ Indexed {len(chunks)} knowledge chunks")
    
    # CRITICAL: Warm up the model with a dummy query
    # First query is always slower and can give inconsistent results
    # This ensures the embedding model is fully initialized
    print("🔥 Warming up FAISS index with test query...")
    warmup_result = engine.ask("What is Vignan University?")
    print(f"✅ Warmup complete. Model ready for queries.")
    print(f"   (Warmup result preview: {warmup_result[:50]}...)")



@app.route('/api/assistant/query', methods=['POST'])
def query():
    """Handle text queries from the frontend with smart greeting detection."""
    try:
        data = request.json
        question = data.get('question', '').strip()
        language = data.get('language', 'en-IN')  # Speech recognition language code
        
        print(f"\n{'='*60}")
        print(f"🎤 RECEIVED QUERY FROM FRONTEND:")
        print(f"   Language code: {language}")
        print(f"   Question (first 80 chars): {question[:80]}")
        print(f"{'='*60}")
        
        if not question:
            return jsonify({'error': 'No question provided'}), 400
        
        # Reject very short questions (likely incomplete voice input)
        # Keep this permissive so common greetings like "hi"/"gm" are not blocked.
        if len(question.strip()) < 2:
            return jsonify({
                'error': 'Question too short. Please ask a complete question.',
                'success': False
            }), 400
        
        if engine is None:
            return jsonify({'error': 'Engine not initialized'}), 500
        
        # Get translation language code (handle both 'en' and 'en-IN' formats)
        if language not in LANGUAGES:
            # If language is just 'en', 'te', etc., convert to full format
            if language in ['en', 'hi', 'te', 'ta', 'kn', 'ml', 'mr', 'bn', 'gu']:
                language = f"{language}-IN"
            else:
                language = 'en-IN'  # Default fallback
        
        lang_info = LANGUAGES[language]
        translation_code = lang_info['code']
        lang_name = lang_info['name']
        
        print(f"🔤 LANGUAGE LOOKUP:")
        print(f"   Language code normalized: {language}")
        print(f"   Language name: {lang_name}")
        print(f"   Translation code: {translation_code}")
        print(f"{'='*60}\n")
        
        # Normalize query
        lowered = question.lower().strip()
        normalized = _normalize_for_intent(question)
        
        # PRIORITY 1: Handle lab/classroom navigation requests (simple selection only)
        # If the query asks for INFORMATION about labs (facilities, equipment, etc.), route to FAISS instead
        lab_keywords = ["lab", "labs", "laboratory", "లాబ", "ల్యాబ", 
                       "प्रयोगशाला", "लैब", "ஆய்வகம்", "ಲ್ಯಾಬ್", "ലാബ്"]
        classroom_keywords = ["classroom", "classrooms", "class room", "క్లాస", "క్లాసు", "రూమ",
                             "कक्षा", "क्लास", "வகுப்பறை", "கிளாஸ்", "ತರಗತಿ", "ക്ലാസ്"]
        
        # Keywords that indicate detailed information request (should go to FAISS + show options)
        info_keywords = ["about", "facility", "facilities", "equipment", "tell", "what is", "what are", 
                        "how", "when", "where", "which", "describe", "explain",
                        "rules", "safety", "software", "tools", "timing", "access", "available",
                        "have", "has", "contain", "include", "provide", "offer",
                        "గురించి", "సౌకర్యాలు", "పరికరాలు", "ఎలా", "ఎప్పుడు", "ఎక్కడ", "ఏమి",
                        "के बारे में", "सुविधाएं", "उपकरण", "कैसे", "कब", "कहाँ", "क्या"]
        
        # Words that indicate ONLY navigation/selection request (no FAISS info needed)
        show_keywords = ["show", "display", "see", "view", "list", "చూపించు", "दिखाओ", "ప్రదర్శించు"]
        
        # Check if this is an information query about labs
        # If asking about facilities/equipment etc, show BOTH FAISS answer AND lab options
        is_show_request = any(keyword in lowered for keyword in show_keywords)
        is_info_query = any(keyword in lowered for keyword in info_keywords)
        
        # Special case: if ONLY "show" with no info words, it's simple navigation
        is_simple_show = is_show_request and not is_info_query
        
        # More flexible matching - check if any keyword appears in the question
        is_lab_query = any(keyword.lower() in lowered or keyword in question for keyword in lab_keywords)
        is_classroom_query = any(keyword.lower() in lowered or keyword in question for keyword in classroom_keywords)
        
        # Handle lab/classroom queries:
        # - Simple "show" requests → lab_selection only
        # - Info queries about infrastructure → FAISS answer + lab selection (BOTH)
        if is_lab_query or is_classroom_query:
            query_type = "labs" if is_lab_query else "classrooms"
            
            # Define lab/classroom options (all default to A-block for now)
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
            
            # If it's an info query (about facilities, equipment, etc.), get FAISS answer AND show options
            # OR if it's not a simple "show" request, provide info + options
            print(f"\n🔍 LAB ROUTING DEBUG:")
            print(f"   is_show_request: {is_show_request}")
            print(f"   is_info_query: {is_info_query}")
            print(f"   is_simple_show: {is_simple_show}")
            print(f"   Condition (is_info_query or not is_simple_show): {is_info_query or not is_simple_show}")
            
            if is_info_query or not is_simple_show:
                print(f"   ✅ Returning COMBINED_RESPONSE (FAISS + lab grid)\n")
                # Translate question to English for RAG
                english_question = question
                if translation_code != 'en':
                    try:
                        print(f"Translating {lang_name} question to English: {question}")
                        english_question = GoogleTranslator(source=translation_code, target='en').translate(question)
                        print(f"English translation: {english_question}")
                    except Exception as e:
                        print(f"⚠️ Question translation failed: {e}, using original")
                
                # Get FAISS answer
                print(f"   🔍 FAISS Query: '{english_question}'")
                answer = engine.ask(english_question)
                print(f"   📝 RAG answer (first 150 chars): {answer[:150]}...")

                
                # Translate answer
                translated_answer = translate_text(answer, translation_code)
                
                save_history(question, answer)
                
                # Return BOTH FAISS answer AND lab selection options
                return jsonify({
                    'question': question,
                    'answer': answer,
                    'translated_answer': translated_answer,
                    'query_type': query_type,
                    'options': options[query_type],
                    'language': language,
                    'language_name': lang_name,
                    'success': True,
                    'type': 'combined_response'  # New type: FAISS + lab selection
                })
            # If we reach here, it's explicitly asking to "show" without info questions
            # This case should rarely happen now since most queries will get combined response
            # Only pure "show me labs" with nothing else will reach here
            print(f"   ℹ️ Returning LAB_SELECTION only (no FAISS)\n")
            return jsonify({
                'question': question,
                'query_type': query_type,
                'options': options[query_type],
                'language': language,
                'language_name': lang_name,
                'success': True,
                'type': 'lab_selection'
            })
        
        # CRITICAL: Ensure Vignan/college queries ALWAYS go to FAISS (not caught by greetings)
        vignan_keywords = ["vignan", "విజ్ఞాన్", "विग्नन", "விக்னன்", "ವಿಗ್ನನ್", "വിഗ്നൻ",
                          "college", "university", "కాలేజీ", "यूनिवर्सिटी", "fee", "fees", "feez", "fess", "pees", "peez", "ఫీజ్", "फीस",
                          "hostel", "హాస్టల్", "library", "లైబ్రరీ", "campus", "క్యాంపస్"]
        
        is_vignan_query = any(keyword in lowered or keyword in question for keyword in vignan_keywords)
        
        # Handle greetings (only if NOT a Vignan query)
        greeting_words = {
            # English
            "hi", "hello", "hey", "hiya", "howdy", "greetings", "good day",
            "good morning", "good afternoon", "good evening", "good night",
            "gm", "ga", "ge", "gn",
            "hi there", "hello there", "hey there",
            "yo", "sup", "whats up", "what's up",
            # Telugu
            "హలో", "హాయ్", "హాయ్ అక్కడ", "నమస్కారం", "నమస్తే",
            "namaskaram", "namasthe", "namaste",
            # Hindi  
            "नमस्ते", "नमस्कार", "हैलो", "हाय", "सुप्रभात", "शुभ दोपहर", "शुभ संध्या",
            "namaste", "namaskar",
            # Tamil
            "வணக்கம்", "vanakkam", "வணக்கம", "ஹலோ", "ஹாய்",
            # Kannada
            "ನಮಸ್ಕಾರ", "namaskara", "ಹಲೋ", "ಹಾಯ್",
            # Malayalam
            "നമസ്കാരം", "namaskaram", "ഹലോ", "ഹായ്",
            # Other
            "hola", "salaam", "salam", "assalamualaikum", "as-salamu alaykum"
        }
        
        # Check if the query is ONLY a greeting (and not asking about Vignan)
        # Be tolerant to punctuation like "hi!" and small fillers like "hi there".
        tokens = normalized.split() if normalized else []
        normalized_phrase2 = " ".join(tokens[:2]) if len(tokens) >= 2 else normalized

        is_greeting = (
            (not is_vignan_query)
            and tokens
            and (
                normalized in greeting_words
                or normalized_phrase2 in greeting_words
                or (tokens[0] in greeting_words and len(tokens) <= 3)
            )
        )
        
        if is_greeting:
            # Prefer responding with the same style of greeting the user used.
            if translation_code == 'en':
                if normalized_phrase2 in {"good morning", "good afternoon", "good evening"}:
                    greet = normalized_phrase2.title()
                elif tokens and tokens[0] in {"hi", "hello", "hey"}:
                    greet = tokens[0].capitalize()
                else:
                    greet = "Hello"
                answer = f"{greet}! Welcome to Mahotsav-26 Campus Assistant. How can I help you?"
                translated_answer = answer
            else:
                # For non-English, return a natural local greeting.
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

        # If the user is asking where a block is, avoid RAG hallucinations.
        # We can reliably guide them to use the campus map.
        if _is_where_is_block_query(normalized):
            answer = (
                "You can find that block directly on the campus map on the Home page. "
                "Please tap/click the block area on the map to open it."
            )
            translated_answer = translate_text(answer, translation_code)
            save_history(question, answer)
            return jsonify({
                'question': question,
                'answer': answer,
                'translated_answer': translated_answer,
                'language': language,
                'language_name': lang_name,
                'success': True,
                'type': 'map_guidance'
            })
        
        # Handle "what time is it" or "what's the time"
        if any(phrase in lowered for phrase in ["what time", "what's the time", "current time", "time now"]):
            now = datetime.now()
            answer = f"The current time is {now.strftime('%I:%M %p')}."
            if 12 <= now.hour < 16:
                answer += " It's lunchtime; the boys hostel is serving lunch now."
            translated_answer = translate_text(answer, translation_code)
            save_history(question, answer)
            return jsonify({
                'question': question,
                'answer': answer,
                'translated_answer': translated_answer,
                'language': language,
                'language_name': lang_name,
                'success': True,
                'type': 'time_query'
            })
        
        # CRITICAL: Translate non-English questions to English before RAG query
        # (matching voice_assistant.py behavior - it translates user input to English for RAG)
        english_question = question
        debug_info = {}
        
        if translation_code != 'en':
            try:
                print(f"\n📱 RECEIVED '{lang_name}' QUESTION: {question}")
                english_question = GoogleTranslator(source=translation_code, target='en').translate(question)
                print(f"📝 ENGLISH TRANSLATION: {english_question}")
                debug_info['translated_question'] = english_question
            except Exception as e:
                print(f"⚠️ Question translation failed: {e}, using original")
                english_question = question
                debug_info['translation_error'] = str(e)

        english_normalized = _normalize_for_intent(english_question)

        # Some non-English greetings translate to short English greetings (e.g., Telugu "హాయ్" -> "hi").
        # If the translated text is a greeting, respond with a greeting instead of querying RAG.
        try:
            en_tokens = english_normalized.split() if english_normalized else []
            en_phrase2 = " ".join(en_tokens[:2]) if len(en_tokens) >= 2 else english_normalized
            is_greeting_translated = (
                (not is_vignan_query)
                and en_tokens
                and (
                    english_normalized in greeting_words
                    or en_phrase2 in greeting_words
                    or (en_tokens[0] in greeting_words and len(en_tokens) <= 3)
                )
            )
        except Exception:
            is_greeting_translated = False

        if is_greeting_translated:
            if translation_code == 'en':
                if en_phrase2 in {"good morning", "good afternoon", "good evening"}:
                    greet = en_phrase2.title()
                elif en_tokens and en_tokens[0] in {"hi", "hello", "hey", "hiya"}:
                    greet = en_tokens[0].capitalize()
                else:
                    greet = "Hello"
                answer = f"{greet}! Welcome to Mahotsav-26 Campus Assistant. How can I help you?"
                translated_answer = answer
            else:
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

        # Confidence guard: if retrieval match is weak, do not return an unrelated answer.
        try:
            retrieval = engine.retriever.retrieve(english_question, top_k=getattr(engine, 'top_k', 3))
            best_dist = retrieval[0][0] if retrieval else None
        except Exception:
            retrieval = []
            best_dist = None

        # Fee-structure queries are common and easy to answer deterministically from the KB.
        # For these, prefer the dedicated "Fee Structure" chunks by title to avoid unrelated retrieval.
        is_fee_intent = _is_fee_query(normalized) or _is_fee_query(english_normalized)
        fee_title_hits = []
        if is_fee_intent:
            try:
                fee_seed_query = "Fee Structure Vignan University"
                fee_candidates = engine.retrieve(fee_seed_query, top_k=15)
                fee_title_hits = [
                    (dist, meta)
                    for dist, meta in (fee_candidates or [])
                    if "fee structure" in str((meta or {}).get("title", "")).lower()
                ]
                if fee_title_hits:
                    retrieval = fee_title_hits[: getattr(engine, 'top_k', 3)]
                    best_dist = retrieval[0][0] if retrieval else best_dist
            except Exception:
                fee_title_hits = []

        # Fee queries: allow returning the best available KB text even if it doesn't
        # contain exact numeric amounts. (Do not block with a hard fallback.)

        # For normalized embeddings with FAISS L2 (squared) distance, higher means less similar.
        # Tune conservatively to avoid confident wrong answers.
        # For fee-structure queries with dedicated title hits, do not block with a distance guard.
        if (not fee_title_hits) and (best_dist is None or best_dist > 1.35):
            answer = _make_unknown_answer(english_normalized)
            translated_answer = translate_text(answer, translation_code)
            save_history(question, answer)
            return jsonify({
                'question': question,
                'answer': answer,
                'translated_answer': translated_answer,
                'language': language,
                'language_name': lang_name,
                'success': True,
                'type': 'no_match'
            })
        
        # Get answer from RAG engine using ENGLISH query
        print(f"🔍 QUERYING FAISS WITH: '{english_question}'")
        if fee_title_hits:
            answer = generate_answer(english_question, [meta for _, meta in retrieval])
        else:
            answer = engine.ask(english_question)
        print(f"✅ GOT ANSWER (first 100 chars): {answer[:100]}...")
        print(f"   Full answer: {answer}\n")
        debug_info['answer_from_faiss'] = answer[:200]

        
        # Translate answer to target language
        translated_answer = translate_text(answer, translation_code)
        print(f"Translated answer ({lang_name}): {translated_answer[:100]}...")
        
        save_history(question, answer)
        
        return jsonify({
            'question': question,
            'answer': answer,
            'translated_answer': translated_answer,
            'language': language,
            'language_name': lang_name,
            'success': True,
            'type': 'rag_answer'
        })
    
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/assistant/status', methods=['GET'])
def status():
    """Check if the assistant is ready."""
    return jsonify({
        'ready': engine is not None,
        'message': 'Assistant is ready' if engine else 'Assistant initializing...'
    })


@app.route('/api/assistant/greeting', methods=['GET'])
def get_greeting():
    """Get time-based greeting."""
    language = request.args.get('language', 'en-IN')
    lang_info = LANGUAGES.get(language, LANGUAGES['en-IN'])
    translation_code = lang_info['code']
    
    greeting = time_greeting()
    
    # Use natural greetings for all languages
    translated_greeting = get_natural_greeting(translation_code)
    
    save_history("__greeting__", greeting)
    
    return jsonify({
        'greeting': greeting,
        'translated_greeting': translated_greeting,
        'language': language,
        'language_name': lang_info['name'],
        'timestamp': datetime.now().isoformat()
    })


@app.route('/api/assistant/history', methods=['GET'])
def get_history():
    """Get recent conversation history."""
    try:
        if os.path.exists(history_path):
            with open(history_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            # Return last 20 interactions
            return jsonify({'history': data[-20:], 'success': True})
        else:
            return jsonify({'history': [], 'success': True})
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/assistant/languages', methods=['GET'])
def get_languages():
    """Get supported languages."""
    languages = [
        {"code": "en", "name": "English", "flag": "🇬🇧"},
        {"code": "hi", "name": "Hindi", "flag": "🇮🇳"},
        {"code": "te", "name": "Telugu", "flag": "🇮🇳"},
        {"code": "ta", "name": "Tamil", "flag": "🇮🇳"},
        {"code": "kn", "name": "Kannada", "flag": "🇮🇳"},
        {"code": "ml", "name": "Malayalam", "flag": "🇮🇳"},
    ]
    return jsonify({'languages': languages})


@app.route('/api/assistant/tts', methods=['POST'])
def text_to_speech():
    """Convert text to speech using enhanced gTTS."""
    try:
        data = request.json
        text = data.get('text', '').strip()
        language = data.get('language', 'en-IN')
        
        if not text:
            return jsonify({'error': 'No text provided'}), 400
        
        # Get language code
        if language not in LANGUAGES:
            if language in ['en', 'hi', 'te', 'ta', 'kn', 'ml', 'mr', 'bn', 'gu']:
                language = f"{language}-IN"
            else:
                language = 'en-IN'
        
        lang_code = LANGUAGES[language]['code']
        
        # Use normal speed for better pacing (was slow=True, now faster)
        # Indian languages still clear but not too slow
        
        # Generate audio using gTTS at normal speed
        from gtts import gTTS
        tts = gTTS(text=text, lang=lang_code, slow=False)
        
        # Save to temporary file
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mp3')
        tts.save(temp_file.name)
        temp_file.close()
        
        print(f"🎙️ Generated TTS for {lang_code} (NORMAL speed)")

        
        return send_file(
            temp_file.name,
            mimetype='audio/mpeg',
            as_attachment=False,
            download_name='speech.mp3'
        )
            
    except Exception as e:
        print(f"❌ TTS Error: {e}")
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    print("🚀 Initializing FAISS Voice Assistant API...")
    initialize_engine()
    print("✅ Starting Flask server on http://localhost:5001")
    app.run(host='0.0.0.0', port=5001, debug=False)
