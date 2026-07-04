// src/server/routes/steps.js
const express = require('express');
const router  = express.Router({ mergeParams: true });
const svc     = require('../services/stepService');
const config  = require('../config');

router.get('/', async (req, res, next) => {
  try { res.json(await svc.listSteps(config.dataDir, req.params.id, req.params.ver)); }
  catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    res.status(201).json(
      await svc.addStep(config.dataDir, req.params.id, req.params.ver, req.body));
  } catch (e) { next(e); }
});

// /order must be registered before /:stepId to avoid shadowing
router.put('/order', async (req, res, next) => {
  try {
    await svc.reorderSteps(config.dataDir, req.params.id, req.params.ver, req.body.orderedIds);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/:stepId', async (req, res, next) => {
  try {
    res.json(await svc.getStep(config.dataDir, req.params.id, req.params.ver, req.params.stepId));
  } catch (e) { next(e); }
});

router.put('/:stepId', async (req, res, next) => {
  try {
    res.json(
      await svc.updateStep(config.dataDir, req.params.id, req.params.ver, req.params.stepId, req.body));
  } catch (e) { next(e); }
});

router.delete('/:stepId', async (req, res, next) => {
  try {
    await svc.removeStep(config.dataDir, req.params.id, req.params.ver, req.params.stepId);
    res.status(204).end();
  } catch (e) { next(e); }
});

router.put('/:stepId/screenshot', async (req, res, next) => {
  try {
    res.json(
      await svc.replaceScreenshot(config.dataDir, req.params.id, req.params.ver, req.params.stepId, req.body));
  } catch (e) { next(e); }
});

module.exports = router;
