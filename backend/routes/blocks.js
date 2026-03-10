const express = require('express');
const router = express.Router();
const Block = require('../models/Block');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

let sharp;
try {
  // Optional dependency used to generate optimized WebP assets.
  // If unavailable, the server will still work and serve the original file.
  sharp = require('sharp');
} catch (_) {
  sharp = null;
}

const HOT_CACHE_TTL_MS = 5000;

let blocksCache = { at: 0, value: null };
let mapMetaCache = { at: 0, value: { lastUpdated: 0 } };
let mapImageCache = { lastUpdatedMs: 0, contentType: 'image/png', buffer: null, filePath: '' };

const FALLBACK_MAP_PATHS = [
  // Preferred: drop a new map here (no DB needed)
  path.join(__dirname, '..', 'public', 'assets', 'campus-map.webp'),
  path.join(__dirname, '..', 'public', 'assets', 'campus-map.png'),
  path.join(__dirname, '..', 'public', 'assets', 'campus-map.jpg'),
  path.join(__dirname, '..', 'public', 'assets', 'campus-map.jpeg'),
  // Legacy-style local public/ map (optional)
  path.join(__dirname, '..', 'public', 'map.webp'),
  path.join(__dirname, '..', 'public', 'map.png'),
  path.join(__dirname, '..', 'public', 'map.jpg'),
  path.join(__dirname, '..', 'public', 'map.jpeg'),
];

const FALLBACK_BLOCKS = [
  {
    name: 'a-block',
    displayName: 'A-block',
    image: '/public/a-block/ablock.jpg',
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

function ensureDirSync(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
  } catch (_) {
    // ignore
  }
}

function safeFileBaseName(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9\-_.]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .slice(0, 80);
}

function extFromMimetype(mimetype) {
  const m = String(mimetype || '').toLowerCase();
  if (m === 'image/png') return '.png';
  if (m === 'image/jpeg' || m === 'image/jpg') return '.jpg';
  if (m === 'image/webp') return '.webp';
  if (m === 'image/gif') return '.gif';
  return '';
}

function resolveFallbackMapPath() {
  for (const mapPath of FALLBACK_MAP_PATHS) {
    try {
      if (!fs.existsSync(mapPath)) continue;
      return mapPath;
    } catch (_) {
      // ignore
    }
  }
  return '';
}

function clientAcceptsWebp(req) {
  const accept = String(req.headers?.accept || '').toLowerCase();
  return accept.includes('image/webp');
}

function resolveMapPathForRequest(req) {
  // Prefer WebP only when the client indicates support.
  const wantsWebp = clientAcceptsWebp(req);
  if (wantsWebp) {
    const preferredWebp = FALLBACK_MAP_PATHS.find((p) => p.toLowerCase().endsWith('.webp'));
    if (preferredWebp) {
      try {
        if (fs.existsSync(preferredWebp)) return preferredWebp;
      } catch (_) {
        // ignore
      }
    }
  }

  // Otherwise, return first available non-webp, falling back to any existing map.
  for (const mapPath of FALLBACK_MAP_PATHS) {
    if (wantsWebp && mapPath.toLowerCase().endsWith('.webp')) continue;
    try {
      if (!fs.existsSync(mapPath)) continue;
      return mapPath;
    } catch (_) {
      // ignore
    }
  }

  // Last resort: whatever exists.
  return resolveFallbackMapPath();
}

function getAnyMapLastUpdatedMs() {
  let best = 0;
  for (const mapPath of FALLBACK_MAP_PATHS) {
    try {
      if (!fs.existsSync(mapPath)) continue;
      const ms = Math.trunc(fs.statSync(mapPath).mtimeMs);
      if (ms > best) best = ms;
    } catch (_) {
      // ignore
    }
  }
  return best;
}

