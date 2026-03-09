const express = require('express');
const router = express.Router();
const Block = require('../models/Block');

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
router.post('/', async (req, res) => {
  const block = new Block(req.body);
  try {
    const newBlock = await block.save();
    res.status(201).json(newBlock);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
