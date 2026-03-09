const express = require('express');
const router = express.Router();
const axios = require('axios');

function applyUpstreamVideoHeaders(res, upstreamHeaders) {
  const passthroughHeaders = [
    'content-type',
    'content-length',
    'content-range',
    'accept-ranges',
    'etag',
    'last-modified'
  ];

  passthroughHeaders.forEach((headerName) => {
    const value = upstreamHeaders?.[headerName];
    if (value) res.setHeader(headerName, value);
  });

  if (!res.getHeader('Accept-Ranges')) {
    res.setHeader('Accept-Ranges', 'bytes');
  }
}

function toBase64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function buildOneDriveEmbedCandidate(resolvedUrl) {
  if (!resolvedUrl) return '';

  // If already an embed URL, keep it.
  if (resolvedUrl.includes('onedrive.live.com') && resolvedUrl.includes('/embed')) return resolvedUrl;

  // Some OneDrive links use /redir?; embed works with /embed?
  if (resolvedUrl.includes('onedrive.live.com') && resolvedUrl.includes('/redir?')) {
    return resolvedUrl.replace('/redir?', '/embed?');
  }

  // If it’s a view.aspx link, try embed.aspx
  if (resolvedUrl.includes('onedrive.live.com') && resolvedUrl.includes('view.aspx')) {
    return resolvedUrl.replace('view.aspx', 'embed.aspx');
  }

  // Newer consumer links often resolve to photos.onedrive.com/share with cid + resId.
  // We can often embed via onedrive.live.com/embed?cid=...&resid=...
  try {
    const parsed = new URL(resolvedUrl);
    if (parsed.hostname === 'photos.onedrive.com' && parsed.pathname.startsWith('/share/')) {
      const cid = parsed.searchParams.get('cid');
      const resId = parsed.searchParams.get('resId') || parsed.searchParams.get('resid');
      if (cid && resId) {
        const embed = new URL('https://onedrive.live.com/embed');
        embed.searchParams.set('cid', cid);
        embed.searchParams.set('resid', resId);
        embed.searchParams.set('ithint', 'video');
        return embed.toString();
      }
    }
  } catch (_) {
    // ignore
  }

  return '';
}