function sendFileWithCacheHeaders(req, res, filePath, cacheSeconds) {
  const stat = fs.statSync(filePath);
  const lastModified = new Date(stat.mtimeMs);
  const etag = `W/"${path.basename(filePath)}-${stat.size}-${Math.trunc(stat.mtimeMs)}"`;

  res.set('Last-Modified', lastModified.toUTCString());
  res.set('ETag', etag);
  res.set('Cache-Control', `public, max-age=${cacheSeconds}`);

  const ifNoneMatch = req.headers['if-none-match'];
  if (ifNoneMatch && String(ifNoneMatch) === etag) {
    return res.status(304).end();
  }

  const ifModifiedSince = req.headers['if-modified-since'];
  if (ifModifiedSince) {
    const sinceDate = new Date(ifModifiedSince);
    if (!Number.isNaN(sinceDate.getTime()) && lastModified <= sinceDate) {
      return res.status(304).end();
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') res.type('png');
  else if (ext === '.jpg' || ext === '.jpeg') res.type('jpeg');
  else if (ext === '.webp') res.type('webp');
  else if (ext === '.gif') res.type('gif');

  return res.sendFile(filePath);
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

    const now = Date.now();
    if (blocksCache.value && now - blocksCache.at < HOT_CACHE_TTL_MS) {
      return res.json(blocksCache.value);
    }

    const blocks = await Block.find().lean();
    blocksCache = { at: now, value: blocks };
    res.json(blocks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Serve map image from disk (MUST be before /:name)
router.get('/map-image', async (req, res) => {
  try {
    const hasCacheBuster = /^\d+$/.test(String(req.query.t || ''));
    const tMs = hasCacheBuster ? Math.trunc(Number(req.query.t)) : 0;
    const mapPath = resolveMapPathForRequest(req);
    if (!mapPath) {
      return res.status(404).json({ message: 'Map not found (no campus-map file present)' });
    }

    // Memory short-circuit when client requests exact version.
    if (hasCacheBuster && tMs > 0 && mapImageCache.buffer && mapImageCache.lastUpdatedMs === tMs) {
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      res.type(mapImageCache.contentType || 'image/png');
      return res.send(mapImageCache.buffer);
    }

    const cacheSeconds = hasCacheBuster ? 31536000 : 60;
    const stat = fs.statSync(mapPath);
    const lastUpdatedMs = Math.trunc(stat.mtimeMs);

    // Refresh in-process buffer cache for the map.
    if (!mapImageCache.buffer || mapImageCache.lastUpdatedMs !== lastUpdatedMs || mapImageCache.filePath !== mapPath) {
      const ext = path.extname(mapPath).toLowerCase();
      const contentType = ext === '.png' ? 'image/png' : (ext === '.webp' ? 'image/webp' : 'image/jpeg');
      mapImageCache = {
        lastUpdatedMs,
        contentType,
        buffer: fs.readFileSync(mapPath),
        filePath: mapPath,
      };
    }

    // If client passed ?t, treat as immutable (only when it matches the actual file mtime).
    if (hasCacheBuster && tMs > 0 && tMs === lastUpdatedMs) {
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      res.set('Last-Modified', new Date(lastUpdatedMs).toUTCString());
      res.set('ETag', `W/"campus-map-${lastUpdatedMs}"`);
      res.type(mapImageCache.contentType || 'image/png');

      const ifNoneMatch = req.headers['if-none-match'];
      if (ifNoneMatch && String(ifNoneMatch) === `W/"campus-map-${lastUpdatedMs}"`) {
        return res.status(304).end();
      }

      const ifModifiedSince = req.headers['if-modified-since'];
      if (ifModifiedSince) {
        const sinceDate = new Date(ifModifiedSince);
        const lastModified = new Date(lastUpdatedMs);
        if (!Number.isNaN(sinceDate.getTime()) && lastModified <= sinceDate) {
          return res.status(304).end();
        }
      }

      return res.send(mapImageCache.buffer);
    }

    return sendFileWithCacheHeaders(req, res, mapPath, cacheSeconds);
  } catch (err) {
    console.error('Error serving map:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get map metadata (MUST be before /:name)
router.get('/map-metadata', async (req, res) => {
  try {
    const now = Date.now();
    if (mapMetaCache.value && now - mapMetaCache.at < HOT_CACHE_TTL_MS) {
      return res.json(mapMetaCache.value);
    }

    const lastUpdated = getAnyMapLastUpdatedMs();

    // If we can't determine a stable timestamp, return 0 to avoid clients
    // continuously refreshing the map with a changing Date.now() value.
    const payload = { lastUpdated: lastUpdated || 0 };
    mapMetaCache = { at: now, value: payload };
    res.json(payload);
  } catch (err) {
    console.error('Error reading map metadata:', err);
    res.json({ lastUpdated: 0 });
  }
});

// Serve block image from database (MUST be before /:name)
router.get('/image/:name', async (req, res) => {
  try {
    if (!isDbReady()) {
      return res.status(503).json({ message: 'Database not connected' });
    }
    const block = await Block.findOne({ name: req.params.name }).lean();

    if (!block || !block.image) {
      return res.status(404).json({ message: 'Image not found' });
    }

    // New approach: image is a URL under /public/blocks/*. Just redirect.
    if (String(block.image).startsWith('/public/')) {
      return res.redirect(302, block.image);
    }

    return res.status(404).json({ message: 'Image not found' });
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
    const block = await Block.findOne({ name: req.params.name }).lean();
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

    // Invalidate list cache so new items appear immediately.
    blocksCache = { at: 0, value: null };
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
    
    // If file was uploaded, store it on disk and keep only a URL in MongoDB.
    if (req.file) {
      const blocksDir = path.join(__dirname, '..', 'public', 'blocks');
      ensureDirSync(blocksDir);

      const baseName = safeFileBaseName(blockData.name);
      const ext = extFromMimetype(req.file.mimetype) || path.extname(req.file.originalname || '') || '.png';

      // Remove previous versions of the same block image (any extension)
      try {
        for (const candidateExt of ['.png', '.jpg', '.jpeg', '.webp', '.gif']) {
          const candidate = path.join(blocksDir, `${baseName}${candidateExt}`);
          if (fs.existsSync(candidate)) fs.unlinkSync(candidate);
        }
      } catch (_) {
        // ignore
      }

      const fileName = `${baseName}${ext === '.jpeg' ? '.jpg' : ext}`;
      const outPath = path.join(blocksDir, fileName);
      fs.writeFileSync(outPath, req.file.buffer);

      blockData.image = `/public/blocks/${fileName}`;
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

    // Invalidate list cache so updates appear immediately.
    blocksCache = { at: 0, value: null };
    const blockData = req.body.data ? JSON.parse(req.body.data) : req.body;
    
    // If file was uploaded, store it on disk and keep only a URL in MongoDB.
    if (req.file) {
      const existingBlock = await Block.findById(req.params.id).lean();
      const blockName = existingBlock?.name || blockData.name;

      if (blockName) {
        const blocksDir = path.join(__dirname, '..', 'public', 'blocks');
        ensureDirSync(blocksDir);

        const baseName = safeFileBaseName(blockName);
        const ext = extFromMimetype(req.file.mimetype) || path.extname(req.file.originalname || '') || '.png';

        try {
          for (const candidateExt of ['.png', '.jpg', '.jpeg', '.webp', '.gif']) {
            const candidate = path.join(blocksDir, `${baseName}${candidateExt}`);
            if (fs.existsSync(candidate)) fs.unlinkSync(candidate);
          }
        } catch (_) {
          // ignore
        }

        const fileName = `${baseName}${ext === '.jpeg' ? '.jpg' : ext}`;
        const outPath = path.join(blocksDir, fileName);
        fs.writeFileSync(outPath, req.file.buffer);
        blockData.image = `/public/blocks/${fileName}`;
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

    // Invalidate list cache so coordinate updates appear immediately.
    blocksCache = { at: 0, value: null };
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

// Coordinates-only APIs (explicit endpoints)
router.put('/name/:name/coordinates', async (req, res) => {
  try {
    if (!isDbReady()) {
      return res.status(503).json({ message: 'Database not connected' });
    }

    blocksCache = { at: 0, value: null };
    const { coordinates } = req.body || {};
    if (!coordinates) {
      return res.status(400).json({ message: 'coordinates is required' });
    }

    const block = await Block.findOneAndUpdate(
      { name: req.params.name },
      { coordinates },
      { new: true, runValidators: true }
    );

    if (!block) {
      return res.status(404).json({ message: 'Block not found' });
    }

    return res.json(block);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

router.delete('/name/:name/coordinates', async (req, res) => {
  try {
    if (!isDbReady()) {
      return res.status(503).json({ message: 'Database not connected' });
    }

    blocksCache = { at: 0, value: null };

    const block = await Block.findOneAndUpdate(
      { name: req.params.name },
      { coordinates: null },
      { new: true }
    );

    if (!block) {
      return res.status(404).json({ message: 'Block not found' });
    }

    return res.json({ message: 'Coordinates cleared', block });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// Image-only APIs (explicit endpoints)
router.put('/name/:name/image', upload.single('image'), async (req, res) => {
  try {
    if (!isDbReady()) {
      return res.status(503).json({ message: 'Database not connected' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No image uploaded' });
    }

    blocksCache = { at: 0, value: null };
    const blocksDir = path.join(__dirname, '..', 'public', 'blocks');
    ensureDirSync(blocksDir);

    const baseName = safeFileBaseName(req.params.name);
    const ext = extFromMimetype(req.file.mimetype) || path.extname(req.file.originalname || '') || '.png';

    try {
      for (const candidateExt of ['.png', '.jpg', '.jpeg', '.webp', '.gif']) {
        const candidate = path.join(blocksDir, `${baseName}${candidateExt}`);
        if (fs.existsSync(candidate)) fs.unlinkSync(candidate);
      }
    } catch (_) {
      // ignore
    }

    const fileName = `${baseName}${ext === '.jpeg' ? '.jpg' : ext}`;
    const outPath = path.join(blocksDir, fileName);
    fs.writeFileSync(outPath, req.file.buffer);

    const block = await Block.findOneAndUpdate(
      { name: req.params.name },
      { image: `/public/blocks/${fileName}` },
      { new: true, runValidators: true }
    );

    if (!block) {
      return res.status(404).json({ message: 'Block not found' });
    }

    return res.json(block);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.delete('/name/:name/image', async (req, res) => {
  try {
    if (!isDbReady()) {
      return res.status(503).json({ message: 'Database not connected' });
    }

    blocksCache = { at: 0, value: null };
    const block = await Block.findOne({ name: req.params.name });
    if (!block) {
      return res.status(404).json({ message: 'Block not found' });
    }

    const current = String(block.image || '');
    if (current.startsWith('/public/blocks/')) {
      const diskPath = path.join(__dirname, '..', current.replace('/public/', 'public/'));
      try {
        if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
      } catch (_) {
        // ignore
      }
    }

    block.image = '';
    await block.save();
    return res.json({ message: 'Image removed', block });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// Video link APIs (explicit endpoints)
router.put('/name/:name/sections/:sectionName/video', async (req, res) => {
  try {
    if (!isDbReady()) {
      return res.status(503).json({ message: 'Database not connected' });
    }
    blocksCache = { at: 0, value: null };

    const { video } = req.body || {};
    if (!video) {
      return res.status(400).json({ message: 'video is required' });
    }

    const block = await Block.findOne({ name: req.params.name });
    if (!block) {
      return res.status(404).json({ message: 'Block not found' });
    }

    const sectionName = String(req.params.sectionName);
    const section = (block.sections || []).find((s) => String(s.name) === sectionName);
    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }

    section.video = video;
    await block.save();
    return res.json(block);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.delete('/name/:name/sections/:sectionName/video', async (req, res) => {
  try {
    if (!isDbReady()) {
      return res.status(503).json({ message: 'Database not connected' });
    }
    blocksCache = { at: 0, value: null };

    const block = await Block.findOne({ name: req.params.name });
    if (!block) {
      return res.status(404).json({ message: 'Block not found' });
    }

    const sectionName = String(req.params.sectionName);
    const section = (block.sections || []).find((s) => String(s.name) === sectionName);
    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }

    section.video = '';
    await block.save();
    return res.json({ message: 'Video link removed', block });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// Delete block by ID (ObjectId) OR by name
router.delete('/:identifier', async (req, res) => {
  try {
    if (!isDbReady()) {
      return res.status(503).json({ message: 'Database not connected' });
    }

    // Invalidate list cache so deletion appears immediately.
    blocksCache = { at: 0, value: null };
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
    // Store the campus map on disk for fast retrieval and easy CDN/static serving.
    mapMetaCache = { at: 0, value: { lastUpdated: 0 } };
    mapImageCache = { lastUpdatedMs: 0, contentType: 'image/png', buffer: null, filePath: '' };
    if (!req.file) {
      return res.status(400).json({ message: 'No map image uploaded' });
    }

    const assetsDir = path.join(__dirname, '..', 'public', 'assets');
    ensureDirSync(assetsDir);

    const ext = extFromMimetype(req.file.mimetype) || path.extname(req.file.originalname || '') || '.png';
    const normalizedExt = ext === '.jpeg' ? '.jpg' : ext;
    const outPath = path.join(assetsDir, `campus-map${normalizedExt}`);
    const webpPath = path.join(assetsDir, 'campus-map.webp');

    // Remove older versions (other extensions)
    try {
      for (const candidateExt of ['.png', '.jpg', '.jpeg', '.webp', '.gif']) {
        const candidate = path.join(assetsDir, `campus-map${candidateExt === '.jpeg' ? '.jpg' : candidateExt}`);
        if (fs.existsSync(candidate) && candidate !== outPath) fs.unlinkSync(candidate);
      }
    } catch (_) {
      // ignore
    }

    fs.writeFileSync(outPath, req.file.buffer);

    // Generate an optimized WebP variant for faster map loading.
    if (sharp) {
      try {
        await sharp(req.file.buffer)
          .webp({ quality: 80 })
          .toFile(webpPath);
      } catch (e) {
        console.warn('Map WebP generation failed; serving original only:', e?.message || e);
      }
    }

    // Keep mtimes aligned so cache-busting timestamps match whichever format is served.
    const nowDate = new Date();
    try {
      fs.utimesSync(outPath, nowDate, nowDate);
      if (fs.existsSync(webpPath)) fs.utimesSync(webpPath, nowDate, nowDate);
    } catch (_) {
      // ignore
    }

    const timestamp = Math.trunc(nowDate.getTime());

    res.json({
      message: 'Map uploaded successfully',
      path: '/api/blocks/map-image',
      timestamp,
    });
  } catch (err) {
    console.error('Map upload error:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
