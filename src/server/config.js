// src/server/config.js
const fs = require('fs');
const path = require('path');

const configPath = path.resolve(process.cwd(), 'config.json');

let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
} catch {
  config = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'config.example.json'), 'utf-8')
  );
}

module.exports = config;
