const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

app.disable('x-powered-by');

// Fail fast if MongoDB is unavailable (prevents hanging buffered queries)
mongoose.set('bufferCommands', false);

// Middleware
app.use(cors());
app.use(compression({ threshold: 1024 }));
app.use(express.json());

// Custom video streaming middleware
app.get(/\.(mp4|webm|ogg)$/, (req, res) => {
  const videoPath = path.join(__dirname, req.url);
  
  // Check if file exists
  if (!fs.existsSync(videoPath)) {
    return res.status(404).send('Video not found');
  }

  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(videoPath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    };

    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(200, head);
    fs.createReadStream(videoPath).pipe(res);
  }
});

// Serve static files (images and other non-video files)
app.use('/public', express.static(path.join(__dirname, 'public')));

// MongoDB Connection
if (!process.env.MONGODB_URI) {
  console.warn('⚠️  MONGODB_URI is not set; API will run in fallback mode.');
} else {
  mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  })
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.log('MongoDB connection error:', err.message || err));
}

// Routes
app.use('/api/blocks', require('./routes/blocks'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/video-proxy', require('./routes/video-proxy'));

// Serve React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
  });
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
