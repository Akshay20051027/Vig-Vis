import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import BlockView from './pages/BlockView';
import VideoPlayer from './pages/VideoPlayer';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/block/:blockName" element={<BlockView />} />
          <Route path="/block/:blockName/:section" element={<VideoPlayer />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
