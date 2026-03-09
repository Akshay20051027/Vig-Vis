import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Lottie from 'lottie-react';
import Assistant from './Assistant';

const CACHE_KEYS = {
  blocks: 'home.blocks.v1',
  mapLastUpdated: 'home.mapLastUpdated.v1',
  robotAnimation: 'home.robotAnimation.v1'
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
  const [robotAnimation, setRobotAnimation] = useState(() => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEYS.robotAnimation);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
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
  const [, setLayoutTick] = useState(0);

  const [assistantOpen, setAssistantOpen] = useState(false);
  
  // Edit mode states
  const [editMode, setEditMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState(null);
  const [currentRect, setCurrentRect] = useState(null);
  const [tempRects, setTempRects] = useState([]);
  
  const imageRef = useRef(null);
  const containerRef = useRef(null);

  // Keep in sync with the <img> style below
  const MAP_OBJECT_FIT = 'cover';

  useEffect(() => {
    // Check if user is logged in as admin
    const token = localStorage.getItem('adminToken');
    setIsAdmin(!!token);
    
    fetchBlocks();
    fetchRobotAnimation();
    checkMapUpdate();
    
    // Check for map updates every 10 seconds
    const mapCheckInterval = setInterval(() => {
      checkMapUpdate();
    }, 10000);
    
    return () => clearInterval(mapCheckInterval);
  }, []);

  useEffect(() => {
    const onResize = () => {
      // Force a re-render so %->px conversion uses latest size
      setLayoutTick((t) => t + 1);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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

  const fetchRobotAnimation = async () => {
    if (robotAnimation) return;
    try {
      // Using a working free Lottie animation
      const response = await fetch('https://assets2.lottiefiles.com/packages/lf20_vnikrcia.json');
      const data = await response.json();
      setRobotAnimation(data);
      try {
        sessionStorage.setItem(CACHE_KEYS.robotAnimation, JSON.stringify(data));
      } catch {
        // ignore
      }
    } catch (error) {
      console.error('Error loading robot animation:', error);
      // Just use emoji fallback
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

  const handleAvatarClick = () => {
    setAssistantOpen((prev) => !prev);
  };
  
  const handleMapImageLoad = () => {
    setLayoutTick((t) => t + 1);
  };

  // Get actual displayed image dimensions (after object-fit)
  const getActualImageBounds = () => {
    if (!imageRef.current) return null;
    
    const img = imageRef.current;
    const containerWidth = img.offsetWidth;
    const containerHeight = img.offsetHeight;
    const imgNaturalWidth = img.naturalWidth;
    const imgNaturalHeight = img.naturalHeight;

    if (!containerWidth || !containerHeight || !imgNaturalWidth || !imgNaturalHeight) {
      return null;
    }

    const scale = MAP_OBJECT_FIT === 'cover'
      ? Math.max(containerWidth / imgNaturalWidth, containerHeight / imgNaturalHeight)
      : Math.min(containerWidth / imgNaturalWidth, containerHeight / imgNaturalHeight);

    const displayWidth = imgNaturalWidth * scale;
    const displayHeight = imgNaturalHeight * scale;
    const offsetX = (containerWidth - displayWidth) / 2;
    const offsetY = (containerHeight - displayHeight) / 2;
    
    return { displayWidth, displayHeight, offsetX, offsetY };
  };
  
  // Convert pixel coordinates to percentages relative to actual image
  const pixelsToPercent = (x, y, width, height) => {
    const bounds = getActualImageBounds();
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
    const bounds = getActualImageBounds();
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
  
  // Mouse handlers for drawing rectangles
  const handleMouseDown = (e) => {
    if (!isAdmin || !editMode) return;
    
    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsDrawing(true);
    setStartPos({ x, y });
    setCurrentRect({ x, y, width: 0, height: 0 });
  };
  
  const handleMouseMove = (e) => {
    if (!isAdmin || !editMode || !isDrawing || !startPos) return;
    
    const rect = imageRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    const width = currentX - startPos.x;
    const height = currentY - startPos.y;
    
    setCurrentRect({
      x: width > 0 ? startPos.x : currentX,
      y: height > 0 ? startPos.y : currentY,
      width: Math.abs(width),
      height: Math.abs(height)
    });
  };
  
  const handleMouseUp = async (e) => {
    if (!isAdmin || !editMode || !isDrawing || !currentRect) return;
    
    setIsDrawing(false);
    
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
        onClick={() => !isAdmin && navigate('/login')}
        title={!isAdmin ? "Click to access Admin Login" : "Vignan University Navigator"}
      >
        Vignan University Navigator
      </h1>
      
      {/* Map Edit Control (always visible; requires admin login) */}
      <div style={{
        position: 'fixed',
        top: '70px',
        right: '20px',
        zIndex: 5000,
        display: 'flex',
        gap: '10px'
      }}>
        <button
          onClick={() => {
            if (!isAdmin) {
              navigate('/login');
              return;
            }
            toggleEditMode();
          }}
          style={{
            padding: '12px 24px',
            borderRadius: '8px',
            border: 'none',
            background: isAdmin ? (editMode ? '#ef4444' : '#10b981') : '#64748b',
            color: 'white',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            transition: 'all 0.2s'
          }}
          title={isAdmin ? 'Edit map rectangles' : 'Admin login required'}
        >
          {isAdmin ? (editMode ? '❌ Exit Edit Map' : '✏️ Edit Map') : '🔒 Admin Edit Map'}
        </button>
        {isAdmin && editMode && (
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '12px 24px',
              borderRadius: '8px',
              border: 'none',
              background: '#3b82f6',
              color: 'white',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}
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
            key={mapTimestamp}
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
          {blocks.map((block) => {
            if (!block.coordinates) return null;
            
            const pixelCoords = percentToPixels(block.coordinates);
            if (!pixelCoords) return null;
            
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
        
        {/* Robot Avatar - Bottom Right */}
        {!editMode && (
          <div 
            className="robot-avatar-container" 
            onClick={handleAvatarClick}
            title="Click to chat with AI Assistant!"
          >
            {robotAnimation ? (
              <Lottie 
                animationData={robotAnimation}
                loop={true}
                style={{ width: '120px', height: '120px' }}
              />
            ) : (
              <div className="robot-emoji">🤖</div>
            )}
          </div>
        )}

        {/* Embedded Assistant (no page navigation) */}
        {assistantOpen && !editMode && (
          <div className="assistant-widget-shell" onClick={() => setAssistantOpen(false)}>
            <div className="assistant-widget" onClick={(e) => e.stopPropagation()}>
              <Assistant embedded onClose={() => setAssistantOpen(false)} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Home;
