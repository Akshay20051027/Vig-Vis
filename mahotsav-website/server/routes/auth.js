const express = require('express');
const router = express.Router();

// Simple authentication (in production, use proper authentication with JWT and password hashing)
const users = [
  { username: 'admin', password: 'admin123' } // Demo credentials
];

// Login endpoint
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  const user = users.find(u => u.username === username && u.password === password);
  
  if (user) {
    // In production, generate a proper JWT token
    const token = Buffer.from(`${username}:${Date.now()}`).toString('base64');
    
    res.json({
      success: true,
      token: token,
      username: user.username,
      message: 'Login successful'
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid username or password'
    });
  }
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

router.get('/verify', verifyToken, (req, res) => {
  res.json({ success: true, user: req.user });
});

module.exports = router;
