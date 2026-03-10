import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { cacheRead, cacheWrite } from '../utils/sessionCache';
import MagicSectionBento from '../Components/MagicSectionBento';

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
    if (!sectionName) return;
    navigate(`/block/${encodeURIComponent(blockName)}/${encodeURIComponent(sectionName)}`);
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!block) {
    return (
      <div className="block-container block-page">
        <header className="block-navbar" role="navigation" aria-label="Block page navigation">
          <div className="block-navbar__inner">
            <div className="block-navbar__left">
              <button type="button" className="block-nav-back" onClick={() => navigate('/home')}>
                <span className="block-nav-arrow">←</span> BLOCK PREVIEW
              </button>
            </div>
            <h1 className="block-navbar__title">Block</h1>
            <div className="block-navbar__right" aria-hidden="true" />
          </div>
        </header>
        <div className="block-page-content">
          <div className="loading">Block not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="block-container block-page">
      <header className="block-navbar" role="navigation" aria-label="Block page navigation">
        <div className="block-navbar__inner">
          <div className="block-navbar__left">
            <button type="button" className="block-nav-back" onClick={() => navigate('/home')}>
              ← BLOCK PREVIEW
            </button>
          </div>
          <h1 className="block-navbar__title">{block.displayName}</h1>
          <div className="block-navbar__right" aria-hidden="true" />
        </div>
      </header>

      <main className="block-page-content">
        <MagicSectionBento
          blockDisplayName={block.displayName}
          blockImage={block.image}
          sections={block.sections || []}
          onSectionClick={handleSectionClick}
          onBlockPreviewClick={() => navigate('/home')}
        />
      </main>
    </div>
  );
}

export default BlockView;
