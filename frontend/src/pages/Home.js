import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const CACHE_KEYS = {
  blocks: 'home.blocks.v1',
  mapLastUpdated: 'home.mapLastUpdated.v1'
};

function Home() {
  const navigate = useNavigate();
  const [blocks, setBlocks] = useState(() => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEYS.blocks);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [isAdmin, setIsAdmin] = useState(false);
  // Use server-reported lastUpdated to avoid re-downloading map on every navigation.
  const [mapTimestamp, setMapTimestamp] = useState(() => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEYS.mapLastUpdated);
      const value = Math.trunc(Number(raw));
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch {
      return 0;
    }
  });

  const [imageBounds, setImageBounds] = useState(null);
  
  // Edit mode states
  const [editMode, setEditMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState(null);
  const [currentRect, setCurrentRect] = useState(null);
  const [tempRects, setTempRects] = useState([]);
  
  const imageRef = useRef(null);
  const containerRef = useRef(null);
  const drawImageRectRef = useRef(null);
  const drawRafRef = useRef(null);
  const drawPendingPointRef = useRef(null);

  // Keep in sync with the <img> style below
  const MAP_OBJECT_FIT = 'cover';
  const MAP_POLL_MS = 60000;

  useEffect(() => {
    // Check if user is logged in as admin
    const token = localStorage.getItem('adminToken');
    setIsAdmin(!!token);
    
    fetchBlocks();
    checkMapUpdate();
    
    const tick = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      checkMapUpdate();
    };

    // Check for map updates (reduced frequency for better scalability)
    const mapCheckInterval = setInterval(() => {
      tick();
    }, MAP_POLL_MS);

    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      tick();
    };
    document.addEventListener('visibilitychange', onVisibility);
    
    return () => {
      clearInterval(mapCheckInterval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const computeImageBounds = useCallback(() => {
    const img = imageRef.current;
    if (!img) {
      setImageBounds(null);
      return;
    }

    const containerWidth = img.offsetWidth;
    const containerHeight = img.offsetHeight;
    const imgNaturalWidth = img.naturalWidth;
    const imgNaturalHeight = img.naturalHeight;

    if (!containerWidth || !containerHeight || !imgNaturalWidth || !imgNaturalHeight) {
      setImageBounds(null);
      return;
    }

    const scale = MAP_OBJECT_FIT === 'cover'
      ? Math.max(containerWidth / imgNaturalWidth, containerHeight / imgNaturalHeight)
      : Math.min(containerWidth / imgNaturalWidth, containerHeight / imgNaturalHeight);

    const displayWidth = imgNaturalWidth * scale;
    const displayHeight = imgNaturalHeight * scale;
    const offsetX = (containerWidth - displayWidth) / 2;
    const offsetY = (containerHeight - displayHeight) / 2;

    setImageBounds({ displayWidth, displayHeight, offsetX, offsetY });
  }, []);

  useEffect(() => {
    const onResize = () => {
      // Run after layout settles.
      if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => computeImageBounds());
      } else {
        computeImageBounds();
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [computeImageBounds]);

  const checkMapUpdate = async () => {
    try {
      const response = await axios.get('/api/blocks/map-metadata');
      const raw = response?.data?.lastUpdated;
      const serverTimestamp = Math.trunc(Number(raw));

      if (!Number.isFinite(serverTimestamp) || serverTimestamp <= 0) return;

      // Use functional update to avoid stale-closure issues with setInterval.
      setMapTimestamp((prev) => {
        if (prev === serverTimestamp) return prev;
        try {
          sessionStorage.setItem(CACHE_KEYS.mapLastUpdated, String(serverTimestamp));
        } catch {
          // ignore
        }
        return serverTimestamp;
      });
    } catch (error) {
      console.error('Error checking map updates:', error);
    }
  };

  const fetchBlocks = async () => {
    try {
      const response = await axios.get('/api/blocks');
      const nextBlocks = response.data?.value || response.data;
      setBlocks(nextBlocks);
      try {
        sessionStorage.setItem(CACHE_KEYS.blocks, JSON.stringify(nextBlocks));
      } catch {
        // ignore
      }
    } catch (error) {
      console.error('Error fetching blocks:', error);
    }
  };

  const handleBlockClick = (blockName) => {
    navigate(`/block/${blockName}`);
  };
  
  const handleMapImageLoad = () => {
    computeImageBounds();
  };
  
  // Convert pixel coordinates to percentages relative to actual image
  const pixelsToPercent = (x, y, width, height) => {
    const bounds = imageBounds;
    if (!bounds) return null;
    
    const relativeX = x - bounds.offsetX;
    const relativeY = y - bounds.offsetY;
    
    const result = {
      x: (relativeX / bounds.displayWidth) * 100,
      y: (relativeY / bounds.displayHeight) * 100,
      width: (width / bounds.displayWidth) * 100,
      height: (height / bounds.displayHeight) * 100
    };

    if (![result.x, result.y, result.width, result.height].every(Number.isFinite)) {
      return null;
    }

    return result;
  };
  
  // Convert percentage coordinates to pixels for display
  const percentToPixels = (coords) => {
    const bounds = imageBounds;
    if (!bounds) return null;
    
    const result = {
      left: bounds.offsetX + (coords.x / 100) * bounds.displayWidth,
      top: bounds.offsetY + (coords.y / 100) * bounds.displayHeight,
      width: (coords.width / 100) * bounds.displayWidth,
      height: (coords.height / 100) * bounds.displayHeight
    };

    if (![result.left, result.top, result.width, result.height].every(Number.isFinite)) {
      return null;
    }

    return result;
  };

  const blocksWithPixels = useMemo(() => {
    if (!imageBounds || !blocks || blocks.length === 0) return [];
    return blocks
      .map((block) => {
        if (!block || !block.coordinates) return null;

        const coords = block.coordinates;
        const left = imageBounds.offsetX + (coords.x / 100) * imageBounds.displayWidth;
        const top = imageBounds.offsetY + (coords.y / 100) * imageBounds.displayHeight;
        const width = (coords.width / 100) * imageBounds.displayWidth;
        const height = (coords.height / 100) * imageBounds.displayHeight;

        if (![left, top, width, height].every(Number.isFinite)) return null;

        return {
          block,
          pixelCoords: { left, top, width, height },
        };
      })
      .filter(Boolean);
  }, [blocks, imageBounds]);
  
  // Mouse handlers for drawing rectangles
  const handleMouseDown = (e) => {
    if (!isAdmin || !editMode) return;

    const img = imageRef.current;
    if (!img) return;

    const rect = img.getBoundingClientRect();
    drawImageRectRef.current = rect;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsDrawing(true);
    setStartPos({ x, y });
    setCurrentRect({ x, y, width: 0, height: 0 });
  };
  
  const handleMouseMove = (e) => {
    if (!isAdmin || !editMode || !isDrawing || !startPos) return;

    const rect = drawImageRectRef.current;
    if (!rect) return;

    // Throttle updates to animation frames to keep dragging smooth.
    drawPendingPointRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    if (drawRafRef.current) return;

    drawRafRef.current = window.requestAnimationFrame(() => {
      drawRafRef.current = null;

      const pending = drawPendingPointRef.current;
      if (!pending) return;

      const width = pending.x - startPos.x;
      const height = pending.y - startPos.y;

      setCurrentRect({
        x: width > 0 ? startPos.x : pending.x,
        y: height > 0 ? startPos.y : pending.y,
        width: Math.abs(width),
        height: Math.abs(height),
      });
    });
  };
  
  const handleMouseUp = async (e) => {
    if (!isAdmin || !editMode || !isDrawing || !currentRect) return;

    setIsDrawing(false);

    if (drawRafRef.current) {
      window.cancelAnimationFrame(drawRafRef.current);
      drawRafRef.current = null;
    }
    drawPendingPointRef.current = null;
    drawImageRectRef.current = null;
    
    // Only save if rectangle has reasonable size
    if (currentRect.width > 20 && currentRect.height > 20) {
      const blockName = prompt('Enter block name (e.g., "A-Block", "U-BLOCK"):');
      if (!blockName) {
        setCurrentRect(null);
        return;
      }
      
      // Convert to percentages
      const percentCoords = pixelsToPercent(
        currentRect.x,
        currentRect.y,
        currentRect.width,
        currentRect.height
      );
      
      if (percentCoords) {
        try {
          // Save to database
          await axios.post('/api/blocks', {
            name: blockName,
            displayName: blockName,
            coordinates: percentCoords,
            sections: []
          });
          
          alert(`✅ ${blockName} created successfully!\nCoordinates: ${percentCoords.x.toFixed(2)}%, ${percentCoords.y.toFixed(2)}%`);
          
          // Refresh blocks
          fetchBlocks();
        } catch (error) {
          console.error('Error creating block:', error);
          alert('❌ Failed to create block. See console for details.');
        }
      }
    }
    
    setCurrentRect(null);
    setStartPos(null);
  };
  
  const toggleEditMode = () => {
    if (!isAdmin) return;
    setEditMode(!editMode);
  };
  
  const deleteBlock = async (blockName) => {
    try {
      await axios.delete(`/api/blocks/${blockName}`);
      alert(`✅ ${blockName} deleted!`);
      fetchBlocks();
    } catch (error) {
      const status = error?.response?.status;
      const message = error?.response?.data?.message;
      if (status === 503 && message) {
        alert(`❌ ${message}`);
      } else {
        alert('❌ Failed to delete block');
      }
    }
  };

  return (
    <div className="map-container">
      <h1 
        className={`title ${isAdmin ? 'admin-mode' : ''}`}
        title="Vignan University Navigator"
      >
        Vignan University Navigator
      </h1>

      {/* Navbar actions (keep Admin Edit Map in the top bar) */}
      <div className="home-nav-actions">
        {/* Hidden - navigate to /login directly instead */}
        {false && (
        <button
          type="button"
          className={`home-nav-btn ${isAdmin ? (editMode ? 'home-nav-btn--danger' : 'home-nav-btn--primary') : 'home-nav-btn--muted'}`}
          onClick={() => {
            if (!isAdmin) {
              navigate('/login');
              return;
            }
            toggleEditMode();
          }}
          title={isAdmin ? 'Edit map rectangles' : 'Admin login required'}
        >
          {isAdmin ? (editMode ? '❌ Exit Edit Map' : '✏️ Edit Map') : 'Admin Edit Map'}
        </button>
        )}

        {isAdmin && editMode && (
          <button
            type="button"
            className="home-nav-btn home-nav-btn--secondary"
            onClick={() => navigate('/dashboard')}
            title="Open Dashboard"
          >
            📊 Dashboard
          </button>
        )}
      </div>
      
      {isAdmin && editMode && (
        <div style={{
          position: 'absolute',
          top: '70px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          background: 'rgba(59, 130, 246, 0.95)',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '8px',
          fontWeight: '600',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          🖱️ EDIT MODE: Click and drag to draw a block rectangle
        </div>
      )}
      
      <div 
        ref={containerRef}
        style={{ 
          position: 'relative', 
          width: '100%', 
          height: '100%', 
          flex: 1, 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          cursor: editMode ? 'crosshair' : 'default'
        }}
      >
        <div
          style={{ position: 'relative', width: '100%', height: '100%' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <img
            ref={imageRef}
            src={mapTimestamp ? `/api/blocks/map-image?t=${mapTimestamp}` : '/api/blocks/map-image'}
            alt="Campus Map"
            className="map-image"
            style={{ 
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%', 
              height: '100%', 
              objectFit: 'cover',
              pointerEvents: isAdmin && editMode ? 'none' : 'auto'
            }}
            decoding="async"
            onLoad={handleMapImageLoad}
          />
          
          {/* Current drawing rectangle */}
          {isAdmin && editMode && currentRect && (
            <div
              style={{
                position: 'absolute',
                left: `${currentRect.x}px`,
                top: `${currentRect.y}px`,
                width: `${currentRect.width}px`,
                height: `${currentRect.height}px`,
                border: '3px dashed #10b981',
                background: 'rgba(16, 185, 129, 0.2)',
                pointerEvents: 'none',
                zIndex: 1500
              }}
            />
          )}
          
          {/* Clickable areas for blocks */}
          {blocksWithPixels.map(({ block, pixelCoords }) => {
            return (
              <div
                key={block.name}
                className={`clickable-area ${editMode ? 'edit-mode' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isAdmin && editMode) {
                    if (window.confirm(`Delete ${block.displayName || block.name}?`)) {
                      deleteBlock(block.name);
                    }
                    return;
                  }
                  handleBlockClick(block.name);
                }}
                style={{
                  position: 'absolute',
                  left: `${pixelCoords.left}px`,
                  top: `${pixelCoords.top}px`,
                  width: `${pixelCoords.width}px`,
                  height: `${pixelCoords.height}px`,
                  border: isAdmin && editMode ? '3px solid #3b82f6' : 'none',
                  background: isAdmin && editMode ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
                  zIndex: isAdmin && editMode ? (isDrawing ? 20 : 1200) : 10,
                  pointerEvents: 'auto'
                }}
                title={isAdmin && editMode ? `${block.displayName || block.name}\n${block.coordinates.x.toFixed(1)}%, ${block.coordinates.y.toFixed(1)}%` : (block.displayName || block.name)}
              >
                {isAdmin && editMode && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Delete ${block.displayName || block.name}?`)) {
                        deleteBlock(block.name);
                      }
                    }}
                    style={{
                      position: 'absolute',
                      top: '6px',
                      right: '6px',
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      border: '2px solid white',
                      background: '#ef4444',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      zIndex: 1000,
                      pointerEvents: 'auto',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Home;
