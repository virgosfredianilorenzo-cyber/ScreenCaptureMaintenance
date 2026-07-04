// src/server/services/parcoursService.js
const fs   = require('fs').promises;
const path = require('path');
const { randomUUID } = require('crypto');
const { readJson, writeJson } = require('./fileService');

function _manifestPath(dataDir, id) {
  return path.join(dataDir, 'parcours', id, 'manifest.json');
}

function _versionPath(dataDir, id, ver) {
  return path.join(dataDir, 'parcours', id, 'versions', ver, 'version.json');
}

async function createParcours(dataDir, { title }) {
  const id  = randomUUID();
  const now = new Date().toISOString();
  const manifest = {
    id, title, tags: [], currentVersion: 'v1',
    versions: ['v1'], scoring: { enabled: true, defaultPointsPerStep: 1, allowPartialCredit: true },
    feedback: { enabled: true, showOnCorrect: true, showOnIncorrect: true },
    createdAt: now, updatedAt: now,
  };
  await writeJson(_manifestPath(dataDir, id), manifest);

  const version = { version: 'v1', label: 'Version initiale', createdFrom: null,
    createdAt: now, stepOrder: [] };
  await writeJson(_versionPath(dataDir, id, 'v1'), version);
  await fs.mkdir(path.join(dataDir, 'parcours', id, 'versions', 'v1', 'steps'), { recursive: true });
  return manifest;
}

async function listParcours(dataDir) {
  const dir = path.join(dataDir, 'parcours');
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const manifests = await Promise.all(
      entries.filter(e => e.isDirectory())
        .map(e => readJson(path.join(dir, e.name, 'manifest.json')).catch(() => null))
    );
    return manifests.filter(Boolean);
  } catch { return []; }
}

async function getParcours(dataDir, id) {
  return readJson(_manifestPath(dataDir, id));
}

async function updateParcours(dataDir, id, { title, tags }) {
  const manifest = await readJson(_manifestPath(dataDir, id));
  if (title !== undefined) manifest.title = title;
  if (tags  !== undefined) manifest.tags  = tags;
  manifest.updatedAt = new Date().toISOString();
  await writeJson(_manifestPath(dataDir, id), manifest);
  return manifest;
}

async function deleteParcours(dataDir, id) {
  await fs.rm(path.join(dataDir, 'parcours', id), { recursive: true, force: true });
}

async function createVersion(dataDir, id, { label }) {
  const manifest = await readJson(_manifestPath(dataDir, id));
  const fromVer  = manifest.currentVersion;
  const fromData = await readJson(_versionPath(dataDir, id, fromVer));

  const nextNum = manifest.versions.length + 1;
  const newVer  = `v${nextNum}`;
  const now     = new Date().toISOString();

  const version = { version: newVer, label, createdFrom: fromVer, createdAt: now,
    stepOrder: [...fromData.stepOrder] };
  await writeJson(_versionPath(dataDir, id, newVer), version);

  // Copy steps folder from source version
  const srcSteps  = path.join(dataDir, 'parcours', id, 'versions', fromVer, 'steps');
  const destSteps = path.join(dataDir, 'parcours', id, 'versions', newVer, 'steps');
  await fs.mkdir(destSteps, { recursive: true });
  try {
    const files = await fs.readdir(srcSteps);
    await Promise.all(files.map(f => fs.copyFile(path.join(srcSteps, f), path.join(destSteps, f))));
  } catch {}

  manifest.versions.push(newVer);
  manifest.currentVersion = newVer;
  manifest.updatedAt = now;
  await writeJson(_manifestPath(dataDir, id), manifest);
  return version;
}

async function getVersion(dataDir, id, ver) {
  return readJson(_versionPath(dataDir, id, ver));
}

module.exports = { createParcours, listParcours, getParcours, updateParcours,
  deleteParcours, createVersion, getVersion };
