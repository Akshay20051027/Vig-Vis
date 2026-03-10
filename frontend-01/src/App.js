import React, { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Home from './pages/Home';
import Welcome from './pages/Welcome';
import './App.css';

const IntroAnimation = lazy(() => import('./components/IntroAnimation'));
const BlockView = lazy(() => import('./pages/BlockView'));
const VideoPlayer = lazy(() => import('./pages/VideoPlayer'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));

function AppContent() {
  const navigate = useNavigate();
  // Always show intro on every page reload
  const [showIntro, setShowIntro] = useState(true);

  const handleIntroComplete = () => {
    setShowIntro(false);
    // Navigate to home (map page) after intro dismisses
    if (window.location.pathname === '/') {
      navigate('/home');
    }
  };

  return (
    <>
      {showIntro && (
        <Suspense fallback={null}>
          <IntroAnimation onComplete={handleIntroComplete} />
        </Suspense>
      )}
      
      {!showIntro && (
        <div className="App">
          <Suspense fallback={null}>
            <Routes>
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route path="/home" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/block/:blockName" element={<BlockView />} />
              <Route path="/block/:blockName/:section" element={<VideoPlayer />} />
          </Routes>
        </Suspense>
      </div>
      )}
    </>
  );
}

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppContent />
    </Router>
  );
}

export default App;
