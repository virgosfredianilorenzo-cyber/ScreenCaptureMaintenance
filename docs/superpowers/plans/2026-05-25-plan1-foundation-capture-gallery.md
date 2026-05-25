# Plan 1 — Foundation + Capture + Gallery

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mettre en place le serveur Node/Express, le service de capture d'écran desktop cross-platform, la galerie de captures brutes, et l'interface auteur minimale (toolbar + galerie).

**Architecture:** Serveur Express avec routes REST découplées de leurs services. Les services manipulent uniquement le filesystem local (JSON + PNG). Le client est du vanilla JS sans bundler — les scripts sont chargés séparément dans `index.html`.

**Tech Stack:** Node.js, Express, `screenshot-desktop`, `uuid`, `archiver`, Jest, Supertest

---

## Fichiers créés dans ce plan

```
package.json
config.example.json
.gitignore                         (mise à jour)
src/
  server/
    index.js                       ← bootstrap Express
    config.js                      ← charge config.json
    middleware/
      errorHandler.js
    services/
      fileService.js               ← read/write JSON + PNG
      captureService.js            ← screenshot-desktop + index galerie
    routes/
      capture.js                   ← POST /api/capture/single|start|stop, GET /api/capture/status
      gallery.js                   ← GET /api/gallery, DELETE /api/gallery/:id
  client/
    index.html
    js/
      api.js                       ← fetch helpers
      toolbar.js                   ← boutons Capturer / Stop
      gallery.js                   ← affichage thumbnails
    css/
      main.css
tests/
  services/
    fileService.test.js
    captureService.test.js
  routes/
    capture.test.js
    gallery.test.js
```

---

## Task 1 — Project scaffold

**Files:**
- Create: `package.json`
- Create: `config.example.json`
- Modify: `.gitignore`

- [ ] **Step 1 : Initialiser le projet Node**

```bash
cd /home/ljc/Documents/GitHub/ScreenCaptureMaintenance
npm init -y
```

- [ ] **Step 2 : Installer les dépendances de production**

```bash
npm install express screenshot-desktop uuid archiver
```

- [ ] **Step 3 : Installer les dépendances de développement**

```bash
npm install --save-dev jest supertest
```

- [ ] **Step 4 : Configurer Jest dans package.json**

Remplacer le champ `"scripts"` par :
```json
"scripts": {
  "start": "node src/server/index.js",
  "test": "jest --testPathPattern=tests/ --forceExit"
}
```

Ajouter après `"scripts"` :
```json
"jest": {
  "testEnvironment": "node"
}
```

- [ ] **Step 5 : Créer `config.example.json`**

```json
{
  "port": 3000,
  "dataDir": "./data",
  "capture": {
    "intervalMs": 2000
  },
  "ai": {
    "enabled": false,
    "apiKey": "",
    "model": "claude-sonnet-4-6",
    "maxAttemptsPerStep": 3
  },
  "export": {
    "defaultPassingScore": 70
  }
}
```

- [ ] **Step 6 : Copier en `config.json` local (non versionné)**

```bash
cp config.example.json config.json
```

- [ ] **Step 7 : Mettre à jour `.gitignore`**

Ajouter ces lignes :
```
config.json
data/
node_modules/
```

- [ ] **Step 8 : Créer les répertoires sources**

```bash
mkdir -p src/server/middleware src/server/services src/server/routes
mkdir -p src/client/js src/client/css
mkdir -p tests/services tests/routes
```

- [ ] **Step 9 : Commit**

```bash
git add package.json package-lock.json config.example.json .gitignore
git commit -m "feat: project scaffold with Node/Express dependencies"
```

---

## Task 2 — fileService

**Files:**
- Create: `src/server/services/fileService.js`
- Create: `tests/services/fileService.test.js`

- [ ] **Step 1 : Écrire les tests**

