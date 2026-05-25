// src/server/routes/gallery.js
const express = require('express');
const router = express.Router();
const path = require('path');
const { readJson, writeJson, deleteFile } = require('../services/fileService');
const config = require('../config');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get('/', async (req, res, next) => {
  try {
    const indexPath = path.join(config.dataDir, 'gallery', 'index.json');
    let index;
    try {
      index = await readJson(indexPath);
    } catch {
      index = { captures: [] };
    }
    res.json(index);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid id' });

    const indexPath = path.join(config.dataDir, 'gallery', 'index.json');
    const index = await readJson(indexPath);
    const entry = index.captures.find(c => c.id === id);
    if (!entry) return res.status(404).json({ error: 'Not found' });

    // Guard against a tampered index.json pointing outside the gallery dir
    const expectedFilename = `${entry.id}.png`;
    if (entry.filename !== expectedFilename) return res.status(400).json({ error: 'Corrupted index entry' });

    await deleteFile(path.join(config.dataDir, 'gallery', entry.filename));
    index.captures = index.captures.filter(c => c.id !== id);
    await writeJson(indexPath, index);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
