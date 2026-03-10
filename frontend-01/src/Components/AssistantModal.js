import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './AssistantModal.css';

const LANGUAGES = [
  { code: 'en-IN', name: 'English' },
  { code: 'hi-IN', name: 'Hindi' },
  { code: 'te-IN', name: 'Telugu' },
  { code: 'ta-IN', name: 'Tamil' },
  { code: 'kn-IN', name: 'Kannada' },
  { code: 'ml-IN', name: 'Malayalam' },
];

const LUNCH_COPY = {
  'en-IN': {
    lunchQuestion: 'Did you have lunch?',
    lunchYes: 'Great. How can I help you today?',
    lunchNoNow: 'No problem. Lunch is being served now in the dining hall.',
    lunchNoLate: 'No problem. Lunch is usually available during lunch hours.',
    yes: 'Yes',
    no: 'No',
  },
  'hi-IN': {
    lunchQuestion: 'Kya aapne lunch kiya?',
    lunchYes: 'Bahut badhiya. Main aapki kaise madad karun?',
    lunchNoNow: 'Koi baat nahi. Dining hall mein abhi lunch serve ho raha hai.',
    lunchNoLate: 'Koi baat nahi. Lunch time mein dining hall mein lunch milta hai.',
    yes: 'Haan',
    no: 'Nahi',
  },
  'te-IN': {
    lunchQuestion: 'Meeru lunch chesara?',
    lunchYes: 'Bagundi. Nenu meeku ela sahayam cheyali?',
    lunchNoNow: 'Parledu. Dining hall lo ippudu lunch serve chestunnaru.',
    lunchNoLate: 'Parledu. Lunch time lo dining hall lo lunch untundi.',
    yes: 'Avunu',
    no: 'Ledu',
  },
  'ta-IN': {
    lunchQuestion: 'Neenga lunch saptingala?',
    lunchYes: 'Nandri. Naan eppadi udhavi seyyalam?',
    lunchNoNow: 'Parava illai. Dining hall la ippo lunch kidaikkudhu.',
    lunchNoLate: 'Parava illai. Lunch nerathila dining hall la lunch kidaikkum.',
    yes: 'Aam',
    no: 'Illai',
  },
  'kn-IN': {
    lunchQuestion: 'Neevu lunch madidira?',
    lunchYes: 'Chennagide. Naanu hege sahaya madali?',
    lunchNoNow: 'Sari. Dining hall nalli iga lunch serve aguttide.',
    lunchNoLate: 'Sari. Lunch samayadalli dining hall nalli lunch siguttade.',
    yes: 'Howdu',
    no: 'Illa',
  },
  'ml-IN': {
    lunchQuestion: 'Ningal lunch kazhicho?',
    lunchYes: 'Nannayi. Njan engane sahayikkam?',
    lunchNoNow: 'Sari. Dining hall il ippol lunch kodukkunnu.',
    lunchNoLate: 'Sari. Lunch samayath dining hall il lunch labhikkum.',
    yes: 'Athe',
    no: 'Illa',
  },
};

