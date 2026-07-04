// src/server/routes/parcours.js
const express = require('express');
const router  = express.Router();
const svc     = require('../services/parcoursService');
const config  = require('../config');

router.get('/', async (req, res, next) => {
  try { res.json(await svc.listParcours(config.dataDir)); }
  catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try { res.status(201).json(await svc.createParcours(config.dataDir, req.body)); }
  catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try { res.json(await svc.getParcours(config.dataDir, req.params.id)); }
  catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try { res.json(await svc.updateParcours(config.dataDir, req.params.id, req.body)); }
  catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try { await svc.deleteParcours(config.dataDir, req.params.id); res.status(204).end(); }
  catch (e) { next(e); }
});

router.post('/:id/versions', async (req, res, next) => {
  try { res.status(201).json(await svc.createVersion(config.dataDir, req.params.id, req.body)); }
  catch (e) { next(e); }
});

module.exports = router;
