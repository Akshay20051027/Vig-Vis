const express = require('express');
const axios = require('axios');

const router = express.Router();

const ASSISTANT_BASE_URL = process.env.ASSISTANT_SERVICE_URL || 'http://localhost:5001';

async function forwardJson(req, res, method, upstreamPath) {
  try {
    const response = await axios({
      method,
      url: `${ASSISTANT_BASE_URL}${upstreamPath}`,
      params: req.query,
      data: req.body,
      timeout: 30000,
      validateStatus: () => true,
    });

    if (response.headers['content-type']) {
      res.setHeader('Content-Type', response.headers['content-type']);
    }
    return res.status(response.status).send(response.data);
  } catch (error) {
    return res.status(502).json({
      success: false,
      error: 'Assistant service unavailable',
      detail: error.message,
    });
  }
}

router.get('/status', async (req, res) => {
  await forwardJson(req, res, 'get', '/api/assistant/status');
});

router.get('/greeting', async (req, res) => {
  await forwardJson(req, res, 'get', '/api/assistant/greeting');
});

router.get('/languages', async (req, res) => {
  await forwardJson(req, res, 'get', '/api/assistant/languages');
});

router.get('/history', async (req, res) => {
  await forwardJson(req, res, 'get', '/api/assistant/history');
});

router.post('/query', async (req, res) => {
  await forwardJson(req, res, 'post', '/api/assistant/query');
});

router.post('/tts', async (req, res) => {
  try {
    const response = await axios({
      method: 'post',
      url: `${ASSISTANT_BASE_URL}/api/assistant/tts`,
      data: req.body,
      params: req.query,
      timeout: 45000,
      responseType: 'arraybuffer',
      validateStatus: () => true,
    });

    if (response.headers['content-type']) {
      res.setHeader('Content-Type', response.headers['content-type']);
    }
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }

    return res.status(response.status).send(Buffer.from(response.data));
  } catch (error) {
    return res.status(502).json({
      success: false,
      error: 'Assistant TTS unavailable',
      detail: error.message,
    });
  }
});

module.exports = router;
