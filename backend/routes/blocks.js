const express = require('express');
const router = express.Router();
const Block = require('../models/Block');
const Map = require('../models/Map');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const FALLBACK_MAP_PATHS = [
  // Preferred: drop a new map here (no DB needed)
  path.join(__dirname, '..', 'public', 'assets', 'campus-map.png'),
  path.join(__dirname, '..', 'public', 'assets', 'campus-map.jpg'),
  path.join(__dirname, '..', 'public', 'assets', 'campus-map.jpeg'),
  // Legacy fallback
  path.join(
    __dirname,
    '..',
    'legacy',
    'Vignan-Visit-Akshay',
    'mahotsav-website',
    'public',
    'map.jpeg'
  )
];

const FALLBACK_BLOCKS = [
  {
    name: 'a-block',
    displayName: 'A-block',
    image: '',
    sections: [
      {
        name: 'labs',
        displayName: 'Labs',
        video: '/public/a-block/labs/video.mp4'
      },
      {
        name: 'classrooms',
        displayName: 'Classrooms',
        video: '/public/a-block/classrooms/video.mp4'
      }
    ],
    coordinates: {
      x: 75.25,
      y: 73.58,
      width: 8.57,
      height: 4.14
    }
  }
];

function isDbReady() {
  return mongoose.connection && mongoose.connection.readyState === 1;
}

function sendFallbackMapIfPresent(res) {
  for (const mapPath of FALLBACK_MAP_PATHS) {
    try {
      if (!fs.existsSync(mapPath)) continue;

      const ext = path.extname(mapPath).toLowerCase();
      if (ext === '.png') res.type('png');
      else if (ext === '.jpg' || ext === '.jpeg') res.type('jpeg');

      res.sendFile(mapPath);
      return true;
    } catch (e) {
      // ignore and try next
    }
  }
  return false;
}

