import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function Home() {
  const navigate = useNavigate();
  const [blocks, setBlocks] = useState([]);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

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

  return (
    <div className="map-container">
      <button 
        className="login-button" 
        onClick={() => navigate('/login')}
        title="Admin Login"
      >
        🔐 Admin Login
      </button>
      <h1 className="title">Mahotsav 26 - Campus Map</h1>
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
              title={block.displayName || block.name}
            >
              <div className="block-label">{block.displayName || block.name}</div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}

export default Home;
