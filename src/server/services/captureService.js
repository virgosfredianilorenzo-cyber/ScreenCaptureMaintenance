const screenshot = require('screenshot-desktop');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { savePng, readJson, writeJson } = require('./fileService');

let autoInterval = null;

async function captureOne(dataDir) {
  const id = uuidv4();
  const imgBuffer = await screenshot({ format: 'png' });
  const imgPath = path.join(dataDir, 'gallery', `${id}.png`);
  await savePng(imgPath, imgBuffer);

  const indexPath = path.join(dataDir, 'gallery', 'index.json');
  let index;
  try {
    index = await readJson(indexPath);
  } catch {
    index = { captures: [] };
  }
  const entry = { id, filename: `${id}.png`, createdAt: new Date().toISOString() };
  index.captures.unshift(entry);
  await writeJson(indexPath, index);
  return entry;
}

function startAutoCapture(dataDir, intervalMs, onCapture) {
  if (autoInterval) return;
  autoInterval = setInterval(async () => {
    const entry = await captureOne(dataDir);
    if (onCapture) onCapture(entry);
  }, intervalMs);
}

function stopAutoCapture() {
  if (autoInterval) {
    clearInterval(autoInterval);
    autoInterval = null;
  }
}

function isCapturing() {
  return autoInterval !== null;
}

module.exports = { captureOne, startAutoCapture, stopAutoCapture, isCapturing };
