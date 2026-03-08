import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

function BlockView() {
  const { blockName } = useParams();
  const navigate = useNavigate();
  const [block, setBlock] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchBlock = useCallback(async () => {
    try {
      const response = await axios.get(`/api/blocks/${blockName}`);
      setBlock(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching block:', error);
      setLoading(false);
    }
  }, [blockName]);

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
    return <div className="loading">Block not found</div>;
  }

  return (
    <div className="block-container">
      <button className="back-button" onClick={() => navigate('/')}>
        ← Back to Map
      </button>
      <h1 className="title">{block.displayName}</h1>
      
      <img
        src={block.image}
        alt={block.displayName}
        className="block-image"
      />

      {/* Invisible clickable areas positioned at corners */}
      {block.sections && block.sections.map((section, index) => {
        const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
        const position = positions[index % positions.length];
        
        return (
          <div
            key={section.name}
            className={`section-clickable-area ${position}`}
            onClick={() => handleSectionClick(section.name)}
            title={`Click to view ${section.displayName}`}
          >
            <span className="section-hover-label">{section.displayName}</span>
          </div>
        );
      })}
    </div>
  );
}

export default BlockView;
