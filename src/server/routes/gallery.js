// src/server/routes/gallery.js
const express = require('express');
const router = express.Router();
const path = require('path');
const { readJson, writeJson, deleteFile } = require('../services/fileService');
const config = require('../config');

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
    const indexPath = path.join(config.dataDir, 'gallery', 'index.json');
    const index = await readJson(indexPath);
    const entry = index.captures.find(c => c.id === id);
    if (!entry) return res.status(404).json({ error: 'Not found' });

    await deleteFile(path.join(config.dataDir, 'gallery', entry.filename));
    index.captures = index.captures.filter(c => c.id !== id);
    await writeJson(indexPath, index);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
