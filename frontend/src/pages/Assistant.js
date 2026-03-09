import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Assistant.css';
import { cacheRead, cacheWrite } from '../utils/sessionCache';

const GREETING_CACHE_KEY = 'assistant.greeting.en-IN.v1';
const GREETING_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function Assistant({ embedded = false, onClose = null }) {
  const navigate = useNavigate();

  const languages = [
    { code: 'en-IN', name: 'English' },
    { code: 'hi-IN', name: 'Hindi' },
    { code: 'te-IN', name: 'Telugu' },
    { code: 'ta-IN', name: 'Tamil' },
    { code: 'kn-IN', name: 'Kannada' },
    { code: 'ml-IN', name: 'Malayalam' },
  ];

  const [assistantMode, setAssistantMode] = useState(embedded ? 'voice' : null); // 'voice' | 'text'
  const [assistantStep, setAssistantStep] = useState(embedded ? 'language-select' : 'mode-select');
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [userQuestion, setUserQuestion] = useState('');
  const [assistantAnswer, setAssistantAnswer] = useState('');
  const [textInput, setTextInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [labOptions, setLabOptions] = useState([]);
  const [labQueryType, setLabQueryType] = useState('');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [needsLunchCheck, setNeedsLunchCheck] = useState(false);
  const [voiceError, setVoiceError] = useState('');

  const recognitionRef = useRef(null);
  const audioRef = useRef(null);
  const aliveRef = useRef(true);
  const ttsAbortRef = useRef(null);
  const welcomeSpokenRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    aliveRef.current = true;

    // Greeting is shown after language selection (per UX request).

    return () => {
      cancelled = true;
      aliveRef.current = false;
      if (ttsAbortRef.current) {
        try {
          ttsAbortRef.current.abort();
        } catch (_) {
          // ignore
        }
      }
      stopListening();
      stopAudio();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!embedded) return;
    if (assistantStep !== 'language-select') return;
    if (welcomeSpokenRef.current) return;

    welcomeSpokenRef.current = true;

    const welcomeText = 'Welcome to Mahotsav-26 Campus Assistant. Please select your language.';
    setAssistantAnswer(welcomeText);
    speakWithBrowserTts(welcomeText, 'en-IN');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded, assistantStep]);

  const getTimeInfo = () => {
    const now = new Date();
    const hour = now.getHours();
    const isLunchWindow = hour >= 12 && hour < 16;
    const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    return { hour, isLunchWindow, timeOfDay };
  };

  const LUNCH_COPY = {
    'en-IN': {
      greeting: {
        morning: 'Good morning! Welcome to Mahotsav-26 Campus Assistant.',
        afternoon: 'Good afternoon! Welcome to Mahotsav-26 Campus Assistant.',
        evening: 'Good evening! Welcome to Mahotsav-26 Campus Assistant.',
      },
      lunchQuestion: 'Did you have lunch?',
      lunchYes: 'Great! How can I help you today?',
      lunchNoNow: 'No problem. Lunch is being served now at the Boys Hostel.',
      lunchNoLate: 'No problem. Lunch is usually available at the Boys Hostel during lunch hours.',
      yes: 'Yes',
      no: 'No',
    },
    'te-IN': {
      greeting: {
        morning: 'శుభోదయం! మహోత్సవ్-26 క్యాంపస్ అసిస్టెంట్‌కు స్వాగతం.',
        afternoon: 'శుభ మధ్యాహ్నం! మహోత్సవ్-26 క్యాంపస్ అసిస్టెంట్‌కు స్వాగతం.',
        evening: 'శుభ సాయంత్రం! మహోత్సవ్-26 క్యాంపస్ అసిస్టెంట్‌కు స్వాగతం.',
      },
      lunchQuestion: 'మీరు లంచ్ చేశారా?',
      lunchYes: 'బాగుంది! నేను మీకు ఎలా సహాయం చేయాలి?',
      lunchNoNow: 'పర్లేదు. బాయ్స్ హాస్టల్‌లో ఇప్పుడు లంచ్ సర్వ్ చేస్తున్నారు.',
      lunchNoLate: 'పర్లేదు. లంచ్ టైమ్‌లో బాయ్స్ హాస్టల్‌లో లంచ్ అందుబాటులో ఉంటుంది.',
      yes: 'అవును',
      no: 'లేదు',
    },
    'hi-IN': {
      greeting: {
        morning: 'सुप्रभात! महोत्सव-26 कैंपस असिस्टेंट में आपका स्वागत है।',
        afternoon: 'शुभ दोपहर! महोत्सव-26 कैंपस असिस्टेंट में आपका स्वागत है।',
        evening: 'शुभ संध्या! महोत्सव-26 कैंपस असिस्टेंट में आपका स्वागत है।',
      },
      lunchQuestion: 'क्या आपने लंच किया?',
      lunchYes: 'बहुत बढ़िया! मैं आपकी कैसे मदद करूं?',
      lunchNoNow: 'कोई बात नहीं। Boys Hostel में अभी लंच सर्व हो रहा है।',
      lunchNoLate: 'कोई बात नहीं। लंच टाइम में Boys Hostel में लंच मिलता है।',
      yes: 'हाँ',
      no: 'नहीं',
    },
    'ta-IN': {
      greeting: {
        morning: 'காலை வணக்கம்! Mahotsav-26 Campus Assistant-க்கு வரவேற்கிறோம்.',
        afternoon: 'மதிய வணக்கம்! Mahotsav-26 Campus Assistant-க்கு வரவேற்கிறோம்.',
        evening: 'மாலை வணக்கம்! Mahotsav-26 Campus Assistant-க்கு வரவேற்கிறோம்.',
      },
      lunchQuestion: 'நீங்கள் மதிய உணவு சாப்பிட்டீர்களா?',
      lunchYes: 'சரி! நான் எப்படி உதவி செய்யலாம்?',
      lunchNoNow: 'பரவாயில்லை. Boys Hostel-ல் இப்போது லஞ்ச் வழங்கப்படுகிறது.',
      lunchNoLate: 'பரவாயில்லை. லஞ்ச் நேரத்தில் Boys Hostel-ல் லஞ்ச் கிடைக்கும்.',
      yes: 'ஆம்',
      no: 'இல்லை',
    },
    'kn-IN': {
      greeting: {
        morning: 'ಶುಭೋದಯ! Mahotsav-26 Campus Assistant ಗೆ ಸ್ವಾಗತ.',
        afternoon: 'ಶುಭ ಮಧ್ಯಾಹ್ನ! Mahotsav-26 Campus Assistant ಗೆ ಸ್ವಾಗತ.',
        evening: 'ಶುಭ ಸಂಜೆ! Mahotsav-26 Campus Assistant ಗೆ ಸ್ವಾಗತ.',
      },
      lunchQuestion: 'ನೀವು ಲಂಚ್ ಮಾಡಿಕೊಂಡಿರಾ?',
      lunchYes: 'ಚೆನ್ನಾಗಿದೆ! ನಾನು ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?',
      lunchNoNow: 'ಸರಿ. Boys Hostel ನಲ್ಲಿ ಈಗ ಲಂಚ್ ಸರ್ವ್ ಆಗುತ್ತಿದೆ.',
      lunchNoLate: 'ಸರಿ. ಲಂಚ್ ಸಮಯದಲ್ಲಿ Boys Hostel ನಲ್ಲಿ ಲಂಚ್ ಲಭ್ಯ.',
      yes: 'ಹೌದು',
      no: 'ಇಲ್ಲ',
    },
    'ml-IN': {
      greeting: {
        morning: 'സുപ്രഭാതം! Mahotsav-26 Campus Assistant ലേക്ക് സ്വാഗതം.',
        afternoon: 'ശുഭ ഉച്ച! Mahotsav-26 Campus Assistant ലേക്ക് സ്വാഗതം.',
        evening: 'ശുഭ സന്ധ്യ! Mahotsav-26 Campus Assistant ലേക്ക് സ്വാഗതം.',
      },
      lunchQuestion: 'നിങ്ങൾ ലഞ്ച് കഴിച്ചോ?',
      lunchYes: 'നന്നായി! ഞാൻ എങ്ങനെ സഹായിക്കാം?',
      lunchNoNow: 'ശരി. Boys Hostel ൽ ഇപ്പോൾ ലഞ്ച് നൽകുന്നു.',
      lunchNoLate: 'ശരി. ലഞ്ച് സമയത്ത് Boys Hostel ൽ ലഞ്ച് ലഭിക്കും.',
      yes: 'അതെ',
      no: 'ഇല്ല',
    },
  };

  const parseYesNo = (text) => {
    const normalized = (text || '').trim().toLowerCase();
    if (!normalized) return null;

    const yesWords = [
      'yes', 'y', 'yeah', 'yep', 'sure', 'ok', 'okay',
      'ha', 'haan', 'han', 'ji',
      'avunu', 'yesu',
      'ஆம்',
      'ಹೌದು',
      'അതെ',
      'అవును',
      'हाँ',
    ];
    const noWords = [
      'no', 'n', 'nope', 'not yet',
      'nahi', 'nahin',
      'ledu',
      'இல்லை',
      'ಇಲ್ಲ',
      'ഇല്ല',
      'లేదు',
      'नहीं',
    ];

    if (yesWords.some((w) => normalized === w || normalized.startsWith(w + ' '))) return true;
    if (noWords.some((w) => normalized === w || normalized.startsWith(w + ' '))) return false;
    return null;
  };

  const runGreetingAfterLanguageSelect = async (langCode) => {
    stopListening();
    stopAudio();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();

    setUserQuestion('');
    setTextInput('');
    setLabOptions([]);
    setLabQueryType('');
    setNeedsLunchCheck(false);

    const langToUse = langCode || 'en-IN';
    const copy = LUNCH_COPY[langToUse] || LUNCH_COPY['en-IN'];
    const { isLunchWindow, timeOfDay } = getTimeInfo();
    const greetingText = (copy.greeting && copy.greeting[timeOfDay])
      ? copy.greeting[timeOfDay]
      : 'Hello! Welcome to Mahotsav-26 Campus Assistant.';

    setAssistantAnswer(greetingText);
    setAssistantStep('greeting');
    speakWithBrowserTts(greetingText, langToUse);

    if (isLunchWindow) {
      setNeedsLunchCheck(true);
      setTimeout(() => {
        if (!aliveRef.current) return;
        setAssistantAnswer(copy.lunchQuestion);
        setAssistantStep('lunch-check');
        speakWithBrowserTts(copy.lunchQuestion, langToUse);
      }, 1300);
    } else {
      setTimeout(() => {
        if (!aliveRef.current) return;
        setAssistantStep('input');
        if (assistantMode === 'voice') setTimeout(() => startVoiceInput(langToUse), 250);
      }, 1100);
    }
  };

  const speakWithBrowserTts = (text, lang) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang || 'en-IN';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  const stopListening = () => {
    const current = recognitionRef.current;
    if (current) {
      try {
        current.stop();
      } catch (_) {
        // ignore
      }
    }
    recognitionRef.current = null;
    setIsListening(false);
  };

  const stopAudio = () => {
    const current = audioRef.current;
    if (current) {
      try {
        current.pause();
        current.currentTime = 0;
      } catch (_) {
        // ignore
      }
    }
    audioRef.current = null;
    setIsPlayingAudio(false);
  };

  const handleModeSelect = (mode) => {
    stopListening();
    stopAudio();
    setVoiceError('');
    setAssistantMode(mode);
    setAssistantStep('language-select');
  };

  const handleLanguageSelect = (langCode) => {
    setSelectedLanguage(langCode);
    setVoiceError('');
    runGreetingAfterLanguageSelect(langCode);
  };

  const startVoiceInput = (langCode, onFinalTranscript = null) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError('Voice recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    stopListening();
    setVoiceError('');

    const recognition = new SpeechRecognition();
    const languageToUse = langCode || selectedLanguage || 'en-IN';
    recognition.lang = languageToUse;
    recognition.langCode = languageToUse; // custom field for race-free submit
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    setIsListening(true);
    let finalTranscript = '';
    let latestTranscript = '';
    let silenceTimer = null;
    let submitted = false;

    recognition.onstart = () => {
      finalTranscript = '';
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      const displayText = (finalTranscript + interimTranscript).trim();
      latestTranscript = displayText;
      setUserQuestion(displayText);

      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        const toSubmit = (finalTranscript.trim() || latestTranscript || '').trim();
        if (toSubmit) {
          try {
            recognition.stop();
          } catch (_) {
            // ignore
          }
          setIsListening(false);
          setUserQuestion(toSubmit);
          submitted = true;
          if (typeof onFinalTranscript === 'function') {
            onFinalTranscript(toSubmit, recognition.langCode);
          } else {
            handleSubmitQuestion(toSubmit, recognition.langCode);
          }
        }
      }, 1700);
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      recognitionRef.current = null;

      const code = event?.error;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setVoiceError('Microphone permission blocked. Allow mic access and try again. (Voice often requires HTTPS except on localhost.)');
      } else if (code === 'audio-capture') {
        setVoiceError('No microphone detected (or it is busy). Check your mic settings and try again.');
      } else if (code === 'network') {
        setVoiceError('Speech recognition network error. Try again or switch to Text mode.');
      } else if (code === 'no-speech') {
        setVoiceError('No speech detected. Tap Start and speak clearly.');
      } else {
        setVoiceError('Could not understand. Please try again (or switch to Text mode).');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;

      if (submitted) return;
      const toSubmit = (finalTranscript.trim() || latestTranscript || '').trim();
      if (!toSubmit) return;

      submitted = true;
      setUserQuestion(toSubmit);
      if (typeof onFinalTranscript === 'function') {
        onFinalTranscript(toSubmit, recognition.langCode);
      } else {
        handleSubmitQuestion(toSubmit, recognition.langCode);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      setIsListening(false);
      recognitionRef.current = null;
      setVoiceError('Unable to start voice recognition. Please allow microphone permission and try again.');
    }
  };

  const handleTextSubmit = (e) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    const value = textInput.trim();
    setUserQuestion(value);
    if (assistantStep === 'lunch-check') {
      const yn = parseYesNo(value);
      if (yn === null) {
        const copy = LUNCH_COPY[selectedLanguage] || LUNCH_COPY['en-IN'];
        setAssistantAnswer(copy.lunchQuestion);
        speakWithBrowserTts(copy.lunchQuestion, selectedLanguage);
        return;
      }
      handleLunchDecision(yn);
      return;
    }
    handleSubmitQuestion(value, selectedLanguage);
  };

  const handleLunchDecision = (didHaveLunch) => {
    const langToUse = selectedLanguage || 'en-IN';
    const copy = LUNCH_COPY[langToUse] || LUNCH_COPY['en-IN'];
    const { isLunchWindow } = getTimeInfo();

    setNeedsLunchCheck(false);

    const next = didHaveLunch
      ? copy.lunchYes
      : (isLunchWindow ? copy.lunchNoNow : copy.lunchNoLate);

    setAssistantAnswer(next);
    speakWithBrowserTts(next, langToUse);

    setTimeout(() => {
      if (!aliveRef.current) return;
      setAssistantStep('input');
      if (assistantMode === 'voice') setTimeout(() => startVoiceInput(langToUse), 250);
    }, 1100);
  };

  const speakWithServerTts = async (text, languageToUse) => {
    try {
      // Abort any in-flight TTS request to prevent late audio playback.
      if (ttsAbortRef.current) {
        try {
          ttsAbortRef.current.abort();
        } catch (_) {
          // ignore
        }
      }
      const controller = new AbortController();
      ttsAbortRef.current = controller;

      const ttsResponse = await fetch('/api/assistant/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language: languageToUse || 'en-IN' }),
        signal: controller.signal,
      });

      if (!ttsResponse.ok) return false;
      const audioBlob = await ttsResponse.blob();

      if (!aliveRef.current) return false;

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      setIsPlayingAudio(true);
      audio.onended = () => {
        setIsPlayingAudio(false);
        audioRef.current = null;
        try {
          URL.revokeObjectURL(audioUrl);
        } catch (_) {
          // ignore
        }
      };

      if (!aliveRef.current) {
        try {
          URL.revokeObjectURL(audioUrl);
        } catch (_) {
          // ignore
        }
        return false;
      }

      try {
        await audio.play();
        return true;
      } catch (_) {
        setIsPlayingAudio(false);
        audioRef.current = null;
        try {
          URL.revokeObjectURL(audioUrl);
        } catch (e) {
          // ignore
        }
        return false;
      }
    } catch (_) {
      return false;
    }
  };

  const handleSubmitQuestion = async (question, voiceLanguage = null) => {
    const languageToUse = voiceLanguage || selectedLanguage || 'en-IN';
    setIsLoading(true);
    setAssistantStep('answer');
    stopAudio();

    try {
      const timestamp = Date.now();
      const response = await axios.post(`/api/assistant/query?t=${timestamp}`, {
        question,
        language: languageToUse,
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });

      if (!response?.data?.success) {
        setAssistantAnswer(response?.data?.error || 'Sorry, I encountered an error.');
        return;
      }

      const type = response.data.type;
      const englishAnswer = response.data.answer;
      const translatedAnswer = response.data.translated_answer;
      const displayAnswer = translatedAnswer || englishAnswer || '';

      if (type === 'lab_selection') {
        setLabOptions(response.data.options || []);
        setLabQueryType(response.data.query_type || '');
        const prompt = (response.data.query_type === 'labs')
          ? 'Which lab would you like to see?'
          : 'Which classroom would you like to see?';
        setAssistantAnswer(prompt);
        speakWithBrowserTts(prompt, languageToUse);
        setAssistantStep('lab-select');
        return;
      }

      if (type === 'combined_response') {
        setAssistantAnswer(displayAnswer);
        setLabOptions(response.data.options || []);
        setLabQueryType(response.data.query_type || '');
        setAssistantStep('lab-select');
      } else {
        setAssistantAnswer(displayAnswer);
        setAssistantStep('answer');
      }

      if (!aliveRef.current) return;

      // Speak: prefer server TTS, fallback to browser
      const ok = await speakWithServerTts(displayAnswer, languageToUse);
      if (!aliveRef.current) return;
      if (!ok) speakWithBrowserTts(displayAnswer, languageToUse);
    } catch (error) {
      setAssistantAnswer('Sorry, I could not connect to the assistant. Please make sure the assistant service is running.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAskAgain = () => {
    setTextInput('');
    setUserQuestion('');
    setAssistantAnswer('');
    setLabOptions([]);
    setLabQueryType('');
    stopAudio();

    if (assistantMode === 'voice') {
      setAssistantStep('input');
      setTimeout(() => startVoiceInput(selectedLanguage), 250);
    } else {
      setAssistantStep('input');
    }
  };

  const handleStartOver = () => {
    stopListening();
    stopAudio();
    setAssistantMode(embedded ? 'voice' : null);
    setAssistantStep(embedded ? 'language-select' : 'mode-select');
    setSelectedLanguage('');
    setTextInput('');
    setUserQuestion('');
    setAssistantAnswer('');
    setLabOptions([]);
    setLabQueryType('');
    setNeedsLunchCheck(false);
    welcomeSpokenRef.current = false;
  };

  const handleLabSelect = (option) => {
    stopListening();
    stopAudio();
    const { block, section } = option || {};
    if (!block || !section) return;
    navigate(`/block/${block}/${section}`);
    if (embedded && typeof onClose === 'function') onClose();
  };

  return (
    <div className={embedded ? 'assistant-widget-root' : 'assistant-page'}>
      {embedded ? (
        <div className="assistant-widget-topbar">
          <div className="assistant-widget-title">Campus Assistant</div>
          <button
            type="button"
            className="assistant-widget-close"
            onClick={() => (typeof onClose === 'function' ? onClose() : null)}
            aria-label="Close assistant"
            title="Close"
          >
            ×
          </button>
        </div>
      ) : (
        <>
          <button className="back-button" onClick={() => navigate('/home') }>
            ← Back to Map
          </button>
          <h1 className="title">Campus Assistant</h1>
        </>
      )}

      <div className="assistant-card">
        <div className="assistant-card-header">
          <div className="assistant-card-title">Ask a question</div>
          <div className="assistant-card-subtitle">Voice or text • Multilingual • Can navigate to Labs/Classrooms</div>
        </div>

        <div className="assistant-card-body">
          {assistantStep === 'greeting' && (
            <div className="assistant-section">
              {embedded ? (
                <div className="assistant-embedded-hero">
                  <div className="assistant-embedded-emoji" aria-hidden="true">👋</div>
                  <p className="assistant-greeting">
                    {assistantAnswer || 'Initializing campus assistant...'}
                  </p>
                  {assistantAnswer ? (
                    <p className="assistant-embedded-status">Initializing campus assistant...</p>
                  ) : null}
                </div>
              ) : (
                <p className="assistant-greeting">{assistantAnswer || 'Initializing assistant...'}</p>
              )}
            </div>
          )}

          {assistantStep === 'mode-select' && (
            <div className="assistant-section">
              <p className="assistant-prompt">How would you like to interact?</p>
              <div className="assistant-row">
                <button className="assistant-primary" onClick={() => handleModeSelect('voice')}>🎤 Voice</button>
                <button className="assistant-secondary" onClick={() => handleModeSelect('text')}>⌨️ Text</button>
              </div>
            </div>
          )}

          {assistantStep === 'language-select' && (
            <div className="assistant-section">
              <p className="assistant-prompt">Select your language:</p>
              <div className="assistant-grid">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    className="assistant-chip"
                    onClick={() => handleLanguageSelect(lang.code)}
                  >
                    {lang.name}
                  </button>
                ))}
              </div>
              <div className="assistant-row" style={{ marginTop: 12 }}>
                <button className="assistant-tertiary" onClick={handleStartOver}>← Back</button>
              </div>
            </div>
          )}

          {assistantStep === 'lunch-check' && (
            <div className="assistant-section">
              <p className="assistant-prompt">{assistantAnswer || (LUNCH_COPY[selectedLanguage] || LUNCH_COPY['en-IN']).lunchQuestion}</p>
              <div className="assistant-row">
                <button className="assistant-primary" onClick={() => handleLunchDecision(true)}>
                  {(LUNCH_COPY[selectedLanguage] || LUNCH_COPY['en-IN']).yes}
                </button>
                <button className="assistant-secondary" onClick={() => handleLunchDecision(false)}>
                  {(LUNCH_COPY[selectedLanguage] || LUNCH_COPY['en-IN']).no}
                </button>
              </div>

              {assistantMode === 'voice' ? (
                <div className="assistant-row" style={{ marginTop: 12 }}>
                  {isListening ? (
                    <button className="assistant-danger" onClick={stopListening}>⏹ Stop</button>
                  ) : (
                    <button
                      className="assistant-tertiary"
                      onClick={() => startVoiceInput(selectedLanguage, (t) => {
                        const yn = parseYesNo(t);
                        if (yn === null) return;
                        handleLunchDecision(yn);
                      })}
                    >
                      🎤 Answer by voice
                    </button>
                  )}
                </div>
              ) : (
                <div className="assistant-row" style={{ marginTop: 12 }}>
                  <button className="assistant-tertiary" onClick={() => setAssistantStep('input')}>Skip</button>
                </div>
              )}
            </div>
          )}

          {assistantStep === 'input' && assistantMode === 'voice' && (
            <div className="assistant-section">
              {isListening ? (
                <>
                  <p className="assistant-status">Listening…</p>
                  {userQuestion ? <div className="assistant-transcript">{userQuestion}</div> : null}
                  {voiceError ? <p className="assistant-status" style={{ marginTop: 8 }}>{voiceError}</p> : null}
                  <div className="assistant-row">
                    <button className="assistant-danger" onClick={stopListening}>⏹ Stop</button>
                  </div>
                </>
              ) : (
                <>
                  <p className="assistant-prompt">Ready to listen in {languages.find(l => l.code === selectedLanguage)?.name || 'English'}</p>
                  {voiceError ? <p className="assistant-status" style={{ marginTop: 8 }}>{voiceError}</p> : null}
                  <div className="assistant-row">
                    <button className="assistant-primary" onClick={() => startVoiceInput(selectedLanguage)}>🎤 Start Speaking</button>
                    <button className="assistant-tertiary" onClick={() => setAssistantStep('language-select')}>Change Language</button>
                  </div>
                </>
              )}
            </div>
          )}

          {assistantStep === 'input' && assistantMode === 'text' && (
            <div className="assistant-section">
              <p className="assistant-prompt">Type your question:</p>
              <form onSubmit={handleTextSubmit}>
                <textarea
                  className="assistant-textarea"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Ask about campus facilities, locations, events, etc."
                  rows={4}
                />
                <div className="assistant-row">
                  <button className="assistant-primary" type="submit" disabled={!textInput.trim()}>
                    Submit
                  </button>
                  <button className="assistant-tertiary" type="button" onClick={handleStartOver}>
                    ← Back
                  </button>
                </div>
              </form>
            </div>
          )}

          {assistantStep === 'answer' && (
            <div className="assistant-section">
              {isLoading ? (
                <p className="assistant-status">Thinking…</p>
              ) : (
                <>
                  <div className="assistant-qa">
                    <div className="assistant-q"><strong>You asked:</strong> {userQuestion}</div>
                    <div className="assistant-a"><strong>Answer:</strong> {assistantAnswer}</div>
                  </div>
                  <div className="assistant-row">
                    <button className="assistant-secondary" onClick={handleAskAgain}>Ask Another</button>
                    <button className="assistant-tertiary" onClick={handleStartOver}>Start Over</button>
                    {isPlayingAudio ? (
                      <button className="assistant-danger" onClick={stopAudio}>⏹ Stop Audio</button>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          )}

          {assistantStep === 'lab-select' && (
            <div className="assistant-section">
              {assistantAnswer ? (
                <div className="assistant-qa" style={{ marginBottom: 12 }}>
                  <div className="assistant-q"><strong>You asked:</strong> {userQuestion}</div>
                  <div className="assistant-a"><strong>Answer:</strong> {assistantAnswer}</div>
                </div>
              ) : null}

              <p className="assistant-prompt">
                {labQueryType === 'labs' ? 'Select a Lab:' : 'Select a Classroom:'}
              </p>
              <div className="assistant-grid">
                {labOptions.map((opt) => {
                  const langCode = (selectedLanguage || 'en-IN').split('-')[0];
                  const displayName = (langCode === 'te' && opt.name_te) ? opt.name_te
                    : (langCode === 'hi' && opt.name_hi) ? opt.name_hi
                    : opt.name;
                  return (
                    <button key={opt.id} className="assistant-chip" onClick={() => handleLabSelect(opt)}>
                      {displayName}
                    </button>
                  );
                })}
              </div>
              <div className="assistant-row" style={{ marginTop: 12 }}>
                <button className="assistant-secondary" onClick={handleAskAgain}>Ask Another</button>
                <button className="assistant-tertiary" onClick={handleStartOver}>Start Over</button>
                {isPlayingAudio ? (
                  <button className="assistant-danger" onClick={stopAudio}>⏹ Stop Audio</button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Assistant;
