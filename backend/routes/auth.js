const express = require('express');
const router = express.Router();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');

function isDbReady() {
  return mongoose.connection && mongoose.connection.readyState === 1;
}

// Login endpoint
router.post('/login', (req, res) => {
  (async () => {
    const { username, password } = req.body;

    if (!isDbReady()) {
      return res.status(503).json({
        success: false,
        message: 'Database not connected',
      });
    }

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required',
      });
    }

    const hasAnyAdmin = await Admin.exists({});
    if (!hasAnyAdmin) {
      return res.status(401).json({
        success: false,
        message: 'No admin account is configured yet',
      });
    }

    const admin = await Admin.findOne({ username }).lean();
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password',
      });
    }

    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password',
      });
    }

    // Demo token (for real production, use JWT + expiration)
    const token = Buffer.from(`${username}:${Date.now()}`).toString('base64');

    return res.json({
      success: true,
      token,
      username,
      message: 'Login successful',
    });
  })().catch((error) => {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Login failed',
    });
  });
});

// Verify token middleware (simple version)
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  // In production, verify JWT token properly
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    req.user = decoded.split(':')[0];
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

async function requireAdmin(req, res, next) {
  try {
    if (!isDbReady()) {
      return res.status(503).json({ success: false, message: 'Database not connected' });
    }

    const username = req.user;
    if (!username) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const admin = await Admin.findOne({ username }).lean();
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    return next();
  } catch (error) {
    console.error('Auth check error:', error);
    return res.status(500).json({ success: false, message: 'Auth check failed' });
  }
}

// Create the first admin explicitly (only allowed when DB has zero admins)
router.post('/bootstrap', (req, res) => {
  (async () => {
    const { username, password } = req.body;

    if (!isDbReady()) {
      return res.status(503).json({ success: false, message: 'Database not connected' });
    }

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    const hasAnyAdmin = await Admin.exists({});
    if (hasAnyAdmin) {
      return res.status(409).json({
        success: false,
        message: 'Bootstrap is disabled because an admin already exists',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await Admin.create({ username, passwordHash });

    const token = Buffer.from(`${username}:${Date.now()}`).toString('base64');
    return res.json({ success: true, token, username, message: 'Admin created' });
  })().catch((error) => {
    console.error('Bootstrap error:', error);
    return res.status(500).json({ success: false, message: 'Bootstrap failed' });
  });
});

router.get('/verify', verifyToken, (req, res) => {
  res.json({ success: true, user: req.user });
});

// Admin management (requires Authorization: Bearer <token>)
router.get('/admins', verifyToken, requireAdmin, (req, res) => {
  (async () => {
    const admins = await Admin.find({}, { username: 1, createdAt: 1, updatedAt: 1 }).sort({ username: 1 }).lean();
    return res.json({ success: true, admins });
  })().catch((error) => {
    console.error('List admins error:', error);
    return res.status(500).json({ success: false, message: 'Failed to list admins' });
  });
});

router.post('/admins', verifyToken, requireAdmin, (req, res) => {
  (async () => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    const existing = await Admin.findOne({ username }).lean();
    if (existing) {
      return res.status(409).json({ success: false, message: 'Username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const created = await Admin.create({ username, passwordHash });

    return res.status(201).json({
      success: true,
      admin: { _id: created._id, username: created.username, createdAt: created.createdAt, updatedAt: created.updatedAt },
    });
  })().catch((error) => {
    console.error('Create admin error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create admin' });
  });
});

router.put('/admins/:id', verifyToken, requireAdmin, (req, res) => {
  (async () => {
    const { id } = req.params;
    const { username, password } = req.body;

    const update = {};
    if (username) update.username = username;
    if (password) update.passwordHash = await bcrypt.hash(password, 10);

    if (!update.username && !update.passwordHash) {
      return res.status(400).json({ success: false, message: 'Nothing to update' });
    }

    const updated = await Admin.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    return res.json({
      success: true,
      admin: { _id: updated._id, username: updated.username, createdAt: updated.createdAt, updatedAt: updated.updatedAt },
    });
  })().catch((error) => {
    // Handle duplicate username
    if (error && (error.code === 11000 || String(error.message || '').includes('duplicate key'))) {
      return res.status(409).json({ success: false, message: 'Username already exists' });
    }
    console.error('Update admin error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update admin' });
  });
});

router.delete('/admins/:id', verifyToken, requireAdmin, (req, res) => {
  (async () => {
    const deleted = await Admin.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }
    return res.json({ success: true, message: 'Admin deleted' });
  })().catch((error) => {
    console.error('Delete admin error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete admin' });
  });
});

module.exports = router;
