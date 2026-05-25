// src/server/routes/capture.js
const express = require('express');
const router = express.Router();
const captureService = require('../services/captureService');
const config = require('../config');

router.post('/single', async (req, res, next) => {
  try {
    const entry = await captureService.captureOne(config.dataDir);
    res.json(entry);
  } catch (err) {
    next(err);
  }
});

router.post('/start', (req, res) => {
  if (!captureService.isCapturing()) {
    captureService.startAutoCapture(config.dataDir, config.capture.intervalMs, null);
  }
  res.json({ capturing: true });
});

router.post('/stop', (req, res) => {
  captureService.stopAutoCapture();
  res.json({ capturing: false });
});

router.get('/status', (req, res) => {
  res.json({ capturing: captureService.isCapturing() });
});

module.exports = router;