```js
// tests/services/fileService.test.js
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

let tmpDir;
let fileService;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scm-test-'));
  jest.resetModules();
  fileService = require('../../src/server/services/fileService');
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

test('writeJson crée le fichier et les répertoires parents', async () => {
  const filePath = path.join(tmpDir, 'sub', 'data.json');
  await fileService.writeJson(filePath, { key: 'value' });
  const content = await fs.readFile(filePath, 'utf-8');
  expect(JSON.parse(content)).toEqual({ key: 'value' });
});

test('readJson lit un fichier JSON existant', async () => {
  const filePath = path.join(tmpDir, 'data.json');
  await fs.writeFile(filePath, JSON.stringify({ hello: 'world' }));
  const result = await fileService.readJson(filePath);
  expect(result).toEqual({ hello: 'world' });
});

test('readJson lève une erreur si le fichier est absent', async () => {
  await expect(fileService.readJson(path.join(tmpDir, 'absent.json'))).rejects.toThrow();
});

test('savePng sauvegarde un buffer binaire', async () => {
  const filePath = path.join(tmpDir, 'img', 'test.png');
  const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  await fileService.savePng(filePath, buffer);
  const saved = await fs.readFile(filePath);
  expect(saved).toEqual(buffer);
});

test('listFiles retourne les fichiers avec l\'extension donnée', async () => {
  await fs.writeFile(path.join(tmpDir, 'a.png'), '');
  await fs.writeFile(path.join(tmpDir, 'b.png'), '');
  await fs.writeFile(path.join(tmpDir, 'c.json'), '');
  const result = await fileService.listFiles(tmpDir, '.png');
  expect(result.sort()).toEqual(['a.png', 'b.png']);
});

test('listFiles retourne [] si le répertoire est absent', async () => {
  const result = await fileService.listFiles(path.join(tmpDir, 'absent'), '.png');
  expect(result).toEqual([]);
});

test('deleteFile supprime un fichier existant', async () => {
  const filePath = path.join(tmpDir, 'to-delete.json');
  await fs.writeFile(filePath, '{}');
  await fileService.deleteFile(filePath);
  await expect(fs.access(filePath)).rejects.toThrow();
});
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
npm test -- tests/services/fileService.test.js
```
Attendu : FAIL — `Cannot find module '../../src/server/services/fileService'`

- [ ] **Step 3 : Implémenter `fileService.js`**

```js
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
```

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
npm test -- tests/services/fileService.test.js
```
Attendu : PASS — 7 tests passants

- [ ] **Step 5 : Commit**

```bash
git add src/server/services/fileService.js tests/services/fileService.test.js
git commit -m "feat: add fileService with JSON and PNG helpers"
```

---

## Task 3 — config.js

**Files:**
- Create: `src/server/config.js`

- [ ] **Step 1 : Créer `src/server/config.js`**

```js
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
```

- [ ] **Step 2 : Commit**

```bash
git add src/server/config.js
git commit -m "feat: add config loader (config.json with fallback to example)"
```

---

## Task 4 — captureService

**Files:**
- Create: `src/server/services/captureService.js`
- Create: `tests/services/captureService.test.js`

- [ ] **Step 1 : Écrire les tests**

```js
// tests/services/captureService.test.js
const path = require('path');
const os = require('os');
const fs = require('fs').promises;

jest.mock('screenshot-desktop', () => jest.fn().mockResolvedValue(Buffer.from([0x89, 0x50])));
jest.mock('uuid', () => ({ v4: () => 'test-uuid-1234' }));

let tmpDir;
let captureService;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scm-cap-'));
  jest.resetModules();
  jest.mock('screenshot-desktop', () => jest.fn().mockResolvedValue(Buffer.from([0x89, 0x50])));
  jest.mock('uuid', () => ({ v4: () => 'test-uuid-1234' }));
  captureService = require('../../src/server/services/captureService');
});

