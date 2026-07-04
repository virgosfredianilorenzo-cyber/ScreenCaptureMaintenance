// src/server/services/stepService.js
const fs   = require('fs').promises;
const path = require('path');
const { randomUUID } = require('crypto');
const { readJson, writeJson } = require('./fileService');

function _stepsDir(dataDir, parcoursId, ver) {
  return path.join(dataDir, 'parcours', parcoursId, 'versions', ver, 'steps');
}

function _verPath(dataDir, parcoursId, ver) {
  return path.join(dataDir, 'parcours', parcoursId, 'versions', ver, 'version.json');
}

function _stepJsonPath(dataDir, parcoursId, ver, stepId) {
  return path.join(_stepsDir(dataDir, parcoursId, ver), `${stepId}.json`);
}

function _stepPngPath(dataDir, parcoursId, ver, stepId) {
  return path.join(_stepsDir(dataDir, parcoursId, ver), `${stepId}.png`);
}

async function addStep(dataDir, parcoursId, ver, { captureId, captureFilename }) {
  const stepId = randomUUID();
  const now    = new Date().toISOString();

  const srcPng  = path.join(dataDir, 'gallery', captureFilename);
  const destPng = _stepPngPath(dataDir, parcoursId, ver, stepId);
  await fs.mkdir(_stepsDir(dataDir, parcoursId, ver), { recursive: true });
  await fs.copyFile(srcPng, destPng);

  const step = {
    id: stepId, title: '', instruction: '', sourceCaptureId: captureId,
    scoring:  { enabled: false, points: 1 },
    feedback: { enabled: false, correct: '', incorrect: '' },
    hotspots: [], annotations: [], fabricJson: null,
    createdAt: now, updatedAt: now,
  };
  await writeJson(_stepJsonPath(dataDir, parcoursId, ver, stepId), step);

  const version = await readJson(_verPath(dataDir, parcoursId, ver));
  version.stepOrder.push(stepId);
  await writeJson(_verPath(dataDir, parcoursId, ver), version);
  return step;
}

async function listSteps(dataDir, parcoursId, ver) {
  const version = await readJson(_verPath(dataDir, parcoursId, ver));
  const steps = await Promise.all(
    version.stepOrder.map(id => readJson(_stepJsonPath(dataDir, parcoursId, ver, id)).catch(() => null))
  );
  return steps.filter(Boolean);
}

async function getStep(dataDir, parcoursId, ver, stepId) {
  return readJson(_stepJsonPath(dataDir, parcoursId, ver, stepId));
}

async function updateStep(dataDir, parcoursId, ver, stepId, data) {
  const step = await readJson(_stepJsonPath(dataDir, parcoursId, ver, stepId));
  Object.assign(step, data, { updatedAt: new Date().toISOString() });
  await writeJson(_stepJsonPath(dataDir, parcoursId, ver, stepId), step);
  return step;
}

async function removeStep(dataDir, parcoursId, ver, stepId) {
  await fs.unlink(_stepPngPath(dataDir, parcoursId, ver, stepId)).catch(() => {});
  await fs.unlink(_stepJsonPath(dataDir, parcoursId, ver, stepId)).catch(() => {});
  const version = await readJson(_verPath(dataDir, parcoursId, ver));
  version.stepOrder = version.stepOrder.filter(id => id !== stepId);
  await writeJson(_verPath(dataDir, parcoursId, ver), version);
}

async function reorderSteps(dataDir, parcoursId, ver, orderedIds) {
  const version = await readJson(_verPath(dataDir, parcoursId, ver));
  version.stepOrder = orderedIds;
  await writeJson(_verPath(dataDir, parcoursId, ver), version);
}

async function replaceScreenshot(dataDir, parcoursId, ver, stepId, { captureId, captureFilename }) {
  const srcPng  = path.join(dataDir, 'gallery', captureFilename);
  const destPng = _stepPngPath(dataDir, parcoursId, ver, stepId);
  await fs.copyFile(srcPng, destPng);
  return updateStep(dataDir, parcoursId, ver, stepId, { sourceCaptureId: captureId, fabricJson: null });
}

module.exports = { addStep, listSteps, getStep, updateStep, removeStep, reorderSteps, replaceScreenshot };
