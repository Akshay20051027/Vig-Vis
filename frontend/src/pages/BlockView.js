import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { cacheRead, cacheWrite } from '../utils/sessionCache';

const blockCacheKey = (blockName) => `block.${blockName}.v1`;

function BlockView() {
  const { blockName } = useParams();
  const navigate = useNavigate();
  const cached = cacheRead(blockCacheKey(blockName), null);
  const [block, setBlock] = useState(cached);
  const [loading, setLoading] = useState(!cached);

  const fetchBlock = useCallback(async () => {
    try {
      // Don't show a loader if we already have cached content.
      if (!cached) setLoading(true);
      const response = await axios.get(`/api/blocks/${blockName}`);
      setBlock(response.data);
      cacheWrite(blockCacheKey(blockName), response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching block:', error);
      setLoading(false);
    }
  }, [blockName, cached]);

  useEffect(() => {
    fetchBlock();
  }, [fetchBlock]);

  const handleSectionClick = (sectionName) => {
    navigate(`/block/${blockName}/${sectionName}`);
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!block) {
    return (
      <div className="block-container">
        <button className="back-button" onClick={() => navigate('/home') }>
          ← Back to Map
        </button>
        <div className="loading">Block not found</div>
      </div>
    );
  }

  return (
    <div className="block-container">
      <button className="back-button" onClick={() => {
        navigate('/home');
      }}>
        ← Back to Map
      </button>
      <h1 className="title">{block.displayName}</h1>

      {block.image ? (
        <img
          src={block.image}
          alt={block.displayName}
          className="block-image"
        />
      ) : (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: '#6b7280',
          fontSize: '16px',
          background: 'rgba(59, 130, 246, 0.1)',
          borderRadius: '12px',
          margin: '20px 0'
        }}>
          📸 No image uploaded yet<br />
          <small>Go to Dashboard to upload an image for this block</small>
        </div>
      )}

      {/* Clickable areas positioned using coordinates or default corners */}
      {block.sections && block.sections.length > 0 ? (
        block.sections.map((section, index) => {
          // Use section coordinates if available, otherwise use default corner positions
          if (section.coordinates && section.coordinates.x !== undefined) {
            // Use percentage-based positioning from database
            return (
              <div
                key={section.name}
                className="section-clickable-area"
                style={{
                  position: 'absolute',
                  left: `${section.coordinates.x}%`,
                  top: `${section.coordinates.y}%`,
                  width: `${section.coordinates.width}%`,
                  height: `${section.coordinates.height}%`,
                  transform: 'none' // Override default transform
                }}
                onClick={() => handleSectionClick(section.name)}
                title={`Click to view ${section.displayName}`}
              >
                <span className="section-hover-label">{section.displayName}</span>
              </div>
            );
          } else {
            // Fallback to side-centered positioning
          const positions = [
            { top: '50%', left: '40px', transform: 'translateY(-50%)' },      // Position 1: Left side, vertically centered
            { top: '50%', right: '40px', transform: 'translateY(-50%)' },     // Position 2: Right side, vertically centered
            { top: '30%', left: '40px', transform: 'translateY(-50%)' },      // Position 3: Left side, upper
            { top: '30%', right: '40px', transform: 'translateY(-50%)' },     // Position 4: Right side, upper
            { top: '70%', left: '40px', transform: 'translateY(-50%)' },      // Position 5: Left side, lower
            { top: '70%', right: '40px', transform: 'translateY(-50%)' }      // Position 6: Right side, lower
          ];
          const posStyle = positions[index % positions.length];
          
          return (
            <div
              key={section.name}
              className="section-clickable-area"
              style={{
                position: 'absolute',
                ...posStyle
              }}
              onClick={() => handleSectionClick(section.name)}
              title={`Click to view ${section.displayName}`}
            >
              <span className="section-hover-label">{section.displayName}</span>
            </div>
          );
        }
      })
      ) : (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: '#6b7280',
          fontSize: '16px',
          background: 'rgba(249, 115, 22, 0.1)',
          borderRadius: '12px',
          margin: '20px 0'
        }}>
          📋 No sections added yet<br />
          <small>Go to Dashboard to add sections (Classrooms, Labs, etc.)</small>
        </div>
      )}
    </div>
  );
}

export default BlockView;