afterEach(async () => {
  captureService.stopAutoCapture();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

test('captureOne sauvegarde le PNG et retourne une entrée galerie', async () => {
  const entry = await captureService.captureOne(tmpDir);
  expect(entry.id).toBe('test-uuid-1234');
  expect(entry.filename).toBe('test-uuid-1234.png');
  expect(entry.createdAt).toBeDefined();

  const imgPath = path.join(tmpDir, 'gallery', 'test-uuid-1234.png');
  const buf = await fs.readFile(imgPath);
  expect(buf).toEqual(Buffer.from([0x89, 0x50]));
});

test('captureOne met à jour index.json', async () => {
  await captureService.captureOne(tmpDir);
  const indexPath = path.join(tmpDir, 'gallery', 'index.json');
  const index = JSON.parse(await fs.readFile(indexPath, 'utf-8'));
  expect(index.captures).toHaveLength(1);
  expect(index.captures[0].id).toBe('test-uuid-1234');
});

test('isCapturing retourne false par défaut', () => {
  expect(captureService.isCapturing()).toBe(false);
});

test('startAutoCapture / stopAutoCapture change isCapturing', () => {
  captureService.startAutoCapture(tmpDir, 60000, () => {});
  expect(captureService.isCapturing()).toBe(true);
  captureService.stopAutoCapture();
  expect(captureService.isCapturing()).toBe(false);
});
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
npm test -- tests/services/captureService.test.js
```
Attendu : FAIL — `Cannot find module '../../src/server/services/captureService'`

- [ ] **Step 3 : Implémenter `captureService.js`**

```js
// src/server/services/captureService.js
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
```

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
npm test -- tests/services/captureService.test.js
```
Attendu : PASS — 4 tests passants

- [ ] **Step 5 : Commit**

```bash
git add src/server/services/captureService.js tests/services/captureService.test.js
git commit -m "feat: add captureService with screenshot-desktop and gallery index"
```

---

## Task 5 — errorHandler + serveur Express

**Files:**
- Create: `src/server/middleware/errorHandler.js`
- Create: `src/server/index.js`

- [ ] **Step 1 : Créer `errorHandler.js`**

```js
// src/server/middleware/errorHandler.js
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
}

module.exports = errorHandler;
```

- [ ] **Step 2 : Créer `src/server/index.js`**

```js
// src/server/index.js
const express = require('express');
const path = require('path');
const config = require('./config');
const captureRoutes = require('./routes/capture');
const galleryRoutes = require('./routes/gallery');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));
app.use('/data/gallery', express.static(path.join(process.cwd(), config.dataDir, 'gallery')));

app.use('/api/capture', captureRoutes);
app.use('/api/gallery', galleryRoutes);
app.use(errorHandler);

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`ScreenCaptureMaintenance running on http://localhost:${config.port}`);
  });
}

module.exports = app;
```

- [ ] **Step 3 : Commit**

```bash
git add src/server/middleware/errorHandler.js src/server/index.js
git commit -m "feat: add Express server with static serving and error handler"
```

---

## Task 6 — Routes /api/capture

**Files:**
- Create: `src/server/routes/capture.js`
- Create: `tests/routes/capture.test.js`

- [ ] **Step 1 : Écrire les tests**

```js
// tests/routes/capture.test.js
const request = require('supertest');

jest.mock('../src/server/services/captureService', () => ({
  captureOne: jest.fn().mockResolvedValue({ id: 'abc', filename: 'abc.png', createdAt: '2026-01-01' }),
  startAutoCapture: jest.fn(),
  stopAutoCapture: jest.fn(),
  isCapturing: jest.fn().mockReturnValue(false),
}));
jest.mock('../src/server/config', () => ({
  dataDir: '/tmp/scm-test-data',
  capture: { intervalMs: 2000 },
}));

const app = require('../src/server/index');

test('POST /api/capture/single retourne une entrée galerie', async () => {
  const res = await request(app).post('/api/capture/single');
  expect(res.status).toBe(200);
  expect(res.body.id).toBe('abc');
});

test('POST /api/capture/start démarre la capture', async () => {
  const captureService = require('../src/server/services/captureService');
  captureService.isCapturing.mockReturnValue(false);
  const res = await request(app).post('/api/capture/start');
  expect(res.status).toBe(200);
  expect(res.body.capturing).toBe(true);
  expect(captureService.startAutoCapture).toHaveBeenCalled();
});

