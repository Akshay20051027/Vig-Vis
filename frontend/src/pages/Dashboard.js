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
    navigate('/');
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
          {/* Map View Section (read-only) */}
          <div className="map-editor-section">
            <h2>Map (View Only)</h2>

            <div className="mode-indicator">
              View-only here. Create/position block rectangles from Home → Edit Map.
            </div>

            <div className="map-preview-shell">
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

                return (
                  <div
                    key={block._id}
                    className="map-preview-rect"
                    style={{
                      left: `${pixelCoords.left}px`,
                      top: `${pixelCoords.top}px`,
                      width: `${pixelCoords.width}px`,
                      height: `${pixelCoords.height}px`
                    }}
                    title={block.displayName || block.name}
                  />
                );
              })}
            </div>
          </div>

          {/* Block Form Section */}
          <div className="block-form-section">
          <h2>{selectedBlock ? 'Edit Block' : 'Select a Block to Edit'}</h2>
          
          <form onSubmit={handleSubmit} className="block-form">
            <input
              type="text"
              name="name"
              placeholder="Block Name (e.g., A-Block)"
              value={blockForm.name}
              onChange={handleFormChange}
              readOnly
              required
            />

            {!selectedBlock && (
              <div className="mode-indicator" style={{ marginTop: '12px' }}>
                Blocks are created on the Home map. Use the list below, click “Edit”, then update image/sections here.
              </div>
            )}
            
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
            
            <div className="coordinates-group">
              <h4>Coordinates (managed from Home map)</h4>
              <div style={{
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid rgba(107, 114, 128, 0.3)',
                background: 'rgba(248, 250, 252, 0.88)',
                fontSize: '13px',
                color: 'var(--text-strong)',
                fontFamily: 'Monaco, monospace'
              }}>
                x={blockForm.coordinates?.x ?? 0}%, y={blockForm.coordinates?.y ?? 0}%, w={blockForm.coordinates?.width ?? 0}%, h={blockForm.coordinates?.height ?? 0}%
              </div>
            </div>

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

            <div className="form-actions">
              <button type="submit" className="submit-btn">
                {selectedBlock ? (
                  <>
                    <Save className="form-btn-icon" size={18} aria-hidden="true" />
                    <span>Update Block</span>
                  </>
                ) : (
                  <>
                    <Plus className="form-btn-icon" size={18} aria-hidden="true" />
                    <span>Update Block</span>
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
    </div>
  );
}

export default Dashboard;
