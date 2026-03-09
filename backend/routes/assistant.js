const express = require('express');
const axios = require('axios');

const router = express.Router();

const ASSISTANT_BASE_URL = (process.env.ASSISTANT_SERVICE_URL || 'http://localhost:5001').replace(/\/$/, '');

function buildTargetUrl(path, query) {
  const target = new URL(ASSISTANT_BASE_URL + path);
  if (query && typeof query === 'object') {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      target.searchParams.set(key, String(value));
    }
  }
  return target.toString();
}

async function proxyJson(req, res, path) {
  const url = buildTargetUrl(path, req.query);
  try {
    const response = await axios({
      method: req.method,
      url,
      data: req.body,
      headers: {
        'Content-Type': req.get('Content-Type') || 'application/json',
      },
      timeout: 30000,
      validateStatus: () => true,
    });

    res.status(response.status);
    // Pass through JSON (Flask returns application/json)
    return res.json(response.data);
  } catch (error) {
    const message = error?.message || 'Assistant service unreachable';
    return res.status(502).json({
      success: false,
      error: message,
      hint: 'Start the Python assistant service on http://localhost:5001',
    });
  }
}

async function proxyTts(req, res) {
  const url = buildTargetUrl('/api/assistant/tts', req.query);
  try {
    const response = await axios({
      method: 'POST',
      url,
      data: req.body,
      headers: {
        'Content-Type': 'application/json',
      },
      responseType: 'arraybuffer',
      timeout: 60000,
      validateStatus: () => true,
    });

    res.status(response.status);
    // Best-effort content-type; Flask uses audio/mpeg
    res.set('Content-Type', response.headers['content-type'] || 'audio/mpeg');
    return res.send(Buffer.from(response.data));
  } catch (error) {
    const message = error?.message || 'Assistant TTS unreachable';
    return res.status(502).json({
      success: false,
      error: message,
      hint: 'Start the Python assistant service on http://localhost:5001',
    });
  }
}

router.get('/status', (req, res) => proxyJson(req, res, '/api/assistant/status'));
router.get('/greeting', (req, res) => proxyJson(req, res, '/api/assistant/greeting'));
router.get('/history', (req, res) => proxyJson(req, res, '/api/assistant/history'));
router.get('/languages', (req, res) => proxyJson(req, res, '/api/assistant/languages'));
router.post('/query', (req, res) => proxyJson(req, res, '/api/assistant/query'));
router.post('/tts', (req, res) => proxyTts(req, res));

module.exports = router;