test('POST /api/capture/stop arrête la capture', async () => {
  const res = await request(app).post('/api/capture/stop');
  expect(res.status).toBe(200);
  expect(res.body.capturing).toBe(false);
});

test('GET /api/capture/status retourne le statut courant', async () => {
  const captureService = require('../src/server/services/captureService');
  captureService.isCapturing.mockReturnValue(true);
  const res = await request(app).get('/api/capture/status');
  expect(res.status).toBe(200);
  expect(res.body.capturing).toBe(true);
});
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
npm test -- tests/routes/capture.test.js
```
Attendu : FAIL — routes non définies

- [ ] **Step 3 : Implémenter `routes/capture.js`**

```js
// src/server/routes/capture.js
const express = require('express');
const router = express.Router();
const captureService = require('../services/captureService');
const config = require('../config');

router.post('/single', async (req, res, next) => {
  try {
    const entry = await captureService.captureOne(config.dataDir);
    res.json(entry);
  } catch (err) {
    next(err);
  }
});

router.post('/start', (req, res) => {
  if (!captureService.isCapturing()) {
    captureService.startAutoCapture(config.dataDir, config.capture.intervalMs, null);
  }
  res.json({ capturing: true });
});

router.post('/stop', (req, res) => {
  captureService.stopAutoCapture();
  res.json({ capturing: false });
});

router.get('/status', (req, res) => {
  res.json({ capturing: captureService.isCapturing() });
});

module.exports = router;
```

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
npm test -- tests/routes/capture.test.js
```
Attendu : PASS — 4 tests passants

- [ ] **Step 5 : Commit**

```bash
git add src/server/routes/capture.js tests/routes/capture.test.js
git commit -m "feat: add /api/capture routes (single, start, stop, status)"
```

---

## Task 7 — Routes /api/gallery

**Files:**
- Create: `src/server/routes/gallery.js`
- Create: `tests/routes/gallery.test.js`

- [ ] **Step 1 : Écrire les tests**

```js
// tests/routes/gallery.test.js
const request = require('supertest');

const mockIndex = {
  captures: [
    { id: 'id-1', filename: 'id-1.png', createdAt: '2026-01-01' },
    { id: 'id-2', filename: 'id-2.png', createdAt: '2026-01-02' },
  ],
};

jest.mock('../src/server/services/fileService', () => ({
  readJson: jest.fn().mockResolvedValue(JSON.parse(JSON.stringify(mockIndex))),
  writeJson: jest.fn().mockResolvedValue(undefined),
  deleteFile: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../src/server/services/captureService', () => ({
  captureOne: jest.fn(),
  startAutoCapture: jest.fn(),
  stopAutoCapture: jest.fn(),
  isCapturing: jest.fn().mockReturnValue(false),
}));
jest.mock('../src/server/config', () => ({
  dataDir: '/tmp/scm-test-data',
  capture: { intervalMs: 2000 },
}));

const app = require('../src/server/index');

beforeEach(() => {
  const fileService = require('../src/server/services/fileService');
  fileService.readJson.mockResolvedValue(JSON.parse(JSON.stringify(mockIndex)));
});

test('GET /api/gallery retourne la liste des captures', async () => {
  const res = await request(app).get('/api/gallery');
  expect(res.status).toBe(200);
  expect(res.body.captures).toHaveLength(2);
  expect(res.body.captures[0].id).toBe('id-1');
});

test('GET /api/gallery retourne une galerie vide si index absent', async () => {
  const fileService = require('../src/server/services/fileService');
  fileService.readJson.mockRejectedValueOnce(new Error('ENOENT'));
  const res = await request(app).get('/api/gallery');
  expect(res.status).toBe(200);
  expect(res.body.captures).toEqual([]);
});

test('DELETE /api/gallery/:id supprime la capture et met à jour index', async () => {
  const res = await request(app).delete('/api/gallery/id-1');
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
  const fileService = require('../src/server/services/fileService');
  expect(fileService.deleteFile).toHaveBeenCalled();
  expect(fileService.writeJson).toHaveBeenCalled();
});

test('DELETE /api/gallery/:id retourne 404 si id inconnu', async () => {
  const res = await request(app).delete('/api/gallery/unknown-id');
  expect(res.status).toBe(404);
});
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
npm test -- tests/routes/gallery.test.js
```
Attendu : FAIL — routes non définies