function AssistantModal({ isOpen, onClose }) {
  const navigate = useNavigate();

  const [assistantMode, setAssistantMode] = useState(null);
  const [assistantStep, setAssistantStep] = useState('greeting');
  const [selectedLanguage, setSelectedLanguage] = useState('en-IN');
  const [userQuestion, setUserQuestion] = useState('');
  const [assistantAnswer, setAssistantAnswer] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [labOptions, setLabOptions] = useState([]);
  const [labQueryType, setLabQueryType] = useState('');
  const [needsLunchCheck, setNeedsLunchCheck] = useState(false);

  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      const start = async () => {
        try {
          const res = await axios.get('/api/assistant/greeting', {
            params: { language: 'en-IN' },
          });
          setAssistantAnswer(res.data?.greeting || 'Hello. Welcome to Vignan Campus Assistant.');
        } catch {
          setAssistantAnswer('Hello. Welcome to Vignan Campus Assistant.');
        } finally {
          setTimeout(() => setAssistantStep('mode-select'), 1200);
        }
      };

      start();
    }

    return () => {
      stopListening();
      stopAudio();
    };
  }, [isOpen]);

  const getTimeInfo = () => {
    const hour = new Date().getHours();
    return {
      isLunchWindow: hour >= 12 && hour < 16,
    };
  };

  const parseYesNo = (text) => {
    const normalized = String(text || '').trim().toLowerCase();
    if (!normalized) return null;

    const yesWords = ['yes', 'haan', 'ha', 'avunu', 'aam', 'howdu', 'athe'];
    const noWords = ['no', 'nahi', 'nahin', 'ledu', 'illai', 'illa'];

    if (yesWords.some((word) => normalized === word || normalized.startsWith(`${word} `))) {
      return true;
    }
    if (noWords.some((word) => normalized === word || normalized.startsWith(`${word} `))) {
      return false;
    }
    return null;
  };

  const stopAudio = () => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch {
        // ignore
      }
      audioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  const speakText = async (text, languageCode) => {
    stopAudio();
    try {
      const ttsRes = await fetch('/api/assistant/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language: languageCode || 'en-IN' }),
      });

      if (!ttsRes.ok) throw new Error('TTS failed');

      const blob = await ttsRes.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (audioRef.current === audio) audioRef.current = null;
      };
      await audio.play();
    } catch {
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = languageCode || 'en-IN';
        utterance.rate = 0.85;
        window.speechSynthesis.speak(utterance);
      }
    }
  };

  const handleModeSelect = (mode) => {
    setAssistantMode(mode);
    if (mode === 'voice') {
      setAssistantStep('language-select');
      return;
    }
    setAssistantStep('input');
  };

  const handleLunchResponse = async (response) => {
    const copy = LUNCH_COPY[selectedLanguage] || LUNCH_COPY['en-IN'];
    const message = response
      ? copy.lunchYes
      : (getTimeInfo().isLunchWindow ? copy.lunchNoNow : copy.lunchNoLate);

    setAssistantAnswer(message);
    setNeedsLunchCheck(false);
    setAssistantStep('input');
    await speakText(message, selectedLanguage);
  };

  const handleLanguageSelect = async (languageCode) => {
    setSelectedLanguage(languageCode);
    const copy = LUNCH_COPY[languageCode] || LUNCH_COPY['en-IN'];

    if (getTimeInfo().isLunchWindow) {
      setNeedsLunchCheck(true);
      setAssistantStep('lunch-check');
      setAssistantAnswer(copy.lunchQuestion);
      await speakText(copy.lunchQuestion, languageCode);
      return;
    }

    setAssistantStep('input');
    setTimeout(() => startVoiceInput(languageCode), 200);
  };

  const stopListening = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const startVoiceInput = (languageCode) => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setAssistantAnswer('Voice recognition is not supported in this browser. Please use text mode.');
      return;
    }

    stopListening();

    const recognition = new Recognition();
    recognition.lang = languageCode || selectedLanguage || 'en-IN';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let finalTranscript = '';

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const value = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += `${value} `;
        } else {
          interim += value;
        }
      }

      setUserQuestion(`${finalTranscript}${interim}`.trim());

      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        if (finalTranscript.trim()) {
          const ask = finalTranscript.trim();
          stopListening();
          setUserQuestion(ask);
          handleSubmitQuestion(ask, recognition.lang);
        }
      }, 1500);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (recognitionRef.current === recognition) recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleSubmitQuestion = async (question, voiceLanguage = null) => {
    if (!question || !question.trim()) return;

    if (assistantStep === 'lunch-check') {
      const parsed = parseYesNo(question);
      if (parsed === null) {
        const copy = LUNCH_COPY[selectedLanguage] || LUNCH_COPY['en-IN'];
        const prompt = `Please answer yes or no. ${copy.lunchQuestion}`;
        setAssistantAnswer(prompt);
        await speakText(prompt, selectedLanguage);
        return;
      }
      await handleLunchResponse(parsed);
      return;
    }

    const languageToUse = voiceLanguage || selectedLanguage || 'en-IN';
    setIsLoading(true);
    setAssistantStep('answer');

    try {
      const res = await axios.post('/api/assistant/query', {
        question: question.trim(),
        language: languageToUse,
      });

      if (!res.data?.success) {
        setAssistantAnswer('Unable to process your question. Please try again.');
        return;
      }

      if (res.data.type === 'combined_response' || res.data.type === 'lab_selection') {
        setLabOptions(res.data.options || []);
        setLabQueryType(res.data.query_type || 'labs');
        const text = res.data.translated_answer || res.data.answer || 'Please select an option.';
        setAssistantAnswer(text);
        setAssistantStep('lab-select');
        await speakText(text, languageToUse);
        return;
      }

      const answer = res.data.translated_answer || res.data.answer || 'No answer available.';
      setAssistantAnswer(answer);
      await speakText(answer, languageToUse);
    } catch {
      setAssistantAnswer('Could not connect to assistant service. Please ensure services are running.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextSubmit = (event) => {
    event.preventDefault();
    const value = textInput.trim();
    if (!value) return;
    setUserQuestion(value);
    setTextInput('');
    handleSubmitQuestion(value);
  };

  const handleLabSelect = (option) => {
    if (!option?.block || !option?.section) return;
    onClose();
    navigate(`/block/${option.block}/${option.section}`);
  };

  const resetSession = () => {
    stopListening();
    stopAudio();
    setAssistantMode(null);
    setAssistantStep('greeting');
    setUserQuestion('');
    setAssistantAnswer('');
    setTextInput('');
    setLabOptions([]);
    setLabQueryType('');
    setNeedsLunchCheck(false);
  };

  const handleClose = () => {
    stopListening();
    stopAudio();
    onClose();
    resetSession();
  };

  if (!isOpen) return null;

  return (
    <div className="assistant-modal-overlay" onClick={handleClose}>
      <div className="assistant-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="assistant-modal-header">
          <h1>Campus Assistant</h1>
          <button className="assistant-close-btn" onClick={handleClose}>✕</button>
        </div>

        <div className="assistant-modal-body">
          {assistantStep === 'greeting' && (
            <div className="assistant-state">
              <p>{assistantAnswer || 'Starting assistant...'}</p>
            </div>
          )}

          {assistantStep === 'mode-select' && (
            <div className="assistant-state">
              <p>Choose interaction mode</p>
              <div className="assistant-grid2">
                <button onClick={() => handleModeSelect('voice')}>Voice</button>
                <button onClick={() => handleModeSelect('text')}>Text</button>
              </div>
            </div>
          )}

          {assistantStep === 'language-select' && assistantMode === 'voice' && (
            <div className="assistant-state">
              <p>Select language</p>
              <div className="assistant-language-grid">
                {LANGUAGES.map((language) => (
                  <button key={language.code} onClick={() => handleLanguageSelect(language.code)}>
                    {language.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {assistantStep === 'lunch-check' && needsLunchCheck && (
            <div className="assistant-state">
              <p>{assistantAnswer}</p>
              <div className="assistant-grid2">
                <button onClick={() => handleLunchResponse(true)}>{(LUNCH_COPY[selectedLanguage] || LUNCH_COPY['en-IN']).yes}</button>
                <button onClick={() => handleLunchResponse(false)}>{(LUNCH_COPY[selectedLanguage] || LUNCH_COPY['en-IN']).no}</button>
              </div>
            </div>
          )}

          {assistantStep === 'input' && assistantMode === 'voice' && (
            <div className="assistant-state">
              <p>{isListening ? 'Listening...' : `Ready in ${LANGUAGES.find((l) => l.code === selectedLanguage)?.name || 'English'}`}</p>
              {userQuestion ? <div className="assistant-question-preview">{userQuestion}</div> : null}
              <div className="assistant-grid2">
                <button onClick={() => startVoiceInput(selectedLanguage)} disabled={isListening}>Start Voice</button>
                <button onClick={stopListening} disabled={!isListening}>Stop Voice</button>
              </div>
              <button className="assistant-secondary" onClick={() => setAssistantStep('language-select')}>Change Language</button>
            </div>
          )}

          {assistantStep === 'input' && assistantMode === 'text' && (
            <div className="assistant-state">
              <p>Type your question</p>
              <form onSubmit={handleTextSubmit} className="assistant-text-form">
                <textarea
                  rows={4}
                  value={textInput}
                  onChange={(event) => setTextInput(event.target.value)}
                  placeholder="Ask about fees, labs, admissions, hostel, transport..."
                />
                <button type="submit" disabled={!textInput.trim()}>Submit</button>
              </form>
            </div>
          )}

          {assistantStep === 'answer' && (
            <div className="assistant-state">
              {isLoading ? <p>Thinking...</p> : null}
              {userQuestion ? <div className="assistant-question-preview">Question: {userQuestion}</div> : null}
              <div className="assistant-answer">{assistantAnswer}</div>
              <div className="assistant-grid2">
                <button onClick={() => setAssistantStep('input')}>Ask Again</button>
                <button className="assistant-secondary" onClick={resetSession}>Start Over</button>
              </div>
            </div>
          )}

          {assistantStep === 'lab-select' && (
            <div className="assistant-state">
              <p>{assistantAnswer || `Select ${labQueryType === 'classrooms' ? 'classroom' : 'lab'}`}</p>
              <div className="assistant-language-grid">
                {labOptions.map((option) => {
                  const lang = (selectedLanguage || 'en-IN').split('-')[0];
                  const title = lang === 'te' && option.name_te ? option.name_te : (lang === 'hi' && option.name_hi ? option.name_hi : option.name);
                  return (
                    <button key={option.id} onClick={() => handleLabSelect(option)}>{title}</button>
                  );
                })}
              </div>
              <button className="assistant-secondary" onClick={() => setAssistantStep('input')}>Ask Something Else</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AssistantModal;