// Resolve a 1drv.ms / Share link to a concrete URL and provide an embed candidate.
router.get('/onedrive-resolve', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL parameter is required' });

    let resolved = url;

    // Follow redirects (HEAD often works, fallback to GET).
    try {
      const headResp = await axios({
        method: 'HEAD',
        url,
        maxRedirects: 10,
        timeout: 15000,
        validateStatus: (s) => s >= 200 && s < 400,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      resolved = headResp?.request?.res?.responseUrl || resolved;
    } catch (_) {
      const getResp = await axios({
        method: 'GET',
        url,
        maxRedirects: 10,
        timeout: 15000,
        responseType: 'stream',
        validateStatus: (s) => s >= 200 && s < 400,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      resolved = getResp?.request?.res?.responseUrl || resolved;
      // Close stream ASAP
      getResp?.data?.destroy?.();
    }

    const embedCandidate = buildOneDriveEmbedCandidate(resolved);

    return res.json({
      input: url,
      resolved,
      embedCandidate
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to resolve OneDrive URL',
      details: error.message
    });
  }
});

// Proxy endpoint for Google Drive videos
router.get('/gdrive/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    
    // Try multiple Google Drive URL formats
    // Format 1: Direct download (works for smaller files < 100MB)
    let driveUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
    
    // Make initial request to get proper download URL
    const initialResponse = await axios({
      method: 'GET',
      url: driveUrl,
      maxRedirects: 5,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...(req.headers.range ? { Range: req.headers.range } : {})
      },
      validateStatus: (status) => status >= 200 && status < 400
    });

    // Set proper headers for video streaming
    applyUpstreamVideoHeaders(res, initialResponse.headers);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'video/mp4');
    
    // Status code from Google Drive
    res.status(initialResponse.status || 200);
    
    // Pipe the stream
    initialResponse.data.pipe(res);
    
    // Handle stream errors
    initialResponse.data.on('error', (streamError) => {
      console.error('Stream error:', streamError);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Stream error' });
      }
    });

  } catch (error) {
    console.error('Error proxying Google Drive video:', error.message);
    
    // Provide helpful error messages
    if (error.response?.status === 403) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'The Google Drive file may not be publicly accessible',
        solution: 'Right-click file in Drive → Share → Change to "Anyone with the link"',
        fileId: req.params.fileId
      });
    }
    
    if (error.response?.status === 404) {
      return res.status(404).json({ 
        error: 'Video not found',
        message: 'The file ID may be incorrect or the file was deleted',
        fileId: req.params.fileId
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to load video',
      details: error.message,
      fileId: req.params.fileId
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

    console.log('OneDrive URL received:', url);

    // Best-effort: use OneDrive public sharing API to get direct content.
    // This works when the link is set to "Anyone with the link".
    const shareId = `u!${toBase64Url(url)}`;
    const sharesApiUrl = `https://api.onedrive.com/v1.0/shares/${shareId}/root/content`;

    // For OneDrive, we'll try to get a direct content stream (shares API), then fall back.
    let downloadUrl = url;
    
    // Handle 1drv.ms short URLs - need to resolve to get the actual URL first
    if (url.includes('1drv.ms')) {
      try {
        // First follow the redirect to get the actual OneDrive URL
        const redirectResponse = await axios({
          method: 'GET',
          url: url,
          maxRedirects: 0,
          validateStatus: (status) => status >= 200 && status < 400
        });
        
        // If we got redirected, use the location
        if (redirectResponse.headers.location) {
          downloadUrl = redirectResponse.headers.location;
          console.log('Resolved 1drv.ms to:', downloadUrl);
        }
      } catch (redirectError) {
        if (redirectError.response && redirectError.response.headers.location) {
          downloadUrl = redirectError.response.headers.location;
          console.log('Resolved 1drv.ms to:', downloadUrl);
        } else {
          console.error('Failed to resolve 1drv.ms link:', redirectError.message);
        }
      }
    }
    
    // Convert to download URL (fallback path)
    if (downloadUrl.includes('onedrive.live.com')) {
      // Replace 'redir' or 'view' with 'download'
      downloadUrl = downloadUrl
        .replace('/redir?', '/download?')
        .replace('view.aspx', 'download.aspx')
        .replace('/embed?', '/download?');
      
      console.log('Converted to download URL:', downloadUrl);
    }

    const requestHeaders = {
      ...(req.headers.range ? { Range: req.headers.range } : {}),
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    // Try shares API first
    let response;
    try {
      console.log('Trying OneDrive shares API:', sharesApiUrl);
      response = await axios({
        method: 'GET',
        url: sharesApiUrl,
        responseType: 'stream',
        maxRedirects: 10,
        timeout: 30000,
        headers: requestHeaders,
        validateStatus: (status) => status >= 200 && status < 400
      });
    } catch (sharesApiError) {
      console.log('Shares API failed, falling back. Reason:', sharesApiError.message);
    }

    // Fall back to the resolved/converted URL
    if (!response) {
      response = await axios({
        method: 'GET',
        url: downloadUrl,
        responseType: 'stream',
        maxRedirects: 10,
        timeout: 30000,
        headers: requestHeaders
      });
    }

    const upstreamContentType = String(response.headers?.['content-type'] || '');
    if (upstreamContentType.includes('text/html')) {
      response.data?.destroy?.();
      return res.status(403).json({
        error: 'OneDrive returned an HTML page instead of a video stream.',
        hint: 'This usually means the link requires sign-in or is not an "Anyone with the link" share. Use a true public link, an OneDrive embed link, or upload the video locally/YouTube.',
        contentType: upstreamContentType
      });
    }

    applyUpstreamVideoHeaders(res, response.headers);
    res.setHeader('Access-Control-Allow-Origin', '*');

    console.log('Streaming video, Content-Type:', response.headers['content-type']);

    // Pipe the video stream to response
    res.status(response.status || 200);
    response.data.pipe(res);

    response.data.on('error', (error) => {
      console.error('Stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Stream error' });
      }
    });

  } catch (error) {
    console.error('Error proxying OneDrive video:', error.message);
    console.error('Error details:', error.response?.status, error.response?.statusText);

    if (error.response?.status === 401 || error.response?.status === 403) {
      return res.status(403).json({
        error: 'OneDrive link is not accessible for streaming (authentication required).',
        hint: 'Change the OneDrive share setting to "Anyone with the link" (if your org allows), or use an OneDrive Embed link, or upload the video locally/YouTube.',
        status: error.response.status
      });
    }
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to load video from OneDrive',
        details: error.message,
        url: req.query.url
      });
    }
  }
});

module.exports = router;
