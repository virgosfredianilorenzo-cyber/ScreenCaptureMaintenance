const screenshot = require('screenshot-desktop');
const { execFile } = require('child_process');
const path = require('path');
const { randomUUID } = require('crypto');
const { savePng, readJson, writeJson } = require('./fileService');

let autoInterval = null;

// Linux fallback via Python PIL when scrot/ImageMagick are unavailable
function captureLinuxFallback() {
  const script = path.join(__dirname, '../lib/capture-linux.py');
  return new Promise((resolve, reject) => {
    const chunks = [];
    const proc = execFile('python3', [script], { encoding: 'buffer', maxBuffer: 50 * 1024 * 1024 });
    proc.stdout.on('data', chunk => chunks.push(chunk));
    proc.on('close', code => {
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new Error(`Python capture exited with code ${code}`));
    });
    proc.on('error', reject);
  });
}

async function takeScreenshot() {
  if (process.platform !== 'linux') {
    return screenshot({ format: 'png' });
  }
  try {
    return await screenshot({ format: 'png', linuxLibrary: 'scrot' });
  } catch {
    return captureLinuxFallback();
  }
}

async function captureOne(dataDir) {
  const id = randomUUID();
  const imgBuffer = await takeScreenshot();
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
    try {
      const entry = await captureOne(dataDir);
      if (onCapture) onCapture(entry);
    } catch (err) {
      console.error('[captureService] auto-capture error:', err.message);
    }
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
