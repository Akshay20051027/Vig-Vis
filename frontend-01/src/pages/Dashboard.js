import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus, Save, X } from 'lucide-react';
import { cacheRead, cacheReadNumber, cacheWrite } from '../utils/sessionCache';

const CACHE_KEYS = {
  blocks: 'dashboard.blocks.v1',
  mapLastUpdated: 'dashboard.mapLastUpdated.v1'
};

function Dashboard() {
  const navigate = useNavigate();
  const mapImageRef = useRef(null);
  const [user, setUser] = useState('');
  const [blocks, setBlocks] = useState(() => cacheRead(CACHE_KEYS.blocks, []));
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [mapTimestamp, setMapTimestamp] = useState(() => cacheReadNumber(CACHE_KEYS.mapLastUpdated, 0));
  const [, setLayoutTick] = useState(0);
  
  // Form state for new/edit block
  const [blockForm, setBlockForm] = useState({
    name: '',
    image: '',
    coordinates: { x: 0, y: 0, width: 0, height: 0 },
    sections: []
  });
  const [imageFile, setImageFile] = useState(null);

  // Rectangle editing state
  const [editMode, setEditMode] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [dragging, setDragging] = useState(null);
  const [selectedRect, setSelectedRect] = useState(null);
  const [drawingRect, setDrawingRect] = useState(null);

  // Keep in sync with the <img> style below and Home page behavior
  const MAP_OBJECT_FIT = 'cover';

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('adminToken');
    const username = localStorage.getItem('adminUser');
    
    if (!token) {
      navigate('/login');
      return;
    }
    
    setUser(username);
    fetchBlocks();
    checkMapUpdate();
  }, [navigate]);

  useEffect(() => {
    const onResize = () => setLayoutTick((t) => t + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const fetchBlocks = async () => {
    try {
      const response = await axios.get('/api/blocks');
      const nextBlocks = response.data?.value || response.data;
      setBlocks(nextBlocks);
      cacheWrite(CACHE_KEYS.blocks, nextBlocks);
    } catch (error) {
      console.error('Error fetching blocks:', error);
    }
  };

  const checkMapUpdate = async () => {
    try {
      const response = await axios.get('/api/blocks/map-metadata');
      const raw = response?.data?.lastUpdated;
      const serverTimestamp = Math.trunc(Number(raw));
      if (!Number.isFinite(serverTimestamp) || serverTimestamp <= 0) return;

      setMapTimestamp((prev) => {
        if (prev === serverTimestamp) return prev;
        cacheWrite(CACHE_KEYS.mapLastUpdated, serverTimestamp);
        return serverTimestamp;
      });
    } catch (error) {
      console.error('Error checking map updates:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    navigate('/home');
  };

  const handleMapImageLoad = () => {
    setLayoutTick((t) => t + 1);
  };

  const getActualImageBounds = () => {
    if (!mapImageRef.current) return null;

    const img = mapImageRef.current;
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

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setBlockForm({
      ...blockForm,
      [name]: value
    });
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  const handleSectionChange = (index, field, value) => {
    const newSections = [...blockForm.sections];
    newSections[index] = { ...newSections[index], [field]: value };
    setBlockForm({ ...blockForm, sections: newSections });
  };

  const addSection = () => {
    setBlockForm({
      ...blockForm,
      sections: [...blockForm.sections, { name: '', displayName: '', video: '', coordinates: null }]
    });
  };

  const removeSection = (index) => {
    const newSections = blockForm.sections.filter((_, i) => i !== index);
    setBlockForm({ ...blockForm, sections: newSections });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedBlock) {
      alert('Select an existing block to update (blocks/rectangles are created from Home → Edit Map).');
      return;
    }
    
    try {
      // Validate required fields
      if (!blockForm.name || blockForm.name.trim() === '') {
        alert('Block name is required!');
        return;
      }
      
      const formData = new FormData();
      
      // Add image file if selected
      if (imageFile) {
        formData.append('image', imageFile);
      }
      
      // Add block data as JSON string
      formData.append('data', JSON.stringify(blockForm));
      
      // Update existing block
      await axios.put(`/api/blocks/${selectedBlock._id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert('Block updated successfully!');
      
      fetchBlocks();
      resetForm();
    } catch (error) {
      console.error('Error saving block:', error);
      alert('Error saving block: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleEditBlock = (block) => {
    setSelectedBlock(block);
    setBlockForm({
      name: block.name,
      image: block.image,
      coordinates: block.coordinates,
      sections: block.sections || []
    });
    setImageFile(null);
  };

  const handleDeleteBlock = async (blockId) => {
    if (!window.confirm('Are you sure you want to delete this block?')) return;
    
    try {
      await axios.delete(`/api/blocks/${blockId}`);
      alert('Block deleted successfully!');
      fetchBlocks();
    } catch (error) {
      console.error('Error deleting block:', error);
      alert('Error deleting block');
    }
  };

  const resetForm = () => {
    setBlockForm({
      name: '',
      image: '',
      coordinates: { x: 0, y: 0, width: 0, height: 0 },
      sections: []
    });
    setSelectedBlock(null);
    setImageFile(null);
  };

  // Rectangle editing functions
  const pixelsToPercent = (pixelCoords) => {
    const bounds = getActualImageBounds();
    if (!bounds) return null;

    return {
      x: ((pixelCoords.left - bounds.offsetX) / bounds.displayWidth) * 100,
      y: ((pixelCoords.top - bounds.offsetY) / bounds.displayHeight) * 100,
      width: (pixelCoords.width / bounds.displayWidth) * 100,
      height: (pixelCoords.height / bounds.displayHeight) * 100
    };
  };

  const handleMapMouseDown = (e) => {
    if (!drawMode) return;
    
    const bounds = getActualImageBounds();
    if (!bounds) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if click is within the image bounds
    if (x < bounds.offsetX || x > bounds.offsetX + bounds.displayWidth ||
        y < bounds.offsetY || y > bounds.offsetY + bounds.displayHeight) {
      return;
    }

    setDrawingRect({
      startX: x,
      startY: y,
      currentX: x,
      currentY: y
    });
  };

  const handleMapMouseMove = (e) => {
    if (drawMode && drawingRect) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setDrawingRect({
        ...drawingRect,
        currentX: x,
        currentY: y
      });
    }
  };

  const handleMapMouseUp = (e) => {
    if (drawMode && drawingRect) {
      const width = Math.abs(drawingRect.currentX - drawingRect.startX);
      const height = Math.abs(drawingRect.currentY - drawingRect.startY);

      // Only create rectangle if it has minimum size
      if (width > 20 && height > 20) {
        const left = Math.min(drawingRect.startX, drawingRect.currentX);
        const top = Math.min(drawingRect.startY, drawingRect.currentY);

        const percentCoords = pixelsToPercent({
          left,
          top,
          width,
          height
        });

        if (percentCoords) {
          const newBlock = {
            _id: 'temp_' + Date.now(),
            name: 'new-block-' + Date.now(),
            displayName: 'New Block',
            coordinates: {
              x: Math.max(0, Math.min(100 - percentCoords.width, percentCoords.x)),
              y: Math.max(0, Math.min(100 - percentCoords.height, percentCoords.y)),
              width: Math.max(5, Math.min(100, percentCoords.width)),
              height: Math.max(5, Math.min(100, percentCoords.height))
            },
            sections: [],
            isNew: true
          };

          setBlocks([...blocks, newBlock]);
          setSelectedRect(newBlock._id);
          setSelectedBlock(newBlock);
          setBlockForm({
            name: newBlock.name,
            image: '',
            coordinates: newBlock.coordinates,
            sections: []
          });
          setDrawMode(false);
        }
      }

      setDrawingRect(null);
    }
  };

  const handleCreateNewBlock = () => {
    const newBlock = {
      _id: 'temp_' + Date.now(),
      name: 'new-block-' + Date.now(),
      displayName: 'New Block',
      coordinates: { x: 20, y: 20, width: 15, height: 15 },
      sections: [],
      isNew: true
    };
    
    setBlocks([...blocks, newBlock]);
    setSelectedRect(newBlock._id);
    setBlockForm({
      name: newBlock.name,
      image: '',
      coordinates: newBlock.coordinates,
      sections: []
    });
    setSelectedBlock(newBlock);
    setDrawMode(false);
  };

  const handleRectMouseDown = (e, blockId, handle) => {
    e.stopPropagation();
    if (!editMode || drawMode) return;

    const block = blocks.find(b => b._id === blockId);
    if (!block) return;

    setSelectedRect(blockId);
    setDragging({ blockId, handle, startX: e.clientX, startY: e.clientY, block });
  };

  const handleMouseMove = (e) => {
    if (!dragging || !editMode || drawMode) return;

    const bounds = getActualImageBounds();
    if (!bounds) return;

    const deltaX = e.clientX - dragging.startX;
    const deltaY = e.clientY - dragging.startY;

    const deltaXPercent = (deltaX / bounds.displayWidth) * 100;
    const deltaYPercent = (deltaY / bounds.displayHeight) * 100;

    const block = dragging.block;
    let newCoords = { ...block.coordinates };

    if (dragging.handle === 'move') {
      newCoords.x = Math.max(0, Math.min(100 - newCoords.width, block.coordinates.x + deltaXPercent));
      newCoords.y = Math.max(0, Math.min(100 - newCoords.height, block.coordinates.y + deltaYPercent));
    } else if (dragging.handle === 'se') {
      newCoords.width = Math.max(5, Math.min(100 - newCoords.x, block.coordinates.width + deltaXPercent));
      newCoords.height = Math.max(5, Math.min(100 - newCoords.y, block.coordinates.height + deltaYPercent));
    } else if (dragging.handle === 'ne') {
      const newY = Math.max(0, block.coordinates.y + deltaYPercent);
      const newHeight = block.coordinates.height + (block.coordinates.y - newY);
      if (newHeight >= 5) {
        newCoords.y = newY;
        newCoords.height = newHeight;
      }
      newCoords.width = Math.max(5, Math.min(100 - newCoords.x, block.coordinates.width + deltaXPercent));
    } else if (dragging.handle === 'sw') {
      const newX = Math.max(0, block.coordinates.x + deltaXPercent);
      const newWidth = block.coordinates.width + (block.coordinates.x - newX);
      if (newWidth >= 5) {
        newCoords.x = newX;
        newCoords.width = newWidth;
      }
      newCoords.height = Math.max(5, Math.min(100 - newCoords.y, block.coordinates.height + deltaYPercent));
    } else if (dragging.handle === 'nw') {
      const newX = Math.max(0, block.coordinates.x + deltaXPercent);
      const newY = Math.max(0, block.coordinates.y + deltaYPercent);
      const newWidth = block.coordinates.width + (block.coordinates.x - newX);
      const newHeight = block.coordinates.height + (block.coordinates.y - newY);
      if (newWidth >= 5 && newHeight >= 5) {
        newCoords.x = newX;
        newCoords.y = newY;
        newCoords.width = newWidth;
        newCoords.height = newHeight;
      }
    }

    setBlocks(blocks.map(b => b._id === dragging.blockId ? { ...b, coordinates: newCoords } : b));
    setDragging({ ...dragging, startX: e.clientX, startY: e.clientY, block: { ...block, coordinates: newCoords } });
    
    if (selectedBlock && selectedBlock._id === dragging.blockId) {
      setBlockForm({ ...blockForm, coordinates: newCoords });
    }
  };

  const handleMouseUp = async () => {
    if (dragging && editMode) {
      const block = blocks.find(b => b._id === dragging.blockId);
      if (block && !block.isNew) {
        try {
          await axios.put(`/api/blocks/${block._id}/coordinates`, {
            coordinates: block.coordinates
          });
        } catch (error) {
          console.error('Error updating coordinates:', error);
        }
      }
    }
    setDragging(null);
  };

  const handleSaveNewBlock = async () => {
    if (!selectedBlock || !selectedBlock.isNew) return;

    try {
      if (!blockForm.name || blockForm.name.trim() === '') {
        alert('Block name is required!');
        return;
      }

      const response = await axios.post('/api/blocks', {
        name: blockForm.name,
        displayName: blockForm.name,
        coordinates: blockForm.coordinates,
        sections: []
      });

      alert('Block created successfully!');
      await fetchBlocks();
      resetForm();
      setSelectedRect(null);
      setEditMode(false);
    } catch (error) {
      console.error('Error creating block:', error);
      alert('Error creating block: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleDeleteRect = async (blockId) => {
    const block = blocks.find(b => b._id === blockId);
    if (!block) return;

    if (block.isNew) {
      setBlocks(blocks.filter(b => b._id !== blockId));
      if (selectedRect === blockId) {
        setSelectedRect(null);
        resetForm();
      }
      return;
    }

    if (!window.confirm(`Delete ${block.displayName}?`)) return;

    try {
      await axios.delete(`/api/blocks/${blockId}`);
      alert('Block deleted successfully!');
      await fetchBlocks();
      if (selectedRect === blockId) {
        setSelectedRect(null);
        resetForm();
      }
    } catch (error) {
      console.error('Error deleting block:', error);
      alert('Error deleting block');
    }
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-card">
        <div className="dashboard-header">
          <h1>Admin Dashboard</h1>
          <div className="header-actions">
            <span className="user-info">👤 {user}</span>
            <button onClick={handleLogout} className="logout-btn">Logout</button>
          </div>
        </div>

        <div className="dashboard-content">
          {/* Map View Section (now editable) */}
          <div className="map-editor-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2>Campus Map</h2>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    setEditMode(!editMode);
                    setDrawMode(false);
                  }}
                  className={editMode ? 'mode-btn active' : 'mode-btn'}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: editMode ? '2px solid var(--brand-blue)' : '2px solid rgba(107, 114, 128, 0.3)',
                    background: editMode ? 'var(--brand-blue)' : 'white',
                    color: editMode ? 'white' : 'var(--text-strong)',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {editMode ? '✏️ Edit Mode' : '👁️ View Mode'}
                </button>
                {editMode && (
                  <>
                    <button
                      onClick={() => {
                        setDrawMode(!drawMode);
                        setDrawingRect(null);
                      }}
                      className={drawMode ? 'draw-btn active' : 'draw-btn'}
                      style={{
                        padding: '10px 20px',
                        borderRadius: '8px',
                        border: drawMode ? '2px solid #8b5cf6' : '2px solid rgba(139, 92, 246, 0.3)',
                        background: drawMode ? '#8b5cf6' : 'white',
                        color: drawMode ? 'white' : 'var(--text-strong)',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {drawMode ? '🖊️ Drawing...' : '🖊️ Draw Rectangle'}
                    </button>
                    <button
                      onClick={handleCreateNewBlock}
                      className="create-btn"
                      style={{
                        padding: '10px 20px',
                        borderRadius: '8px',
                        border: '2px solid var(--success)',
                        background: 'var(--success)',
                        color: 'white',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      ➕ Insert Block
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="mode-indicator" style={{
              background: drawMode ? 'rgba(139, 92, 246, 0.1)' : 'rgba(59, 130, 246, 0.1)',
              border: `1px solid ${drawMode ? 'rgba(139, 92, 246, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
              color: drawMode ? '#6d28d9' : 'var(--brand-blue)'
            }}>
              {drawMode ? '🖊️ Draw Mode: Click and drag on the map to draw a new rectangle' : 
               editMode ? '✏️ Edit Mode: Click rectangles to select, drag to move, drag corners to resize' : 
               '👁️ View Only: Enable Edit Mode to modify rectangles'}
            </div>

            <div 
              className="map-preview-shell"
              onMouseMove={(e) => {
                handleMouseMove(e);
                handleMapMouseMove(e);
              }}
              onMouseUp={(e) => {
                handleMouseUp();
                handleMapMouseUp(e);
              }}
              onMouseDown={handleMapMouseDown}
              onMouseLeave={(e) => {
                handleMouseUp();
                setDrawingRect(null);
              }}
              style={{ cursor: drawMode ? 'crosshair' : editMode ? 'default' : 'default' }}
            >
              <img
                ref={mapImageRef}
                src={mapTimestamp ? `/api/blocks/map-image?t=${mapTimestamp}` : '/api/blocks/map-image'}
                alt="Campus Map"
                className="map-preview-image"
                style={{ objectFit: 'cover' }}
                onLoad={handleMapImageLoad}
              />

              {blocks.map((block) => {
                if (!block.coordinates) return null;
                const pixelCoords = percentToPixels(block.coordinates);
                if (!pixelCoords) return null;
                const isSelected = selectedRect === block._id;

                return (
                  <div
                    key={block._id}
                    className="map-preview-rect"
                    onMouseDown={(e) => handleRectMouseDown(e, block._id, 'move')}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (editMode && !drawMode) {
                        setSelectedRect(block._id);
                        setSelectedBlock(block);
                        setBlockForm({
                          name: block.name,
                          image: block.image,
                          coordinates: block.coordinates,
                          sections: block.sections || []
                        });
                      }
                    }}
                    style={{
                      left: `${pixelCoords.left}px`,
                      top: `${pixelCoords.top}px`,
                      width: `${pixelCoords.width}px`,
                      height: `${pixelCoords.height}px`,
                      cursor: editMode && !drawMode ? 'move' : 'default',
                      border: isSelected ? '3px solid var(--brand-blue)' : '2px solid rgba(59, 130, 246, 0.6)',
                      boxShadow: isSelected ? '0 0 20px rgba(59, 130, 246, 0.8)' : 'none',
                      zIndex: isSelected ? 100 : 1,
                      pointerEvents: drawMode ? 'none' : 'auto'
                    }}
                    title={block.displayName || block.name}
                  >
                    {/* Label */}
                    <div style={{
                      position: 'absolute',
                      top: '-24px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: isSelected ? 'var(--brand-blue)' : 'rgba(0, 0, 0, 0.7)',
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600',
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none'
                    }}>
                      {block.displayName || block.name}
                      {block.isNew && ' (New)'}
                    </div>

                    {/* Resize handles (only for selected rectangle in edit mode) */}
                    {editMode && isSelected && (
                      <>
                        {/* Corner handles */}
                        <div
                          onMouseDown={(e) => handleRectMouseDown(e, block._id, 'nw')}
                          style={{
                            position: 'absolute',
                            top: '-6px',
                            left: '-6px',
                            width: '12px',
                            height: '12px',
                            background: 'white',
                            border: '2px solid var(--brand-blue)',
                            borderRadius: '50%',
                            cursor: 'nw-resize',
                            zIndex: 10
                          }}
                        />
                        <div
                          onMouseDown={(e) => handleRectMouseDown(e, block._id, 'ne')}
                          style={{
                            position: 'absolute',
                            top: '-6px',
                            right: '-6px',
                            width: '12px',
                            height: '12px',
                            background: 'white',
                            border: '2px solid var(--brand-blue)',
                            borderRadius: '50%',
                            cursor: 'ne-resize',
                            zIndex: 10
                          }}
                        />
                        <div
                          onMouseDown={(e) => handleRectMouseDown(e, block._id, 'sw')}
                          style={{
                            position: 'absolute',
                            bottom: '-6px',
                            left: '-6px',
                            width: '12px',
                            height: '12px',
                            background: 'white',
                            border: '2px solid var(--brand-blue)',
                            borderRadius: '50%',
                            cursor: 'sw-resize',
                            zIndex: 10
                          }}
                        />
                        <div
                          onMouseDown={(e) => handleRectMouseDown(e, block._id, 'se')}
                          style={{
                            position: 'absolute',
                            bottom: '-6px',
                            right: '-6px',
                            width: '12px',
                            height: '12px',
                            background: 'white',
                            border: '2px solid var(--brand-blue)',
                            borderRadius: '50%',
                            cursor: 'se-resize',
                            zIndex: 10
                          }}
                        />

                        {/* Delete button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRect(block._id);
                          }}
                          style={{
                            position: 'absolute',
                            top: '-10px',
                            right: '-10px',
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: '#ef4444',
                            color: 'white',
                            border: '2px solid white',
                            cursor: 'pointer',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 20,
                            fontWeight: 'bold'
                          }}
                          title="Delete rectangle"
                        >
                          ×
                        </button>
                      </>
                    )}
                  </div>
                );
              })}

              {/* Drawing preview rectangle */}
              {drawingRect && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${Math.min(drawingRect.startX, drawingRect.currentX)}px`,
                    top: `${Math.min(drawingRect.startY, drawingRect.currentY)}px`,
                    width: `${Math.abs(drawingRect.currentX - drawingRect.startX)}px`,
                    height: `${Math.abs(drawingRect.currentY - drawingRect.startY)}px`,
                    border: '3px dashed #8b5cf6',
                    background: 'rgba(139, 92, 246, 0.15)',
                    pointerEvents: 'none',
                    zIndex: 200,
                    borderRadius: '8px'
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    top: '-28px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#8b5cf6',
                    color: 'white',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                    whiteSpace: 'nowrap'
                  }}>
                    Drawing... 🖊️
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Block Form Section */}
          <div className="block-form-section">
          <h2>{selectedBlock?.isNew ? 'Configure New Block' : selectedBlock ? 'Edit Block' : 'Select a Block to Edit'}</h2>
          
          <form onSubmit={selectedBlock?.isNew ? (e) => { e.preventDefault(); handleSaveNewBlock(); } : handleSubmit} className="block-form">
            <input
              type="text"
              name="name"
              placeholder="Block Name (e.g., A-Block)"
              value={blockForm.name}
              onChange={handleFormChange}
              readOnly={selectedBlock && !selectedBlock.isNew}
              required
            />

            {!selectedBlock && (
              <div className="mode-indicator" style={{ marginTop: '12px' }}>
                {editMode ? 'Click "Create New Rectangle" to add a block, or select an existing rectangle to edit it.' : 'Enable Edit Mode above to create or modify rectangles.'}
              </div>
            )}

            {selectedBlock?.isNew && (
              <div style={{
                padding: '12px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '8px',
                marginTop: '12px',
                fontSize: '13px',
                color: '#065f46'
              }}>
                ✓ New rectangle created! Adjust the size/position on the map, then save below.
              </div>
            )}
            
            {!selectedBlock?.isNew && (
              <div className="file-upload-section">
                <label htmlFor="image-upload">Block Image:</label>
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                />
                {blockForm.image && (
                  <div className="current-image">
                    <small>Current: {blockForm.image}</small>
                  </div>
                )}
              </div>
            )}
            
            <div className="coordinates-group">
              <h4>Coordinates {editMode && selectedBlock ? '(drag rectangle on map to adjust)' : '(from map)'}</h4>
              <div style={{
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid rgba(107, 114, 128, 0.3)',
                background: 'rgba(248, 250, 252, 0.88)',
                fontSize: '13px',
                color: 'var(--text-strong)',
                fontFamily: 'Monaco, monospace'
              }}>
                x={blockForm.coordinates?.x?.toFixed(1) ?? 0}%, y={blockForm.coordinates?.y?.toFixed(1) ?? 0}%, w={blockForm.coordinates?.width?.toFixed(1) ?? 0}%, h={blockForm.coordinates?.height?.toFixed(1) ?? 0}%
              </div>
            </div>

            {!selectedBlock?.isNew && (
            <div className="sections-group">
              <h4>Sections (Labs, Classrooms, etc.)</h4>
              <div className="video-link-help" style={{ 
                marginBottom: '12px', 
                padding: '12px', 
                background: 'rgba(59, 130, 246, 0.1)', 
                borderRadius: '8px',
                fontSize: '13px',
                lineHeight: '1.6'
              }}>
                <p style={{ margin: '0 0 8px 0', fontWeight: '600', color: 'var(--brand-blue)' }}>✓ Supported Video Links:</p>
                <ul style={{ margin: '0 0 8px 0', paddingLeft: '20px' }}>
                  <li><strong>YouTube:</strong> Share link or watch URL (e.g., https://youtu.be/... or https://youtube.com/watch?v=...)</li>
                  <li><strong>Google Drive:</strong> Share link with "Anyone with the link can view" (e.g., https://drive.google.com/file/d/FILE_ID/view?usp=sharing)</li>
                  <li><strong>Local Videos:</strong> Upload to backend/public/videos/ and use /public/videos/filename.mp4</li>
                </ul>
                <div style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  marginBottom: '8px'
                }}>
                  <p style={{ margin: '0 0 6px 0', fontWeight: '600', color: '#047857', fontSize: '12px' }}>📹 How to use Google Drive videos:</p>
                  <ol style={{ margin: '0', paddingLeft: '20px', fontSize: '12px', color: '#065f46' }}>
                    <li>Upload your video to Google Drive</li>
                    <li>Right-click → Share → Change to "Anyone with the link"</li>
                    <li>Set permission to "Viewer"</li>
                    <li>Copy the link and paste it in the "Video" field below</li>
                    <li>Videos will automatically stream through the proxy!</li>
                  </ol>
                </div>
                <p style={{ margin: '0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  ⚠️ <strong>Note:</strong> OneDrive links often don't work due to authentication. Use YouTube or Google Drive instead.
                </p>
              </div>
              {blockForm.sections.map((section, index) => (
                <div key={index} className="section-row">
                  <input
                    type="text"
                    placeholder="Section name (e.g., labs)"
                    value={section.name}
                    onChange={(e) => handleSectionChange(index, 'name', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Display name (e.g., Labs)"
                    value={section.displayName}
                    onChange={(e) => handleSectionChange(index, 'displayName', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Video: YouTube link, Google Drive link, or /public/videos/file.mp4"
                    value={section.video}
                    onChange={(e) => handleSectionChange(index, 'video', e.target.value)}
                  />
                  {section.coordinates && (
                    <div style={{
                      gridColumn: '1 / -1',
                      padding: '8px 12px',
                      background: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#065f46',
                      fontFamily: 'Monaco, monospace'
                    }}>
                      ✓ Position: x={section.coordinates.x}%, y={section.coordinates.y}%, w={section.coordinates.width}%, h={section.coordinates.height}%
                    </div>
                  )}
                  <button type="button" onClick={() => removeSection(index)} className="remove-btn">
                    ❌
                  </button>
                </div>
              ))}
              <button type="button" onClick={addSection} className="add-section-btn">
                <Plus className="form-btn-icon" size={18} aria-hidden="true" />
                <span>Add Section</span>
              </button>
            </div>
            )}

            <div className="form-actions">
              <button type="submit" className="submit-btn">
                {selectedBlock?.isNew ? (
                  <>
                    <Save className="form-btn-icon" size={18} aria-hidden="true" />
                    <span>Save New Block</span>
                  </>
                ) : selectedBlock ? (
                  <>
                    <Save className="form-btn-icon" size={18} aria-hidden="true" />
                    <span>Update Block</span>
                  </>
                ) : (
                  <>
                    <Save className="form-btn-icon" size={18} aria-hidden="true" />
                    <span>Save</span>
                  </>
                )}
              </button>
              {selectedBlock && (
                <button type="button" onClick={resetForm} className="cancel-btn">
                  <X className="form-btn-icon" size={18} aria-hidden="true" />
                  <span>Cancel</span>
                </button>
              )}
            </div>
          </form>
        </div>

          {/* Blocks List Section */}
          <div className="blocks-list-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2>Existing Blocks ({blocks.length})</h2>
            {editMode && (
              <button
                onClick={handleCreateNewBlock}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '2px solid var(--success)',
                  background: 'var(--success)',
                  color: 'white',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Plus size={16} />
                Quick Insert
              </button>
            )}
          </div>
          <div className="blocks-grid">
            {blocks.map((block) => (
              <div key={block._id} className="block-card" style={{
                border: selectedRect === block._id ? '2px solid var(--brand-blue)' : '1px solid rgba(107, 114, 128, 0.2)',
                background: block.isNew ? 'rgba(139, 92, 246, 0.05)' : 'white'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3>{block.displayName || block.name}</h3>
                  {block.isNew && (
                    <span style={{
                      background: '#8b5cf6',
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '600'
                    }}>
                      NEW
                    </span>
                  )}
                </div>
                <p><strong>Name:</strong> {block.name}</p>
                <p><strong>Coordinates:</strong> x:{block.coordinates?.x?.toFixed(1)}%, y:{block.coordinates?.y?.toFixed(1)}%</p>
                <p><strong>Size:</strong> w:{block.coordinates?.width?.toFixed(1)}%, h:{block.coordinates?.height?.toFixed(1)}%</p>
                <p><strong>Sections:</strong> {block.sections?.length || 0}</p>
                <div className="block-actions">
                  <button onClick={() => {
                    handleEditBlock(block);
                    setSelectedRect(block._id);
                  }} className="edit-btn">
                    ✏️ Edit
                  </button>
                  <button 
                    onClick={() => handleDeleteBlock(block._id)} 
                    className="delete-btn"
                    style={{
                      background: block.isNew ? '#ef4444' : '#fee2e2',
                      color: block.isNew ? 'white' : '#dc2626',
                      border: block.isNew ? 'none' : '1px solid #fca5a5'
                    }}
                  >
                    🗑️ {block.isNew ? 'Remove' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
