const express = require('express');
const router = express.Router();
const axios = require('axios');

// Proxy endpoint for Google Drive videos
router.get('/gdrive/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    
    // Google Drive direct download URL
    const driveUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    
    // Stream the video from Google Drive
    const response = await axios({
      method: 'GET',
      url: driveUrl,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    // Set appropriate headers
    res.setHeader('Content-Type', response.headers['content-type'] || 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }

    // Pipe the video stream to response
    response.data.pipe(res);

  } catch (error) {
    console.error('Error proxying Google Drive video:', error.message);
    
    // If direct download fails, try alternate method
    if (error.response?.status === 403 || error.response?.status === 401) {
      return res.status(403).json({ 
        error: 'Video access denied. Please ensure the file is set to "Anyone with the link can view"',
        fileId: req.params.fileId
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to load video',
      details: error.message 
    });
  }
});

// Proxy endpoint for OneDrive/SharePoint videos
router.get('/onedrive', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    // Convert OneDrive sharing URL to direct download URL
    let downloadUrl = url;
    
    // Handle onedrive.live.com URLs
    if (url.includes('onedrive.live.com')) {
      downloadUrl = url.replace('view.aspx', 'download.aspx');
    }
    
    // Handle 1drv.ms short URLs (need to follow redirect)
    const response = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'stream',
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    // Set appropriate headers
    res.setHeader('Content-Type', response.headers['content-type'] || 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }

    // Pipe the video stream to response
    response.data.pipe(res);

  } catch (error) {
    console.error('Error proxying OneDrive video:', error.message);
    res.status(500).json({ 
      error: 'Failed to load video from OneDrive',
      details: error.message 
    });
  }
});

module.exports = router;
