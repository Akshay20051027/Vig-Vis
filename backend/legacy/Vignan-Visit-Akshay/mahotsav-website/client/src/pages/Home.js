import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function Home() {
  const navigate = useNavigate();
  const [blocks, setBlocks] = useState([]);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [showDialogue, setShowDialogue] = useState(false);
  
  // Assistant state management
  const [assistantMode, setAssistantMode] = useState(null); // 'voice' or 'text'
  const [assistantStep, setAssistantStep] = useState('mode-select'); // 'mode-select', 'language-select', 'input', 'answer', 'lab-select'
  const [selectedLanguage, setSelectedLanguage] = useState(null);
  const [userQuestion, setUserQuestion] = useState('');
  const [assistantAnswer, setAssistantAnswer] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [labOptions, setLabOptions] = useState([]);  // Lab/classroom options
  const [labQueryType, setLabQueryType] = useState('');  // 'labs' or 'classrooms'
  const [currentRecognition, setCurrentRecognition] = useState(null);  // Track speech recognition
  const [currentAudio, setCurrentAudio] = useState(null);  // Track playing audio
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);  // Track if audio is playing

  const languages = [
    { code: 'en-IN', name: 'English', flag: '🇬🇧' },
    { code: 'hi-IN', name: 'Hindi', flag: '🇮🇳' },
    { code: 'te-IN', name: 'Telugu', flag: '🇮🇳' },
    { code: 'ta-IN', name: 'Tamil', flag: '🇮🇳' },
    { code: 'kn-IN', name: 'Kannada', flag: '🇮🇳' },
    { code: 'ml-IN', name: 'Malayalam', flag: '🇮🇳' },
  ];

  useEffect(() => {
    fetchBlocks();
  }, []);

  const fetchBlocks = async () => {
    try {
      const response = await axios.get('/api/blocks');
      setBlocks(response.data);
    } catch (error) {
      console.error('Error fetching blocks:', error);
    }
  };

  const handleBlockClick = (blockName) => {
    navigate(`/block/${blockName}`);
  };

  const handleImageLoad = (e) => {
    setImageDimensions({
      width: e.target.offsetWidth,
      height: e.target.offsetHeight
    });
  };

  const handleAvatarClick = async () => {
    setShowDialogue(true);
    setAssistantStep('greeting');
    setAssistantMode(null);
    setSelectedLanguage('en-IN'); // Default to English for initial greeting
    setUserQuestion('');
    setAssistantAnswer('');
    
    // Get time-based greeting from API
    try {
      const response = await axios.get('http://localhost:5001/api/assistant/greeting?language=en-IN');
      if (response.data.greeting) {
        const greeting = response.data.greeting;
        setAssistantAnswer(greeting);
        
        // ALWAYS speak the greeting (matching voice_assistant.py behavior)
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(greeting);
          utterance.lang = 'en-IN';
          utterance.rate = 0.80;  // Slow/deliberate speed
          window.speechSynthesis.speak(utterance);
        }
        
        // Auto-advance to mode selection after greeting completes (3 seconds)
        setTimeout(() => {
          setAssistantStep('mode-select');
        }, 3000);
      }
    } catch (error) {
      console.error('Error fetching greeting:', error);
      // Show default greeting if API fails
      const defaultGreeting = "Hello! Welcome to Mahotsav-26 Campus Assistant.";
      setAssistantAnswer(defaultGreeting);
      
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(defaultGreeting);
        utterance.lang = 'en-IN';
        utterance.rate = 0.80;  // Slow/deliberate speed
        window.speechSynthesis.speak(utterance);
      }
      
      setTimeout(() => {
        setAssistantStep('mode-select');
      }, 3000);
    }
  };

  const closeDialogue = () => {
    // Stop any ongoing voice recognition
    if (currentRecognition) {
      currentRecognition.stop();
      setCurrentRecognition(null);
    }
    // Stop any playing audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
    }
    setShowDialogue(false);
    setAssistantStep('mode-select');
    setAssistantMode(null);
    setIsListening(false);
    setIsPlayingAudio(false);
    setTextInput('');
  };

  const stopListening = () => {
    if (currentRecognition) {
      currentRecognition.stop();
      setCurrentRecognition(null);
    }
    setIsListening(false);
  };

  const stopAudio = () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
    }
    setIsPlayingAudio(false);
  };

  const handleModeSelect = (mode) => {
    setAssistantMode(mode);
    if (mode === 'voice') {
      setAssistantStep('language-select');
    } else {
      setAssistantStep('input');
    }
  };

  const handleLanguageSelect = (langCode) => {
    console.log(`🌍 LANGUAGE SELECTED: ${langCode}`);
    setSelectedLanguage(langCode);
    setAssistantStep('input');
    // Auto-start listening after language selection
    setTimeout(() => startVoiceInput(langCode), 500);
  };

  const startVoiceInput = (langCode) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert('Voice recognition not supported in your browser. Please use Chrome or Edge.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = langCode || selectedLanguage || 'en-IN';
    // Store language on recognition object to avoid state race conditions
    recognition.langCode = langCode || selectedLanguage || 'en-IN';
    recognition.continuous = true;  // Keep listening for complete sentence
    recognition.interimResults = true;  // Show what's being said
    recognition.maxAlternatives = 1;

    setIsListening(true);
    let finalTranscript = '';
    let silenceTimer = null;

    recognition.onstart = () => {
      console.log('Voice recognition started - speak your complete question');
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
      
      // Show interim results
      const displayText = finalTranscript + interimTranscript;
      setUserQuestion(displayText.trim());
      
      // Clear existing timer
      if (silenceTimer) clearTimeout(silenceTimer);
      
      // Set timer to auto-submit after 2 seconds of silence
      silenceTimer = setTimeout(() => {
        if (finalTranscript.trim()) {
          recognition.stop();
          setIsListening(false);
          setUserQuestion(finalTranscript.trim());
          // Pass the stored language to avoid state race conditions
          handleSubmitQuestion(finalTranscript.trim(), recognition.langCode);
        }
      }, 2000);
    };

    recognition.onerror = (event) => {
      console.error('Voice recognition error:', event.error);
      setIsListening(false);
      alert('Could not understand. Please try again.');
    };

    recognition.onend = () => {
      setIsListening(false);
      setCurrentRecognition(null);
    };

    setCurrentRecognition(recognition);
    recognition.start();
  };

  const handleTextSubmit = (e) => {
    e.preventDefault();
    if (textInput.trim()) {
      setUserQuestion(textInput);
      handleSubmitQuestion(textInput);
    }
  };

  const handleSubmitQuestion = async (question, voiceLanguage = null) => {
    // Use voiceLanguage from speech recognition if available (avoids state race condition)
    // Otherwise fall back to selectedLanguage state
    const languageToUse = voiceLanguage || selectedLanguage || 'en-IN';
    console.log(`📤 SUBMITTING QUESTION:`);
    console.log(`   voiceLanguage param: ${voiceLanguage}`);
    console.log(`   selectedLanguage state: ${selectedLanguage}`);
    console.log(`   Using: ${languageToUse}`);
    setIsLoading(true);
    setAssistantStep('answer');

    try {
      // Add cache-busting timestamp to ensure fresh API call
      const timestamp = new Date().getTime();
      console.log(`📡 SENDING TO API: language='${languageToUse}', question='${question.substring(0, 50)}...'`);
      const response = await axios.post(`http://localhost:5001/api/assistant/query?t=${timestamp}`, {
        question: question,
        language: languageToUse
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });

      if (response.data.success) {
        // Check for combined response (FAISS answer + lab selection)
        if (response.data.type === 'combined_response') {
          const englishAnswer = response.data.answer;
          const translatedAnswer = response.data.translated_answer;
          const langName = response.data.language_name || 'English';
          
          // Display translated answer
          const displayAnswer = translatedAnswer || englishAnswer;
          setAssistantAnswer(displayAnswer);
          
          // Also show lab selection options
          setLabOptions(response.data.options);
          setLabQueryType(response.data.query_type);
          setAssistantStep('lab-select');
          
          console.log('=== Combined Response (Info + Selection) ===');
          console.log(`Question: ${question}`);
          console.log(`Language: ${langName} (${selectedLanguage})`);
          console.log(`[${langName}]:`, translatedAnswer);
          console.log(`Options: ${response.data.options.length} ${response.data.query_type}`);
          
          // Speak the answer using Flask TTS (enhanced gTTS)
          try {
            const ttsResponse = await fetch('http://localhost:5001/api/assistant/tts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: displayAnswer,
                language: selectedLanguage || 'en-IN'
              })
            });
            
            if (ttsResponse.ok) {
              const audioBlob = await ttsResponse.blob();
              const audioUrl = URL.createObjectURL(audioBlob);
              const audio = new Audio(audioUrl);
              setCurrentAudio(audio);
              setIsPlayingAudio(true);
              audio.onended = () => {
                setIsPlayingAudio(false);
                setCurrentAudio(null);
              };
              audio.play();
            } else {
              console.error('TTS failed, falling back to browser TTS');
              // Fallback to browser TTS
              if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(displayAnswer);
                utterance.lang = selectedLanguage || 'en-IN';
                utterance.rate = 0.80;  // Slow/deliberate speed
                window.speechSynthesis.speak(utterance);
              }
            }
          } catch (error) {
            console.error('TTS error:', error);
          }
          return;
        }
        
        // Check if this is a lab/classroom selection request (simple navigation only)
        if (response.data.type === 'lab_selection') {
          setLabOptions(response.data.options);
          setLabQueryType(response.data.query_type);
          setAssistantStep('lab-select');
          
          // Show prompt based on query type
          const prompt = response.data.query_type === 'labs' 
            ? 'Which lab would you like to see?' 
            : 'Which classroom would you like to see?';
          setAssistantAnswer(prompt);
          
          // Speak the prompt
          if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(prompt);
            utterance.lang = selectedLanguage || 'en-IN';
            utterance.rate = 0.80;  // Slow/deliberate speed
            window.speechSynthesis.speak(utterance);
          }
          return;
        }
        
        const englishAnswer = response.data.answer;
        const translatedAnswer = response.data.translated_answer;
        const langName = response.data.language_name || 'English';
        
        // Display translated answer ONLY (matching voice_assistant.py behavior)
        // The voice_assistant.py prints translated text to console, speaks it
        const displayAnswer = translatedAnswer || englishAnswer;
        setAssistantAnswer(displayAnswer);
        
        // Log both versions to console for debugging
        console.log('=== Assistant Response ===');
        console.log(`Question: ${question}`);
        console.log(`Language: ${langName} (${selectedLanguage})`);
        console.log(`[${langName}]:`, translatedAnswer);
        console.log('[English]:', englishAnswer);
        console.log('========================');
        
        // Speak using Flask TTS (enhanced gTTS)
        try {
          const ttsResponse = await fetch('http://localhost:5001/api/assistant/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: displayAnswer,
              language: selectedLanguage || 'en-IN'
            })
          });
          
          if (ttsResponse.ok) {
            const audioBlob = await ttsResponse.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            setCurrentAudio(audio);
            setIsPlayingAudio(true);
            audio.onended = () => {
              setIsPlayingAudio(false);
              setCurrentAudio(null);
            };
            audio.play();
          } else {
            console.error('TTS failed, falling back to browser TTS');
            // Fallback to browser TTS
            if ('speechSynthesis' in window) {
              window.speechSynthesis.cancel();
              const utterance = new SpeechSynthesisUtterance(displayAnswer);
              utterance.lang = selectedLanguage || 'en-IN';
              utterance.rate = 0.80;  // Slow/deliberate speed
              window.speechSynthesis.speak(utterance);
            }
          }
        } catch (error) {
          console.error('TTS error:', error);
        }
      } else {
        setAssistantAnswer('Sorry, I encountered an error. Please try again.');
      }
    } catch (error) {
      console.error('Error querying assistant:', error);
      setAssistantAnswer('Sorry, I could not connect to the assistant. Please make sure the API server is running.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAskAgain = () => {
    setTextInput('');
    setUserQuestion('');
    setAssistantAnswer('');
    if (assistantMode === 'voice') {
      setAssistantStep('input');
      setTimeout(() => startVoiceInput(), 500);
    } else {
      setAssistantStep('input');
    }
  };

  const handleBackToMode = () => {
    setAssistantStep('mode-select');
    setAssistantMode(null);
    setSelectedLanguage(null);
    setTextInput('');
    setUserQuestion('');
    setAssistantAnswer('');
  };
  
  const handleLabSelect = (labOption) => {
    // Close dialogue
    setShowDialogue(false);
    
    // Navigate to the block and section automatically
    const { block, section } = labOption;
    
    // Auto-navigate to block view with section (will play video automatically)
    navigate(`/block/${block}/${section}`);
  };

  return (
    <div className="map-container">
      <h1 className="title">Mahotsav 26 - Campus Map</h1>
      <div className="map-wrapper">
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <img
            src="/public/map.jpeg"
            alt="Campus Map"
            className="map-image"
            onLoad={handleImageLoad}
          />
          {/* Clickable areas for blocks */}
          {blocks.map((block) => (
            block.coordinates && (
              <div
                key={block.name}
                className="clickable-area"
                onClick={() => handleBlockClick(block.name)}
                style={{
                  position: 'absolute',
                  left: `${(block.coordinates.x / 100) * imageDimensions.width}px`,
                  top: `${(block.coordinates.y / 100) * imageDimensions.height}px`,
                  width: `${(block.coordinates.width / 100) * imageDimensions.width}px`,
                  height: `${(block.coordinates.height / 100) * imageDimensions.height}px`,
                }}
                title={block.displayName}
              >
                <div className="block-label">{block.displayName}</div>
              </div>
            )
          ))}
          
          {/* Lottie Animation - Bottom Right of Image */}
          <div 
            className="lottie-container" 
            style={{ position: 'absolute', bottom: '5px', right: '-100px', zIndex: 50, cursor: 'pointer' }}
            onClick={handleAvatarClick}
            title="Click to chat with me!"
          >
            <dotlottie-wc 
              src="https://lottie.host/c1110b37-658f-4161-b1e2-9f425e8aefe1/gCOADdinfh.lottie" 
              style={{ width: '150px', height: '150px', pointerEvents: 'none' }} 
              autoplay 
              loop
            ></dotlottie-wc>
          </div>
        </div>
      </div>

      {/* Dialogue Box */}
      {showDialogue && (
        <div className="dialogue-overlay">
          <div className="dialogue-box">
            <button className="dialogue-close" onClick={closeDialogue}>×</button>
            <div className="dialogue-header">
              <h2>Campus Assistant</h2>
            </div>
            <div className="dialogue-content">
              
              {/* Initial Greeting */}
              {assistantStep === 'greeting' && (
                <div className="assistant-greeting">
                  <div className="greeting-animation">
                    <span className="wave-emoji">👋</span>
                  </div>
                  <p className="greeting-text">{assistantAnswer}</p>
                  <p className="greeting-subtext">Initializing campus assistant...</p>
                </div>
              )}
              
              {/* Mode Selection */}
              {assistantStep === 'mode-select' && (
                <div className="assistant-mode-select">
                  <p className="mode-prompt">How would you like to interact?</p>
                  <div className="mode-buttons">
                    <button 
                      className="mode-button voice-button" 
                      onClick={() => handleModeSelect('voice')}
                    >
                      <span className="mode-icon">🎤</span>
                      <span className="mode-text">Voice Mode</span>
                    </button>
                    <button 
                      className="mode-button text-button" 
                      onClick={() => handleModeSelect('text')}
                    >
                      <span className="mode-icon">⌨️</span>
                      <span className="mode-text">Text Mode</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Language Selection (Voice Mode) */}
              {assistantStep === 'language-select' && assistantMode === 'voice' && (
                <div className="assistant-language-select">
                  <p className="language-prompt">Select your language:</p>
                  <div className="language-buttons">
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        className="language-button"
                        onClick={() => handleLanguageSelect(lang.code)}
                      >
                        <span className="language-flag">{lang.flag}</span>
                        <span className="language-name">{lang.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Lab/Classroom Selection */}
              {assistantStep === 'lab-select' && (
                <div className="assistant-lab-select">
                  {/* Show FAISS answer if it exists (for combined responses) */}
                  {assistantAnswer && assistantAnswer !== '' && (
                    <div className="answer-display combined-answer">
                      <div className="question-display">
                        <strong>You asked:</strong> {userQuestion}
                      </div>
                      <div className="answer-text">
                        <strong>Answer:</strong>
                        <p>{assistantAnswer}</p>
                      </div>
                      <hr className="answer-divider" />
                    </div>
                  )}
                  
                  <p className="lab-prompt">
                    {labQueryType === 'labs' ? 'Select a Lab:' : 'Select a Classroom:'}
                  </p>
                  <div className="lab-buttons">
                    {labOptions.map((lab) => {
                      // Get name based on selected language
                      const langCode = selectedLanguage?.split('-')[0] || 'en';
                      const displayName = langCode === 'te' && lab.name_te 
                        ? lab.name_te 
                        : langCode === 'hi' && lab.name_hi 
                        ? lab.name_hi 
                        : lab.name;
                      
                      return (
                        <button
                          key={lab.id}
                          className="lab-button"
                          onClick={() => handleLabSelect(lab)}
                        >
                          <span className="lab-icon">🔬</span>
                          <span className="lab-name">{displayName}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="lab-select-actions">
                    <button className="ask-again-button" onClick={handleAskAgain}>
                      Ask Another Question
                    </button>
                    <button className="back-button-assistant" onClick={handleBackToMode}>
                      ← Start Over
                    </button>
                  </div>
                </div>
              )}

              {/* Voice Input */}
              {assistantStep === 'input' && assistantMode === 'voice' && (
                <div className="assistant-voice-input">
                  {isListening ? (
                    <>
                      <div className="listening-animation">
                        <div className="pulse-circle"></div>
                        <div className="pulse-circle pulse-2"></div>
                        <div className="pulse-circle pulse-3"></div>
                      </div>
                      <p className="listening-text">🎤 Listening... Speak now!</p>
                      <p className="listening-hint">Ask about campus facilities, locations, or events</p>
                      {userQuestion && (
                        <div className="interim-transcript">
                          <p>📝 {userQuestion}</p>
                        </div>
                      )}
                      <button className="stop-listening-button" onClick={stopListening}>
                        ⏹️ Stop Listening
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="voice-ready">Ready to listen in {languages.find(l => l.code === selectedLanguage)?.name || 'English'}</p>
                      <button className="voice-start-button" onClick={() => startVoiceInput()}>
                        🎤 Start Speaking
                      </button>
                      <button className="back-button-assistant" onClick={() => setAssistantStep('language-select')}>
                        ← Change Language
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Text Input */}
              {assistantStep === 'input' && assistantMode === 'text' && (
                <div className="assistant-text-input">
                  <p className="text-prompt">Type your question:</p>
                  <form onSubmit={handleTextSubmit}>
                    <textarea
                      className="text-input-field"
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      placeholder="Ask about campus facilities, locations, events, etc."
                      rows="4"
                      autoFocus
                    />
                    <div className="text-input-actions">
                      <button 
                        type="submit" 
                        className="submit-button"
                        disabled={!textInput.trim()}
                      >
                        Submit Question →
                      </button>
                      <button 
                        type="button" 
                        className="back-button-assistant" 
                        onClick={handleBackToMode}
                      >
                        ← Back
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Answer Display */}
              {assistantStep === 'answer' && (
                <div className="assistant-answer">
                  {isLoading ? (
                    <div className="loading-spinner">
                      <div className="spinner"></div>
                      <p>Thinking...</p>
                    </div>
                  ) : (
                    <>
                      <div className="question-display">
                        <strong>You asked:</strong> {userQuestion}
                      </div>
                      <div className="answer-display">
                        <strong>Answer:</strong>
                        <p>{assistantAnswer}</p>
                      </div>
                      {isPlayingAudio && (
                        <button className="stop-audio-button" onClick={stopAudio}>
                          ⏹️ Stop Audio
                        </button>
                      )}
                      <div className="answer-actions">
                        <button className="ask-again-button" onClick={handleAskAgain}>
                          Ask Another Question
                        </button>
                        <button className="back-button-assistant" onClick={handleBackToMode}>
                          ← Start Over
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
