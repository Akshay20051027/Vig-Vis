import React, { useMemo, useRef, useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { Clock } from 'three';

function FloatingSpheres() {
  const group = useRef(null);

  const spheres = useMemo(() => {
    return Array.from({ length: 15 }).map((_, i) => {
      const radius = 8 + Math.random() * 12;
      const theta = (i / 15) * Math.PI * 2;
      const phi = Math.acos((Math.random() - 0.5) * 2);

      return {
        key: i,
        position: [
          radius * Math.sin(phi) * Math.cos(theta),
          radius * Math.sin(phi) * Math.sin(theta),
          radius * Math.cos(phi)
        ],
        primary: i % 3 === 0
      };
    });
  }, []);

  useFrame((state) => {
    if (group.current) {
      group.current.rotation.y = state.clock.getElapsedTime() * 0.05;
    }
  });

  return (
    <group ref={group}>
      {spheres.map((s) => (
        <Sphere key={s.key} args={[0.15, 16, 16]} position={s.position}>
          <meshStandardMaterial
            color={s.primary ? '#3b82f6' : '#60a5fa'}
            emissive={s.primary ? '#2563eb' : '#3b82f6'}
            emissiveIntensity={0.4}
            transparent
            opacity={0.7}
          />
        </Sphere>
      ))}
    </group>
  );
}

function BackgroundScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 12], fov: 50 }}
      style={{ position: 'absolute', inset: 0 }}
      dpr={[1, 1.5]}
      gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
    >
      <ambientLight intensity={0.2} />
      <pointLight position={[15, 15, 15]} intensity={0.8} color="#3b82f6" />
      <pointLight position={[-15, -15, -15]} intensity={0.4} color="#60a5fa" />
      <FloatingSpheres />
    </Canvas>
  );
}

