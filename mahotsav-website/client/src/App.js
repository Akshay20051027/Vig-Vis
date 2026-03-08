import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import BlockView from './pages/BlockView';
import VideoPlayer from './pages/VideoPlayer';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/block/:blockName" element={<BlockView />} />
          <Route path="/block/:blockName/:section" element={<VideoPlayer />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
