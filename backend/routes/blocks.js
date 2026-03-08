const express = require('express');
const router = express.Router();
const Block = require('../models/Block');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../public/blocks');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Use original filename with timestamp to avoid conflicts
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Accept images only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

// Get all blocks
router.get('/', async (req, res) => {
  try {
    const blocks = await Block.find();
    res.json(blocks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single block by name
router.get('/:name', async (req, res) => {
  try {
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
    const blockData = JSON.parse(req.body.data || '{}');
    
    // Validate required fields
    if (!blockData.name) {
      return res.status(400).json({ message: 'Block name is required' });
    }
    
    // If file was uploaded, set the image path
    if (req.file) {
      blockData.image = `/public/blocks/${req.file.filename}`;
    } else if (!blockData.image) {
      // If no file uploaded and no existing image path, return error
      return res.status(400).json({ message: 'Block image is required. Please upload an image file.' });
    }
    
    // Set displayName to name if not provided
    if (!blockData.displayName) {
      blockData.displayName = blockData.name;
    }
    
    const block = new Block(blockData);
    const newBlock = await block.save();
    res.status(201).json(newBlock);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update block by ID
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const blockData = req.body.data ? JSON.parse(req.body.data) : req.body;
    
    // If file was uploaded, set the image path
    if (req.file) {
      blockData.image = `/public/blocks/${req.file.filename}`;
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

// Delete block by ID
router.delete('/:id', async (req, res) => {
  try {
    const block = await Block.findByIdAndDelete(req.params.id);
    
    if (!block) {
      return res.status(404).json({ message: 'Block not found' });
    }
    
    res.json({ message: 'Block deleted successfully', block });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
