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

  const [assistantMode, setAssistantMode] = useState(null); // 'voice' | 'text'
  const [assistantStep, setAssistantStep] = useState('greeting');
  const [selectedLanguage, setSelectedLanguage] = useState('en-IN');
  const [userQuestion, setUserQuestion] = useState('');
  const [assistantAnswer, setAssistantAnswer] = useState('');
  const [textInput, setTextInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [labOptions, setLabOptions] = useState([]);
  const [labQueryType, setLabQueryType] = useState('');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const recognitionRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function initGreeting() {
      setAssistantStep('greeting');
      setAssistantMode(null);
      setSelectedLanguage('en-IN');
      setUserQuestion('');
      setAssistantAnswer('');
      setLabOptions([]);
      setLabQueryType('');

      const cachedGreeting = cacheRead(GREETING_CACHE_KEY, null);
      if (cachedGreeting) {
        setAssistantAnswer(cachedGreeting);
        speakWithBrowserTts(cachedGreeting, 'en-IN');
        setTimeout(() => {
          if (!cancelled) setAssistantStep('mode-select');
        }, 2200);
      }

      try {
        const response = await axios.get('/api/assistant/greeting', {
          params: { language: 'en-IN' },
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
          },
        });

        const greeting = response?.data?.translated_greeting || response?.data?.greeting;
        if (!cancelled && greeting) {
          cacheWrite(GREETING_CACHE_KEY, greeting, GREETING_CACHE_TTL_MS);

          // If we already showed cached greeting, only update if different.
          if (greeting !== cachedGreeting) {
            setAssistantAnswer(greeting);
            speakWithBrowserTts(greeting, 'en-IN');
          }

          setTimeout(() => {
            if (!cancelled) setAssistantStep('mode-select');
          }, 2200);
        }
      } catch (error) {
        const fallback = 'Hello! Welcome to Mahotsav-26 Campus Assistant.';
        if (!cancelled) {
          if (!cachedGreeting) {
            setAssistantAnswer(fallback);
            speakWithBrowserTts(fallback, 'en-IN');
            setTimeout(() => {
              if (!cancelled) setAssistantStep('mode-select');
            }, 2200);
          }
        }
      }
    }

    initGreeting();

    return () => {
      cancelled = true;
      stopListening();
      stopAudio();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setAssistantMode(mode);
    if (mode === 'voice') {
      setAssistantStep('language-select');
    } else {
      setAssistantStep('input');
    }
  };

  const handleLanguageSelect = (langCode) => {
    setSelectedLanguage(langCode);
    setAssistantStep('input');
    setTimeout(() => startVoiceInput(langCode), 300);
  };

  const startVoiceInput = (langCode) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice recognition not supported in your browser. Please use Chrome or Edge.');
      return;
    }

    stopListening();

    const recognition = new SpeechRecognition();
    const languageToUse = langCode || selectedLanguage || 'en-IN';
    recognition.lang = languageToUse;
    recognition.langCode = languageToUse; // custom field for race-free submit
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    setIsListening(true);
    let finalTranscript = '';
    let silenceTimer = null;

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
      setUserQuestion(displayText);

      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        const toSubmit = finalTranscript.trim();
        if (toSubmit) {
          try {
            recognition.stop();
          } catch (_) {
            // ignore
          }
          setIsListening(false);
          setUserQuestion(toSubmit);
          handleSubmitQuestion(toSubmit, recognition.langCode);
        }
      }, 1700);
    };

    recognition.onerror = () => {
      setIsListening(false);
      alert('Could not understand. Please try again.');
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleTextSubmit = (e) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    setUserQuestion(textInput.trim());
    handleSubmitQuestion(textInput.trim(), selectedLanguage);
  };

  const speakWithServerTts = async (text, languageToUse) => {
    try {
      const ttsResponse = await fetch('/api/assistant/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language: languageToUse || 'en-IN' }),
      });

      if (!ttsResponse.ok) return false;
      const audioBlob = await ttsResponse.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      setIsPlayingAudio(true);
      audio.onended = () => {
        setIsPlayingAudio(false);
        audioRef.current = null;
      };
      await audio.play();
      return true;
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

      // Speak: prefer server TTS, fallback to browser
      const ok = await speakWithServerTts(displayAnswer, languageToUse);
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
    setAssistantMode(null);
    setAssistantStep('mode-select');
    setSelectedLanguage('en-IN');
    setTextInput('');
    setUserQuestion('');
    setAssistantAnswer('');
    setLabOptions([]);
    setLabQueryType('');
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
          <button className="back-button" onClick={() => navigate('/') }>
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

          {assistantStep === 'language-select' && assistantMode === 'voice' && (
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

          {assistantStep === 'input' && assistantMode === 'voice' && (
            <div className="assistant-section">
              {isListening ? (
                <>
                  <p className="assistant-status">Listening…</p>
                  {userQuestion ? <div className="assistant-transcript">{userQuestion}</div> : null}
                  <div className="assistant-row">
                    <button className="assistant-danger" onClick={stopListening}>⏹ Stop</button>
                  </div>
                </>
              ) : (
                <>
                  <p className="assistant-prompt">Ready to listen in {languages.find(l => l.code === selectedLanguage)?.name || 'English'}</p>
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
