// src/server/services/fileService.js
const fs = require('fs').promises;
const path = require('path');

async function readJson(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

async function savePng(filePath, buffer) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buffer);
}

async function listFiles(dirPath, ext) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter(e => e.isFile() && e.name.endsWith(ext))
      .map(e => e.name);
  } catch {
    return [];
  }
}

async function deleteFile(filePath) {
  await fs.unlink(filePath);
}

module.exports = { readJson, writeJson, savePng, listFiles, deleteFile };