export default function IntroAnimation({ onComplete }) {
  const [showIntro, setShowIntro] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const audioRef = useRef(null);
  const clockRef = useRef(new Clock());
  const announcementStartedRef = useRef(false);

  const welcomeTexts = {
    en: 'Welcome to Vignan University',
    te: 'విజ్ఞాన్ విశ్వవిద్యాలయానికి స్వాగతం',
    hi: 'विग्नान विश्वविद्यालय में आपका स्वागत है'
  };

  // Handle responsive layout
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Announce welcome message in all languages
  useEffect(() => {
    if (showIntro && !isExiting && hasUserInteracted && !announcementStartedRef.current) {
      announcementStartedRef.current = true;
      const clock = clockRef.current;
      let elapsedTime = 0;
      const delayBefore = 0.3; // 300ms delay using THREE.Clock

      const announceWelcome = async () => {
        const languages = [
          { text: welcomeTexts.en, code: 'en-IN' },
          { text: welcomeTexts.te, code: 'te-IN' },
          { text: welcomeTexts.hi, code: 'hi-IN' }
        ];

        for (const lang of languages) {
          try {
            console.log('Announcing:', lang.text, 'in', lang.code);
            
            const response = await fetch('/api/assistant/tts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: lang.text, language: lang.code })
            });
            
            if (response.ok) {
              const blob = await response.blob();
              const url = URL.createObjectURL(blob);
              const audio = new Audio(url);
              audioRef.current = audio;
              
              // Play the audio
              await new Promise((resolve) => {
                audio.onended = () => {
                  URL.revokeObjectURL(url);
                  resolve();
                };
                audio.onerror = () => {
                  console.error('Audio error for', lang.code);
                  URL.revokeObjectURL(url);
                  resolve();
                };
                
                audio.play().catch(err => {
                  console.error('Play error:', err);
                  resolve();
                });
              });
              
              // Wait 1 second before next language using THREE.Clock
              const gapClock = new Clock();
              await new Promise(resolve => {
                const checkInterval = setInterval(() => {
                  if (gapClock.getElapsedTime() >= 1.0) {
                    clearInterval(checkInterval);
                    resolve();
                  }
                }, 50);
              });
            }
          } catch (error) {
            console.error('TTS Error for', lang.code, ':', error);
            // Fallback to browser TTS
            if ('speechSynthesis' in window) {
              const utterance = new SpeechSynthesisUtterance(lang.text);
              utterance.lang = lang.code;
              utterance.rate = 1.4;
              window.speechSynthesis.speak(utterance);
              
              // Wait for browser TTS
              await new Promise(resolve => {
                utterance.onend = () => resolve();
                setTimeout(resolve, 3000); // Max 3 seconds
              });
            }
          }
        }
      };
      
      // Use THREE.Clock to manage the initial delay
      const clockCheckInterval = setInterval(() => {
        if (clockRef.current.getElapsedTime() >= delayBefore) {
          clearInterval(clockCheckInterval);
          announceWelcome();
        }
      }, 50);
      
      return () => {
        clearInterval(clockCheckInterval);
      };
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [showIntro, isExiting, hasUserInteracted]);

  const handleDismissIntro = () => {
    if (isExiting) return;
    
    // Enable audio playback after user interaction
    if (!hasUserInteracted) {
      setHasUserInteracted(true);
      return; // Don't dismiss yet, just enable audio
    }

    setIsExiting(true);
    setTimeout(() => {
      setShowIntro(false);
      onComplete?.();
    }, 700);
  };

  return (
    <AnimatePresence>
      {showIntro && (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: isExiting ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7 }}
          onClick={handleDismissIntro}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 99999,
            background:
              'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <div style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.3 }}>
            <BackgroundScene />
          </div>

          <div
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              backgroundImage:
                'linear-gradient(rgba(59, 130, 246, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.03) 1px, transparent 1px)',
              backgroundSize: '50px 50px',
              opacity: 0.4
            }}
          />

          <div
            style={{
              position: 'relative',
              zIndex: 10,
              display: 'flex',
              flexDirection: !isMobile ? 'row' : 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              maxWidth: '1400px',
              padding: '40px',
              gap: '60px'
            }}
          >
            {/* Left Section - 60% - Text Content */}
            <div
              style={{
                flex: !isMobile ? '0.6' : '1',
                display: 'flex',
                flexDirection: 'column',
                alignItems: !isMobile ? 'flex-start' : 'center',
                justifyContent: 'center',
                textAlign: !isMobile ? 'left' : 'center',
                width: '100%'
              }}
            >
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                style={{ marginBottom: '30px' }}
              >
                <motion.h1
                  style={{
                    fontSize: 'clamp(2.5rem, 8vw, 6rem)',
                    fontWeight: '700',
                    background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    letterSpacing: '0.05em',
                    marginBottom: '16px',
                    lineHeight: '1.1',
                    textTransform: 'uppercase'
                  }}
                  animate={{ opacity: [1, 0.95, 1] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                >
                  VIGNAN
                </motion.h1>

                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.7 }}
                  style={{
                    fontSize: 'clamp(1.2rem, 3vw, 2.2rem)',
                    fontWeight: '300',
                    color: '#94a3b8',
                    letterSpacing: '0.3em',
                    marginBottom: '12px',
                    textTransform: 'uppercase'
                  }}
                >
                  COUNSELLING SYSTEM
                </motion.h2>
              </motion.div>

              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: '250px', opacity: 1 }}
                transition={{ duration: 1, delay: 1.1 }}
                style={{
                  height: '1px',
                  background: 'linear-gradient(90deg, transparent, #3b82f6, transparent)',
                  marginBottom: '30px',
                  position: 'relative',
                  alignSelf: !isMobile ? 'flex-start' : 'center'
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '6px',
                    height: '6px',
                    background: '#3b82f6',
                    borderRadius: '50%',
                    boxShadow: '0 0 20px rgba(59, 130, 246, 0.8)'
                  }}
                />
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: isExiting ? 0 : 0.8 }}
                transition={{ delay: 1.6, duration: 1 }}
                style={{
                  fontSize: 'clamp(0.9rem, 1.8vw, 1.2rem)',
                  color: '#64748b',
                  fontWeight: '400',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  maxWidth: '600px',
                  marginBottom: '30px'
                }}
              >
                Empowering Excellence Through Guidance
              </motion.p>

              {/* User Interaction Prompt */}
              {!hasUserInteracted && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: [0.6, 1], y: 0 }}
                  transition={{ delay: 1.9, duration: 0.6, repeat: Infinity, repeatType: 'reverse' }}
                  style={{
                    marginBottom: '30px',
                    fontSize: '0.9rem',
                    color: '#60a5fa',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase'
                  }}
                >
                  Click to Enable Audio
                </motion.div>
              )}

              {/* Multilingual Welcome Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 2.2, duration: 0.8 }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  maxWidth: '700px',
                  width: '100%'
                }}
              >
                <motion.div
                  style={{
                    fontSize: 'clamp(1rem, 2vw, 1.4rem)',
                    fontWeight: '600',
                    background: 'linear-gradient(90deg, #60a5fa 0%, #3b82f6 50%, #60a5fa 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    letterSpacing: '0.03em'
                  }}
                >
                  {welcomeTexts.en}
                </motion.div>

                <motion.div
                  style={{
                    fontSize: 'clamp(0.95rem, 1.8vw, 1.3rem)',
                    fontWeight: '500',
                    background: 'linear-gradient(90deg, #34d399 0%, #10b981 50%, #34d399 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}
                >
                  {welcomeTexts.te}
                </motion.div>

                <motion.div
                  style={{
                    fontSize: 'clamp(0.95rem, 1.8vw, 1.3rem)',
                    fontWeight: '500',
                    background: 'linear-gradient(90deg, #f472b6 0%, #ec4899 50%, #f472b6 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}
                >
                  {welcomeTexts.hi}
                </motion.div>
              </motion.div>

              <motion.div style={{ display: 'flex', gap: '12px', marginTop: '40px' }}>
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#3b82f6',
                      boxShadow: '0 0 15px rgba(59, 130, 246, 0.6)'
                    }}
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{
                      duration: 1.5,
                      delay: i * 0.2,
                      repeat: Infinity,
                      ease: 'easeInOut'
                    }}
                  />
                ))}
              </motion.div>
            </div>

            {/* Right Section - 40% - Robot Avatar */}
            <div
              style={{
                flex: !isMobile ? '0.4' : '1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}
            >
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                style={{
                  width: !isMobile ? '480px' : '300px',
                  height: !isMobile ? '480px' : '300px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 50,
                  filter: 'drop-shadow(0 10px 30px rgba(59, 130, 246, 0.5))',
                  borderRadius: '50%',
                  overflow: 'hidden'
                }}
              >
                <DotLottieReact
                  src="https://lottie.host/c1110b37-658f-4161-b1e2-9f425e8aefe1/gCOADdinfh.lottie"
                  loop
                  autoplay
                  style={{ width: '150%', height: '130%' }}
                />
              </motion.div>
            </div>

            <div
              style={{
                position: 'absolute',
                inset: 0,
                overflow: 'hidden',
                pointerEvents: 'none'
              }}
            >
              {Array.from({ length: 25 }).map((_, i) => (
                <motion.div
                  key={i}
                  style={{
                    position: 'absolute',
                    width: '2px',
                    height: '2px',
                    background: i % 2 === 0 ? '#3b82f6' : '#60a5fa',
                    borderRadius: '50%',
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    filter: 'blur(0.5px)',
                    opacity: 0.4
                  }}
                  animate={{ opacity: [0, 0.6, 0], y: [0, -100], scale: [0, 1, 0] }}
                  transition={{
                    duration: 6,
                    delay: Math.random() * 3,
                    repeat: Infinity,
                    ease: 'easeOut'
                  }}
                />
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2 }}
              style={{
                position: 'absolute',
                bottom: '80px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '300px',
                height: '2px',
                background: 'rgba(59, 130, 246, 0.1)',
                borderRadius: '2px',
                overflow: 'hidden'
              }}
            >
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: isExiting ? '100%' : '90%' }}
                transition={{ duration: 4, ease: 'easeInOut' }}
                style={{
                  height: '100%',
                  background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                  borderRadius: '2px',
                  boxShadow: '0 0 10px rgba(59, 130, 246, 0.6)'
                }}
              />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