// Configure multer for memory storage (images will be stored in DB)
const storage = multer.memoryStorage();

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Accept images only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Get all blocks
router.get('/', async (req, res) => {
  try {
    if (!isDbReady()) {
      return res.json(FALLBACK_BLOCKS);
    }
    const blocks = await Block.find();
    res.json(blocks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Serve map image from database (MUST be before /:name)
router.get('/map-image', async (req, res) => {
  try {
    if (!isDbReady()) {
      const sent = sendFallbackMapIfPresent(res);
      if (sent) return;
      return res.status(503).json({ message: 'Database not connected and no fallback map file found' });
    }

    const map = await Map.findOne({ name: 'campus-map' });
    
    if (!map) {
      const sent = sendFallbackMapIfPresent(res);
      if (sent) return;
      return res.status(404).json({ message: 'Map not found' });
    }
    
    const imageBuffer = Buffer.from(map.imageData, 'base64');
    res.contentType(map.contentType || 'image/png');
    res.send(imageBuffer);
  } catch (err) {
    console.error('Error serving map:', err);
    const sent = sendFallbackMapIfPresent(res);
    if (sent) return;
    res.status(500).json({ message: err.message });
  }
});

// Get map metadata (MUST be before /:name)
router.get('/map-metadata', async (req, res) => {
  try {
    let lastUpdated;

    if (isDbReady()) {
      const map = await Map.findOne({ name: 'campus-map' });
      if (map) {
        const raw = map.updatedAt || map.uploadedAt;
        lastUpdated = raw ? new Date(raw).getTime() : undefined;
      }
    }

    if (!lastUpdated) {
      try {
        for (const mapPath of FALLBACK_MAP_PATHS) {
          if (fs.existsSync(mapPath)) {
            lastUpdated = fs.statSync(mapPath).mtimeMs;
            break;
          }
        }
      } catch (e) {
        // ignore
      }
    }

    res.json({ lastUpdated: lastUpdated || Date.now() });
  } catch (err) {
    console.error('Error reading map metadata:', err);
    res.json({ lastUpdated: Date.now() });
  }
});

// Serve block image from database (MUST be before /:name)
router.get('/image/:name', async (req, res) => {
  try {
    if (!isDbReady()) {
      return res.status(503).json({ message: 'Database not connected' });
    }
    const block = await Block.findOne({ name: req.params.name });
    
    if (!block || !block.imageData) {
      return res.status(404).json({ message: 'Image not found' });
    }
    
    const imageBuffer = Buffer.from(block.imageData, 'base64');
    res.contentType(block.imageContentType || 'image/png');
    res.send(imageBuffer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single block by name (This route MUST come after specific routes)
router.get('/:name', async (req, res) => {
  try {
    if (!isDbReady()) {
      const fallback = FALLBACK_BLOCKS.find((b) => b.name === req.params.name);
      if (!fallback) {
        return res.status(404).json({ message: 'Block not found' });
      }
      return res.json(fallback);
    }
    const block = await Block.findOne({ name: req.params.name });
    if (!block) {
      return res.status(404).json({ message: 'Block not found' });
    }
    res.json(block);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create new block
router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!isDbReady()) {
      return res.status(503).json({ message: 'Database not connected' });
    }
    // Handle both JSON and multipart/form-data
    let blockData;
    if (req.body.data) {
      // Multipart form-data (from dashboard with file upload)
      blockData = JSON.parse(req.body.data);
    } else {
      // Regular JSON (from home page quick create)
      blockData = req.body;
    }
    
    // Validate required fields
    if (!blockData.name) {
      return res.status(400).json({ message: 'Block name is required' });
    }
    
    // If file was uploaded, convert to base64 and store in DB
    if (req.file) {
      blockData.imageData = req.file.buffer.toString('base64');
      blockData.imageContentType = req.file.mimetype;
      blockData.image = `/api/blocks/image/${blockData.name}`; // Virtual path
    } else {
      blockData.image = blockData.image || '';
    }
    
    // Set displayName to name if not provided
    if (!blockData.displayName) {
      blockData.displayName = blockData.name;
    }
    
    const block = new Block(blockData);
    const newBlock = await block.save();
    res.status(201).json(newBlock);
  } catch (err) {
    console.error('Error creating block:', err);
    res.status(400).json({ message: err.message });
  }
});

// Update block by ID
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    if (!isDbReady()) {
      return res.status(503).json({ message: 'Database not connected' });
    }
    const blockData = req.body.data ? JSON.parse(req.body.data) : req.body;
    
    // If file was uploaded, convert to base64 and store in DB
    if (req.file) {
      blockData.imageData = req.file.buffer.toString('base64');
      blockData.imageContentType = req.file.mimetype;
      
      // Get block name for virtual path
      const existingBlock = await Block.findById(req.params.id);
      if (existingBlock) {
        blockData.image = `/api/blocks/image/${existingBlock.name}`;
      }
    }
    
    // Set displayName to name if not provided
    if (!blockData.displayName && blockData.name) {
      blockData.displayName = blockData.name;
    }
    
    const block = await Block.findByIdAndUpdate(
      req.params.id,
      blockData,
      { new: true, runValidators: true }
    );
    
    if (!block) {
      return res.status(404).json({ message: 'Block not found' });
    }
    
    res.json(block);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update block by name (for coordinate updates from map)
router.put('/name/:name', async (req, res) => {
  try {
    if (!isDbReady()) {
      return res.status(503).json({ message: 'Database not connected' });
    }
    const blockData = req.body;
    
    const block = await Block.findOneAndUpdate(
      { name: req.params.name },
      blockData,
      { new: true, runValidators: true }
    );
    
    if (!block) {
      return res.status(404).json({ message: 'Block not found' });
    }
    
    res.json(block);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete block by ID (ObjectId) OR by name
router.delete('/:identifier', async (req, res) => {
  try {
    if (!isDbReady()) {
      return res.status(503).json({ message: 'Database not connected' });
    }
    const { identifier } = req.params;

    const isObjectId = mongoose.Types.ObjectId.isValid(identifier);
    const block = isObjectId
      ? await Block.findByIdAndDelete(identifier)
      : await Block.findOneAndDelete({ name: identifier });

    if (!block) {
      return res.status(404).json({ message: 'Block not found' });
    }

    res.json({ message: 'Block deleted successfully', block });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Upload new map image to database
router.post('/upload-map', upload.single('map'), async (req, res) => {
  try {
    if (!isDbReady()) {
      return res.status(503).json({ message: 'Database not connected' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No map image uploaded' });
    }

    // Convert image to base64
    const imageData = req.file.buffer.toString('base64');
    const contentType = req.file.mimetype;
    const timestamp = Date.now();

    // Check if map exists, update or create
    let map = await Map.findOne({ name: 'campus-map' });
    
    if (map) {
      // Update existing map
      map.imageData = imageData;
      map.contentType = contentType;
      map.updatedAt = timestamp;
      await map.save();
    } else {
      // Create new map
      map = new Map({
        name: 'campus-map',
        imageData: imageData,
        contentType: contentType,
        uploadedAt: timestamp,
        updatedAt: timestamp
      });
      await map.save();
    }

    res.json({ 
      message: 'Map uploaded successfully to database',
      path: '/api/blocks/map-image',
      timestamp: timestamp
    });
  } catch (err) {
    console.error('Map upload error:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
