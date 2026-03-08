import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function Dashboard() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const [user, setUser] = useState('');
  const [blocks, setBlocks] = useState([]);
  const [mode, setMode] = useState('view'); // 'view', 'draw', 'click'
  const [selectedBlock, setSelectedBlock] = useState(null);
  
  // Form state for new/edit block
  const [blockForm, setBlockForm] = useState({
    name: '',
    image: '',
    coordinates: { x: 0, y: 0, width: 0, height: 0 },
    sections: []
  });
  const [imageFile, setImageFile] = useState(null);
  
  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [currentRect, setCurrentRect] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

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
  }, [navigate]);

  // Redraw canvas when blocks change
  useEffect(() => {
    if (imageLoaded && canvasRef.current && blocks.length > 0) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = document.getElementById('map-img');
      
      if (img && img.complete) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        blocks.forEach(block => {
          if (block.coordinates) {
            drawBlock(ctx, block, canvas.width, canvas.height);
          }
        });
      }
    }
  }, [blocks, imageLoaded]);

  const fetchBlocks = async () => {
    try {
      const response = await axios.get('/api/blocks');
      setBlocks(response.data);
    } catch (error) {
      console.error('Error fetching blocks:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    navigate('/');
  };

  const handleImageLoad = (e) => {
    setImageLoaded(true);
    const canvas = canvasRef.current;
    const img = e.target;
    
    // Use natural dimensions of the image
    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;
    
    // Calculate display size (max 1200px wide while maintaining aspect ratio)
    const maxWidth = 1200;
    let displayWidth = imgWidth;
    let displayHeight = imgHeight;
    
    if (imgWidth > maxWidth) {
      displayWidth = maxWidth;
      displayHeight = (imgHeight * maxWidth) / imgWidth;
    }
    
    setImageDimensions({
      width: displayWidth,
      height: displayHeight
    });
    
    if (canvas) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
      
      // Draw existing blocks on the canvas
      blocks.forEach(block => {
        if (block.coordinates) {
          drawBlock(ctx, block, displayWidth, displayHeight);
        }
      });
    }
  };

  const getMousePos = (canvas, evt) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top
    };
  };

  const handleCanvasMouseDown = (e) => {
    if (mode !== 'draw') return;
    
    const canvas = canvasRef.current;
    const pos = getMousePos(canvas, e);
    
    setIsDrawing(true);
    setStartPoint(pos);
  };

  const handleCanvasMouseMove = (e) => {
    if (!isDrawing || mode !== 'draw') return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getMousePos(canvas, e);
    
    // Redraw image
    const img = document.getElementById('map-img');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    // Draw existing blocks
    blocks.forEach(block => {
      if (block.coordinates) {
        drawBlock(ctx, block, canvas.width, canvas.height);
      }
    });
    
    // Draw current rectangle
    const width = pos.x - startPoint.x;
    const height = pos.y - startPoint.y;
    
    ctx.strokeStyle = '#ffc107';
    ctx.lineWidth = 3;
    ctx.strokeRect(startPoint.x, startPoint.y, width, height);
    ctx.fillStyle = 'rgba(255, 193, 7, 0.2)';
    ctx.fillRect(startPoint.x, startPoint.y, width, height);
    
    setCurrentRect({ x: startPoint.x, y: startPoint.y, width, height });
  };

  const handleCanvasMouseUp = (e) => {
    if (!isDrawing || mode !== 'draw') return;
    
    setIsDrawing(false);
    
    if (currentRect && Math.abs(currentRect.width) > 10 && Math.abs(currentRect.height) > 10) {
      // Convert to percentages
      const x = (currentRect.x / imageDimensions.width) * 100;
      const y = (currentRect.y / imageDimensions.height) * 100;
      const width = (Math.abs(currentRect.width) / imageDimensions.width) * 100;
      const height = (Math.abs(currentRect.height) / imageDimensions.height) * 100;
      
      setBlockForm({
        ...blockForm,
        coordinates: {
          x: parseFloat(x.toFixed(2)),
          y: parseFloat(y.toFixed(2)),
          width: parseFloat(width.toFixed(2)),
          height: parseFloat(height.toFixed(2))
        }
      });
      
      alert(`Coordinates captured!\nx: ${x.toFixed(2)}%, y: ${y.toFixed(2)}%\nwidth: ${width.toFixed(2)}%, height: ${height.toFixed(2)}%`);
    }
  };

  const handleCanvasClick = (e) => {
    if (mode !== 'click') return;
    
    const canvas = canvasRef.current;
    const pos = getMousePos(canvas, e);
    
    const x = (pos.x / imageDimensions.width) * 100;
    const y = (pos.y / imageDimensions.height) * 100;
    
    console.log(`Clicked at: x=${x.toFixed(2)}%, y=${y.toFixed(2)}%`);
    alert(`Coordinates: x=${x.toFixed(2)}%, y=${y.toFixed(2)}%`);
  };

  const drawBlock = (ctx, block, canvasWidth, canvasHeight) => {
    const x = (block.coordinates.x / 100) * canvasWidth;
    const y = (block.coordinates.y / 100) * canvasHeight;
    const width = (block.coordinates.width / 100) * canvasWidth;
    const height = (block.coordinates.height / 100) * canvasHeight;
    
    ctx.strokeStyle = '#667eea';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    ctx.fillStyle = 'rgba(102, 126, 234, 0.2)';
    ctx.fillRect(x, y, width, height);
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Arial';
    ctx.fillText(block.displayName || block.name, x + 5, y + 20);
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
      sections: [...blockForm.sections, { name: '', displayName: '', video: '' }]
    });
  };

  const removeSection = (index) => {
    const newSections = blockForm.sections.filter((_, i) => i !== index);
    setBlockForm({ ...blockForm, sections: newSections });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Validate required fields
      if (!blockForm.name || blockForm.name.trim() === '') {
        alert('Block name is required!');
        return;
      }
      
      // Check if image is provided (either file upload or existing image)
      if (!imageFile && !blockForm.image) {
        alert('Please upload an image for the block!');
        return;
      }
      
      const formData = new FormData();
      
      // Add image file if selected
      if (imageFile) {
        formData.append('image', imageFile);
      }
      
      // Add block data as JSON string
      formData.append('data', JSON.stringify(blockForm));
      
      if (selectedBlock) {
        // Update existing block
        await axios.put(`/api/blocks/${selectedBlock._id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        alert('Block updated successfully!');
      } else {
        // Create new block
        await axios.post('/api/blocks', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        alert('Block created successfully!');
      }
      
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
    setCurrentRect(null);
    setImageFile(null);
  };

  const clearCanvas = () => {
    if (!canvasRef.current || !imageLoaded) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = document.getElementById('map-img');
    
    if (!img) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    // Redraw existing blocks
    blocks.forEach(block => {
      if (block.coordinates) {
        drawBlock(ctx, block, canvas.width, canvas.height);
      }
    });
    
    setCurrentRect(null);
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>🗺️ Admin Dashboard</h1>
        <div className="header-actions">
          <span className="user-info">👤 {user}</span>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
      </div>

      <div className="dashboard-content">
        {/* Map Editor Section */}
        <div className="map-editor-section">
          <h2>Map Editor</h2>
          
          <div className="editor-controls">
            <button 
              className={`mode-btn ${mode === 'view' ? 'active' : ''}`}
              onClick={() => setMode('view')}
            >
              👁️ View
            </button>
            <button 
              className={`mode-btn ${mode === 'click' ? 'active' : ''}`}
              onClick={() => setMode('click')}
            >
              👆 Click Point
            </button>
            <button 
              className={`mode-btn ${mode === 'draw' ? 'active' : ''}`}
              onClick={() => setMode('draw')}
            >
              ✏️ Draw Rectangle
            </button>
            <button onClick={clearCanvas} className="clear-btn">
              🗑️ Clear
            </button>
          </div>

          <div className="mode-indicator">
            {mode === 'view' && '👁️ View Mode - Just viewing the map'}
            {mode === 'click' && '👆 Click Mode - Click anywhere to get coordinates'}
            {mode === 'draw' && '✏️ Draw Mode - Click and drag to draw a rectangle'}
          </div>

          <div className="canvas-wrapper">
            <img 
              id="map-img"
              src="/public/map.jpeg" 
              alt="Campus Map"
              onLoad={handleImageLoad}
              style={{ display: 'none' }}
            />
            <canvas
              ref={canvasRef}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onClick={handleCanvasClick}
              className="map-canvas"
              style={{ cursor: mode === 'draw' ? 'crosshair' : mode === 'click' ? 'pointer' : 'default' }}
            />
          </div>
        </div>

        {/* Block Form Section */}
        <div className="block-form-section">
          <h2>{selectedBlock ? 'Edit Block' : 'Add New Block'}</h2>
          
          <form onSubmit={handleSubmit} className="block-form">
            <input
              type="text"
              name="name"
              placeholder="Block Name (e.g., A-Block)"
              value={blockForm.name}
              onChange={handleFormChange}
              required
            />
            
            <div className="file-upload-section">
              <label htmlFor="image-upload">Block Image:</label>
              <input
                id="image-upload"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                required={!selectedBlock && !blockForm.image}
              />
              {blockForm.image && (
                <div className="current-image">
                  <small>Current: {blockForm.image}</small>
                </div>
              )}
            </div>
            
            <div className="coordinates-group">
              <h4>Coordinates (use Draw Rectangle tool above)</h4>
              <div className="coord-inputs">
                <input
                  type="number"
                  step="0.01"
                  placeholder="X %"
                  value={blockForm.coordinates.x}
                  onChange={(e) => setBlockForm({
                    ...blockForm,
                    coordinates: { ...blockForm.coordinates, x: parseFloat(e.target.value) }
                  })}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Y %"
                  value={blockForm.coordinates.y}
                  onChange={(e) => setBlockForm({
                    ...blockForm,
                    coordinates: { ...blockForm.coordinates, y: parseFloat(e.target.value) }
                  })}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Width %"
                  value={blockForm.coordinates.width}
                  onChange={(e) => setBlockForm({
                    ...blockForm,
                    coordinates: { ...blockForm.coordinates, width: parseFloat(e.target.value) }
                  })}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Height %"
                  value={blockForm.coordinates.height}
                  onChange={(e) => setBlockForm({
                    ...blockForm,
                    coordinates: { ...blockForm.coordinates, height: parseFloat(e.target.value) }
                  })}
                />
              </div>
            </div>

            <div className="sections-group">
              <h4>Sections (Labs, Classrooms, etc.)</h4>
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
                    placeholder="Video: Google/OneDrive link OR /public/videos/file.mp4"
                    value={section.video}
                    onChange={(e) => handleSectionChange(index, 'video', e.target.value)}
                  />
                  <button type="button" onClick={() => removeSection(index)} className="remove-btn">
                    ❌
                  </button>
                </div>
              ))}
              <button type="button" onClick={addSection} className="add-section-btn">
                ➕ Add Section
              </button>
            </div>

            <div className="form-actions">
              <button type="submit" className="submit-btn">
                {selectedBlock ? '💾 Update Block' : '➕ Create Block'}
              </button>
              {selectedBlock && (
                <button type="button" onClick={resetForm} className="cancel-btn">
                  ❌ Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Blocks List Section */}
        <div className="blocks-list-section">
          <h2>Existing Blocks ({blocks.length})</h2>
          <div className="blocks-grid">
            {blocks.map((block) => (
              <div key={block._id} className="block-card">
                <h3>{block.displayName}</h3>
                <p><strong>Name:</strong> {block.name}</p>
                <p><strong>Coordinates:</strong> x:{block.coordinates?.x}%, y:{block.coordinates?.y}%</p>
                <p><strong>Sections:</strong> {block.sections?.length || 0}</p>
                <div className="block-actions">
                  <button onClick={() => handleEditBlock(block)} className="edit-btn">
                    ✏️ Edit
                  </button>
                  <button onClick={() => handleDeleteBlock(block._id)} className="delete-btn">
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