- [ ] **Step 3 : Implémenter `routes/gallery.js`**

```js
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
```

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
npm test -- tests/routes/gallery.test.js
```
Attendu : PASS — 4 tests passants

- [ ] **Step 5 : Commit**

```bash
git add src/server/routes/gallery.js tests/routes/gallery.test.js
git commit -m "feat: add /api/gallery routes (list, delete)"
```

---

## Task 8 — Interface auteur (UI shell)

**Files:**
- Create: `src/client/index.html`
- Create: `src/client/js/api.js`
- Create: `src/client/js/toolbar.js`
- Create: `src/client/js/gallery.js`
- Create: `src/client/css/main.css`

- [ ] **Step 1 : Créer `src/client/js/api.js`**

```js
// src/client/js/api.js
const API = {
  async captureOne() {
    const res = await fetch('/api/capture/single', { method: 'POST' });
    return res.json();
  },
  async startCapture() {
    const res = await fetch('/api/capture/start', { method: 'POST' });
    return res.json();
  },
  async stopCapture() {
    const res = await fetch('/api/capture/stop', { method: 'POST' });
    return res.json();
  },
  async getCaptureStatus() {
    const res = await fetch('/api/capture/status');
    return res.json();
  },
  async getGallery() {
    const res = await fetch('/api/gallery');
    return res.json();
  },
  async deleteCapture(id) {
    const res = await fetch(`/api/gallery/${id}`, { method: 'DELETE' });
    return res.json();
  },
};
```

- [ ] **Step 2 : Créer `src/client/js/gallery.js`**

```js
// src/client/js/gallery.js
const Gallery = {
  container: null,

  init(container) {
    this.container = container;
    this.refresh();
  },

  async refresh() {
    const { captures } = await API.getGallery();
    this.container.innerHTML = '';
    captures.forEach(entry => {
      const item = document.createElement('div');
      item.className = 'gallery-item';
      item.dataset.id = entry.id;
      item.innerHTML = `
        <img src="/data/gallery/${entry.filename}" alt="${entry.id}" />
        <span class="gallery-date">${new Date(entry.createdAt).toLocaleTimeString()}</span>
        <button class="btn-delete" data-id="${entry.id}">✕</button>
      `;
      item.querySelector('.btn-delete').addEventListener('click', async (e) => {
        e.stopPropagation();
        await API.deleteCapture(entry.id);
        await this.refresh();
      });
      this.container.appendChild(item);
    });
  },
};
```

- [ ] **Step 3 : Créer `src/client/js/toolbar.js`**

```js
// src/client/js/toolbar.js
const Toolbar = {
  init() {
    this.btnCapture = document.getElementById('btn-capture');
    this.btnStop = document.getElementById('btn-stop');
    this.statusEl = document.getElementById('capture-status');
    this._bind();
    this._syncStatus();
  },

  _bind() {
    this.btnCapture.addEventListener('click', () => this._start());
    this.btnStop.addEventListener('click', () => this._stop());
  },

  async _start() {
    await API.startCapture();
    this.btnCapture.disabled = true;
    this.btnStop.disabled = false;
    this.statusEl.textContent = '● Capture en cours…';
    this._pollGallery();
  },

  async _stop() {
    await API.stopCapture();
    this.btnCapture.disabled = false;
    this.btnStop.disabled = true;
    this.statusEl.textContent = '';
    clearInterval(this._pollInterval);
    await Gallery.refresh();
  },

  _pollGallery() {
    this._pollInterval = setInterval(() => Gallery.refresh(), 2500);
  },

  async _syncStatus() {
    const { capturing } = await API.getCaptureStatus();
    if (capturing) {
      this.btnCapture.disabled = true;
      this.btnStop.disabled = false;
      this.statusEl.textContent = '● Capture en cours…';
      this._pollGallery();
    }
  },
};
```

- [ ] **Step 4 : Créer `src/client/css/main.css`**

```css
/* src/client/css/main.css */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: system-ui, sans-serif;
  background: #f0f2f5;
  color: #1a1a2e;
}

#toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: #1a1a2e;
  color: white;
}

#toolbar h1 { font-size: 1rem; margin-right: auto; }

button {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
}

button:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-primary { background: #4ade80; color: #1a1a2e; }
.btn-danger  { background: #f87171; color: white; }
.btn-delete  { background: #e5e7eb; color: #374151; padding: 4px 8px; font-size: 0.75rem; }

#capture-status { font-size: 0.85rem; color: #86efac; }

#gallery-container {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 20px;
}

.gallery-item {
  position: relative;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0,0,0,.12);
  width: 180px;
}

.gallery-item img { width: 100%; display: block; }

.gallery-date {
  display: block;
  font-size: 0.7rem;
  color: #6b7280;
  padding: 4px 8px;
}

.gallery-item .btn-delete {
  position: absolute;
  top: 4px;
  right: 4px;
}
```

- [ ] **Step 5 : Créer `src/client/index.html`**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ScreenCaptureMaintenance — Auteur</title>
  <link rel="stylesheet" href="css/main.css" />
</head>
<body>

  <div id="toolbar">
    <h1>ScreenCaptureMaintenance</h1>
    <button id="btn-capture" class="btn-primary">● Capturer</button>
    <button id="btn-stop" class="btn-danger" disabled>■ Stop</button>
    <span id="capture-status"></span>
  </div>

  <div id="gallery-container"></div>

  <script src="js/api.js"></script>
  <script src="js/gallery.js"></script>
  <script src="js/toolbar.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      Gallery.init(document.getElementById('gallery-container'));
      Toolbar.init();
    });
  </script>

</body>
</html>
```

- [ ] **Step 6 : Démarrer le serveur et vérifier manuellement**

```bash
npm start
```
Attendu : `ScreenCaptureMaintenance running on http://localhost:3000`

Ouvrir `http://localhost:3000` dans le navigateur :
- Le bouton `● Capturer` est actif, `■ Stop` est grisé
- Clic sur `● Capturer` → le bouton se grise, `■ Stop` s'active, le statut affiche `● Capture en cours…`
- Des thumbnails apparaissent dans la galerie toutes les ~2,5 secondes
- Clic sur `■ Stop` → la capture s'arrête, les thumbnails restent visibles
- Clic sur `✕` d'un thumbnail → il disparaît de la galerie

Arrêter le serveur : `Ctrl+C`

- [ ] **Step 7 : Lancer tous les tests**

```bash
npm test
```
Attendu : PASS — 19 tests passants (7 fileService + 4 captureService + 4 capture routes + 4 gallery routes)

- [ ] **Step 8 : Commit**

```bash
git add src/client/
git commit -m "feat: add authoring UI shell (toolbar, gallery, capture controls)"
```

---

## Task 9 — Push final

- [ ] **Step 1 : Vérifier l'état du repo**

```bash
git status
git log --oneline
```
Attendu : working tree propre, 7 commits depuis le début du plan

- [ ] **Step 2 : Push**

```bash
git push
```

---

## Récapitulatif des plans suivants

| Plan | Départ suggéré |
|---|---|
| **Plan 2** — Module Auteur (parcours, steps, éditeur canvas) | Après validation Plan 1 |
| **Plan 3** — Module Player (démo / simulation / évaluation) | Après Plan 2 |
| **Plan 4** — Export SCORM 1.2 / xAPI | Après Plan 3 |
| **Plan 5** — IA optionnelle (Claude API) | Après Plan 4 (ou en parallèle de Plan 3) |

> **Audit cybersécurité** : à planifier avec le skill `security-review` après la complétion du Plan 2 (serveur complet avec routes CRUD exposées).
