# Plan 2 — Module Auteur Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire le module auteur : CRUD parcours avec versioning, gestion des étapes, éditeur canvas Fabric.js (hotspots + annotations), formulaire d'étape (instruction/scoring/feedback), drag & drop galerie → timeline.

**Architecture:** Services serveur (parcoursService, stepService) gèrent le filesystem JSON + PNG ; routes Express exposent les endpoints REST. Le client utilise un layout 3 panneaux (galerie | éditeur | timeline) avec Fabric.js pour le canvas et HTML5 Drag & Drop pour la composition.

**Tech Stack:** Node.js 18+, Express, Jest, Supertest ; Fabric.js 5.3.1 CDN ; Vanilla JS + HTML5 Drag & Drop

## Global Constraints

- Node.js 18+
- Pas de bundler — vanilla JS chargé via `<script>` dans index.html
- Fabric.js CDN : `https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js`
- TDD : écrire le test en échec avant l'implémentation
- Chaque tâche se termine par un commit
- Données stockées dans `config.dataDir` (JSON + PNG) via fileService de Plan 1
- Screenshots des étapes servis via route statique : `/data/parcours/:id/versions/:ver/steps/:stepId.png`

---

## Fichiers créés/modifiés

```
src/server/services/parcoursService.js   ← CRUD parcours + versioning
src/server/services/stepService.js       ← CRUD étapes, reorder, replace screenshot
src/server/routes/parcours.js            ← REST /api/parcours + /api/parcours/:id/versions
src/server/routes/steps.js              ← REST /api/parcours/:id/versions/:ver/steps
src/server/index.js                      ← (modifié) nouvelles routes + static /data/parcours
tests/services/parcoursService.test.js
tests/services/stepService.test.js
tests/routes/parcours.test.js
tests/routes/steps.test.js
src/client/js/api.js                     ← (modifié) nouveaux endpoints
src/client/js/toolbar.js                 ← (modifié) bouton Nouveau parcours + sélecteur
src/client/js/gallery.js                 ← (modifié) items draggables
src/client/js/timeline.js               ← panneau timeline
src/client/js/editor.js                  ← canvas Fabric.js
src/client/index.html                    ← (modifié) layout 3 panneaux + Fabric.js CDN
src/client/css/main.css                  ← (modifié) layout 3 panneaux
src/client/css/editor.css               ← styles éditeur + timeline
```

---

## Task 1 — parcoursService

**Files:**
- Create: `src/server/services/parcoursService.js`
- Create: `tests/services/parcoursService.test.js`

**Interfaces:**
- Consumes: `fileService.{readJson, writeJson, listFiles}` du Plan 1
- Produces:
  - `createParcours(dataDir, {title}) → manifest`
  - `listParcours(dataDir) → [manifest]`
  - `getParcours(dataDir, id) → manifest`
  - `updateParcours(dataDir, id, {title, tags}) → manifest`
  - `deleteParcours(dataDir, id) → void`
  - `createVersion(dataDir, id, {label}) → version`
  - `getVersion(dataDir, id, ver) → version`

Structure filesystem :
```
data/parcours/{id}/manifest.json
data/parcours/{id}/versions/{ver}/version.json
data/parcours/{id}/versions/{ver}/steps/   ← dossier vide à la création
```

- [ ] **Step 1 : Écrire les tests**

```js
// tests/services/parcoursService.test.js
const fs   = require('fs').promises;
const path = require('path');
const os   = require('os');

let tmpDir, svc;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scm-p2-'));
  jest.resetModules();
  svc = require('../../src/server/services/parcoursService');
});

afterEach(() => fs.rm(tmpDir, { recursive: true, force: true }));

test('createParcours crée manifest + version v1', async () => {
  const m = await svc.createParcours(tmpDir, { title: 'Mon parcours' });
  expect(m.id).toBeDefined();
  expect(m.title).toBe('Mon parcours');
  expect(m.currentVersion).toBe('v1');
  expect(m.versions).toEqual(['v1']);

  const saved = JSON.parse(await fs.readFile(
    path.join(tmpDir, 'parcours', m.id, 'manifest.json'), 'utf-8'));
  expect(saved.title).toBe('Mon parcours');

  const ver = JSON.parse(await fs.readFile(
    path.join(tmpDir, 'parcours', m.id, 'versions', 'v1', 'version.json'), 'utf-8'));
  expect(ver.version).toBe('v1');
  expect(ver.stepOrder).toEqual([]);
});

test('listParcours retourne tous les parcours', async () => {
  await svc.createParcours(tmpDir, { title: 'A' });
  await svc.createParcours(tmpDir, { title: 'B' });
  const list = await svc.listParcours(tmpDir);
  expect(list).toHaveLength(2);
  expect(list.map(p => p.title).sort()).toEqual(['A', 'B']);
});

test('listParcours retourne [] si aucun parcours', async () => {
  const list = await svc.listParcours(tmpDir);
  expect(list).toEqual([]);
});

test('updateParcours met à jour titre et tags', async () => {
  const m = await svc.createParcours(tmpDir, { title: 'Old' });
  const updated = await svc.updateParcours(tmpDir, m.id, { title: 'New', tags: ['jazz'] });
  expect(updated.title).toBe('New');
  expect(updated.tags).toEqual(['jazz']);
  expect(updated.updatedAt).toBeDefined();
});

test('deleteParcours supprime le répertoire', async () => {
  const m = await svc.createParcours(tmpDir, { title: 'Del' });
  await svc.deleteParcours(tmpDir, m.id);
  await expect(fs.access(path.join(tmpDir, 'parcours', m.id))).rejects.toThrow();
});

test('createVersion clone la version courante et met à jour le manifest', async () => {
  const m = await svc.createParcours(tmpDir, { title: 'P' });
  const vPath = path.join(tmpDir, 'parcours', m.id, 'versions', 'v1', 'version.json');
  const v1 = JSON.parse(await fs.readFile(vPath, 'utf-8'));
  v1.stepOrder = ['step-abc'];
  await fs.writeFile(vPath, JSON.stringify(v1));

  const v2 = await svc.createVersion(tmpDir, m.id, { label: 'Refonte' });
  expect(v2.version).toBe('v2');
  expect(v2.stepOrder).toEqual(['step-abc']);
  expect(v2.createdFrom).toBe('v1');

  const manifest = JSON.parse(await fs.readFile(
    path.join(tmpDir, 'parcours', m.id, 'manifest.json'), 'utf-8'));
  expect(manifest.currentVersion).toBe('v2');
  expect(manifest.versions).toContain('v2');
});
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
npm test -- tests/services/parcoursService.test.js
```
Attendu : FAIL — `Cannot find module`

- [ ] **Step 3 : Implémenter parcoursService.js**

```js
// src/server/services/parcoursService.js
const fs   = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { readJson, writeJson } = require('./fileService');

function _manifestPath(dataDir, id) {
  return path.join(dataDir, 'parcours', id, 'manifest.json');
}

function _versionPath(dataDir, id, ver) {
  return path.join(dataDir, 'parcours', id, 'versions', ver, 'version.json');
}

async function createParcours(dataDir, { title }) {
  const id  = uuidv4();
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
```

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
npm test -- tests/services/parcoursService.test.js
```
Attendu : PASS — 7 tests

- [ ] **Step 5 : Commit**

```bash
git add src/server/services/parcoursService.js tests/services/parcoursService.test.js
git commit -m "feat: add parcoursService (CRUD + versioning)"
```

---

## Task 2 — stepService

**Files:**
- Create: `src/server/services/stepService.js`
- Create: `tests/services/stepService.test.js`

**Interfaces:**
- Consumes: `parcoursService.{createParcours}`, `fileService.{readJson, writeJson}`
- Produces:
  - `addStep(dataDir, parcoursId, ver, {captureId, captureFilename}) → step`
  - `listSteps(dataDir, parcoursId, ver) → [step]`
  - `getStep(dataDir, parcoursId, ver, stepId) → step`
  - `updateStep(dataDir, parcoursId, ver, stepId, data) → step`
  - `removeStep(dataDir, parcoursId, ver, stepId) → void`
  - `reorderSteps(dataDir, parcoursId, ver, orderedIds) → void`
  - `replaceScreenshot(dataDir, parcoursId, ver, stepId, {captureId, captureFilename}) → step`

- [ ] **Step 1 : Écrire les tests**

```js
// tests/services/stepService.test.js
const fs   = require('fs').promises;
const path = require('path');
const os   = require('os');

let tmpDir, svc, parcoursId;

async function makeGalleryCapture(tmpDir, id) {
  await fs.mkdir(path.join(tmpDir, 'gallery'), { recursive: true });
  await fs.writeFile(path.join(tmpDir, 'gallery', `${id}.png`), Buffer.from([0x89, 0x50]));
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scm-step-'));
  jest.resetModules();
  const parcoursSvc = require('../../src/server/services/parcoursService');
  svc = require('../../src/server/services/stepService');
  const m = await parcoursSvc.createParcours(tmpDir, { title: 'P' });
  parcoursId = m.id;
});

afterEach(() => fs.rm(tmpDir, { recursive: true, force: true }));

test('addStep copie le PNG et crée le JSON', async () => {
  await makeGalleryCapture(tmpDir, 'cap1');
  const step = await svc.addStep(tmpDir, parcoursId, 'v1',
    { captureId: 'cap1', captureFilename: 'cap1.png' });

  expect(step.id).toBeDefined();
  expect(step.title).toBe('');
  expect(step.instruction).toBe('');
  expect(step.hotspots).toEqual([]);
  expect(step.annotations).toEqual([]);
  expect(step.fabricJson).toBeNull();

  const pngPath = path.join(tmpDir, 'parcours', parcoursId, 'versions', 'v1', 'steps', `${step.id}.png`);
  await expect(fs.access(pngPath)).resolves.toBeUndefined();

  const ver = JSON.parse(await fs.readFile(
    path.join(tmpDir, 'parcours', parcoursId, 'versions', 'v1', 'version.json'), 'utf-8'));
  expect(ver.stepOrder).toContain(step.id);
});

test('listSteps retourne les étapes dans le bon ordre', async () => {
  await makeGalleryCapture(tmpDir, 'c1');
  await makeGalleryCapture(tmpDir, 'c2');
  const s1 = await svc.addStep(tmpDir, parcoursId, 'v1', { captureId: 'c1', captureFilename: 'c1.png' });
  const s2 = await svc.addStep(tmpDir, parcoursId, 'v1', { captureId: 'c2', captureFilename: 'c2.png' });
  const steps = await svc.listSteps(tmpDir, parcoursId, 'v1');
  expect(steps).toHaveLength(2);
  expect(steps[0].id).toBe(s1.id);
  expect(steps[1].id).toBe(s2.id);
});

test('updateStep met à jour les champs', async () => {
  await makeGalleryCapture(tmpDir, 'c1');
  const step = await svc.addStep(tmpDir, parcoursId, 'v1', { captureId: 'c1', captureFilename: 'c1.png' });
  const updated = await svc.updateStep(tmpDir, parcoursId, 'v1', step.id, {
    title: 'Étape 1', instruction: 'Cliquez ici',
    hotspots: [{ id: 'h1', x: 10, y: 20, width: 50, height: 30, isCorrect: true }],
    scoring: { enabled: true, points: 2 },
  });
  expect(updated.title).toBe('Étape 1');
  expect(updated.instruction).toBe('Cliquez ici');
  expect(updated.hotspots).toHaveLength(1);
  expect(updated.scoring.points).toBe(2);
});

test('removeStep supprime JSON + PNG et retire du stepOrder', async () => {
  await makeGalleryCapture(tmpDir, 'c1');
  const step = await svc.addStep(tmpDir, parcoursId, 'v1', { captureId: 'c1', captureFilename: 'c1.png' });
  await svc.removeStep(tmpDir, parcoursId, 'v1', step.id);

  const ver = JSON.parse(await fs.readFile(
    path.join(tmpDir, 'parcours', parcoursId, 'versions', 'v1', 'version.json'), 'utf-8'));
  expect(ver.stepOrder).not.toContain(step.id);

  const pngPath = path.join(tmpDir, 'parcours', parcoursId, 'versions', 'v1', 'steps', `${step.id}.png`);
  await expect(fs.access(pngPath)).rejects.toThrow();
});

test('reorderSteps change le stepOrder', async () => {
  await makeGalleryCapture(tmpDir, 'c1');
  await makeGalleryCapture(tmpDir, 'c2');
  await makeGalleryCapture(tmpDir, 'c3');
  const s1 = await svc.addStep(tmpDir, parcoursId, 'v1', { captureId: 'c1', captureFilename: 'c1.png' });
  const s2 = await svc.addStep(tmpDir, parcoursId, 'v1', { captureId: 'c2', captureFilename: 'c2.png' });
  const s3 = await svc.addStep(tmpDir, parcoursId, 'v1', { captureId: 'c3', captureFilename: 'c3.png' });

  await svc.reorderSteps(tmpDir, parcoursId, 'v1', [s3.id, s1.id, s2.id]);
  const steps = await svc.listSteps(tmpDir, parcoursId, 'v1');
  expect(steps.map(s => s.id)).toEqual([s3.id, s1.id, s2.id]);
});

test('replaceScreenshot remplace le PNG, conserve hotspots', async () => {
  await makeGalleryCapture(tmpDir, 'c1');
  await makeGalleryCapture(tmpDir, 'c2');
  const step = await svc.addStep(tmpDir, parcoursId, 'v1', { captureId: 'c1', captureFilename: 'c1.png' });
  await svc.updateStep(tmpDir, parcoursId, 'v1', step.id, {
    hotspots: [{ id: 'h1', x: 5, y: 5, width: 20, height: 20, isCorrect: true }]
  });
  const replaced = await svc.replaceScreenshot(tmpDir, parcoursId, 'v1', step.id,
    { captureId: 'c2', captureFilename: 'c2.png' });
  expect(replaced.hotspots).toHaveLength(1);
  expect(replaced.sourceCaptureId).toBe('c2');
});
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
npm test -- tests/services/stepService.test.js
```
Attendu : FAIL — `Cannot find module`

- [ ] **Step 3 : Implémenter stepService.js**

```js
// src/server/services/stepService.js
const fs   = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
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
  const stepId = uuidv4();
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

  const ver_ = await readJson(_verPath(dataDir, parcoursId, ver));
  ver_.stepOrder.push(stepId);
  await writeJson(_verPath(dataDir, parcoursId, ver), ver_);
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
```

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
npm test -- tests/services/stepService.test.js
```
Attendu : PASS — 6 tests

- [ ] **Step 5 : Commit**

```bash
git add src/server/services/stepService.js tests/services/stepService.test.js
git commit -m "feat: add stepService (CRUD, reorder, screenshot replacement)"
```

---

## Task 3 — Routes + wiring

**Files:**
- Create: `src/server/routes/parcours.js`
- Create: `src/server/routes/steps.js`
- Create: `tests/routes/parcours.test.js`
- Create: `tests/routes/steps.test.js`
- Modify: `src/server/index.js`

**Interfaces:**
- Consumes: `parcoursService.*`, `stepService.*`
- Produces: endpoints REST (voir ci-dessous)

**Endpoints parcours :**
- `GET /api/parcours` → liste
- `POST /api/parcours` body `{title}` → manifest
- `GET /api/parcours/:id` → manifest
- `PUT /api/parcours/:id` body `{title?, tags?}` → manifest
- `DELETE /api/parcours/:id` → 204
- `POST /api/parcours/:id/versions` body `{label}` → version

**Endpoints steps :**
- `GET /api/parcours/:id/versions/:ver/steps` → `[step]`
- `POST /api/parcours/:id/versions/:ver/steps` body `{captureId, captureFilename}` → step
- `PUT /api/parcours/:id/versions/:ver/steps/order` body `{orderedIds}` → 200
- `GET /api/parcours/:id/versions/:ver/steps/:stepId` → step
- `PUT /api/parcours/:id/versions/:ver/steps/:stepId` body `{...}` → step
- `DELETE /api/parcours/:id/versions/:ver/steps/:stepId` → 204
- `PUT /api/parcours/:id/versions/:ver/steps/:stepId/screenshot` body `{captureId, captureFilename}` → step

- [ ] **Step 1 : Écrire les tests routes parcours**

```js
// tests/routes/parcours.test.js
const request = require('supertest');

jest.mock('../src/server/services/parcoursService', () => ({
  listParcours:   jest.fn().mockResolvedValue([{ id: 'p1', title: 'Test' }]),
  createParcours: jest.fn().mockResolvedValue({ id: 'p1', title: 'New', currentVersion: 'v1' }),
  getParcours:    jest.fn().mockResolvedValue({ id: 'p1', title: 'Test', currentVersion: 'v1' }),
  updateParcours: jest.fn().mockResolvedValue({ id: 'p1', title: 'Updated' }),
  deleteParcours: jest.fn().mockResolvedValue(undefined),
  createVersion:  jest.fn().mockResolvedValue({ version: 'v2', stepOrder: [] }),
}));
jest.mock('../src/server/services/stepService', () => ({
  addStep:           jest.fn(),
  listSteps:         jest.fn().mockResolvedValue([]),
  getStep:           jest.fn(),
  updateStep:        jest.fn(),
  removeStep:        jest.fn(),
  reorderSteps:      jest.fn(),
  replaceScreenshot: jest.fn(),
}));
jest.mock('../src/server/services/captureService', () => ({
  captureOne: jest.fn(), startAutoCapture: jest.fn(),
  stopAutoCapture: jest.fn(), isCapturing: jest.fn().mockReturnValue(false),
}));
jest.mock('../src/server/config', () => ({ dataDir: '/tmp/scm', port: 3000, capture: { intervalMs: 2000 } }));

const app = require('../src/server/index');

test('GET /api/parcours retourne la liste', async () => {
  const res = await request(app).get('/api/parcours');
  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(1);
});

test('POST /api/parcours crée un parcours', async () => {
  const res = await request(app).post('/api/parcours').send({ title: 'New' });
  expect(res.status).toBe(201);
  expect(res.body.id).toBe('p1');
});

test('GET /api/parcours/:id retourne le manifest', async () => {
  const res = await request(app).get('/api/parcours/p1');
  expect(res.status).toBe(200);
  expect(res.body.currentVersion).toBe('v1');
});

test('PUT /api/parcours/:id met à jour', async () => {
  const res = await request(app).put('/api/parcours/p1').send({ title: 'Updated' });
  expect(res.status).toBe(200);
  expect(res.body.title).toBe('Updated');
});

test('DELETE /api/parcours/:id retourne 204', async () => {
  const res = await request(app).delete('/api/parcours/p1');
  expect(res.status).toBe(204);
});

test('POST /api/parcours/:id/versions crée une version', async () => {
  const res = await request(app).post('/api/parcours/p1/versions').send({ label: 'v2' });
  expect(res.status).toBe(201);
  expect(res.body.version).toBe('v2');
});
```

- [ ] **Step 2 : Écrire les tests routes steps**

```js
// tests/routes/steps.test.js
const request = require('supertest');

jest.mock('../src/server/services/parcoursService', () => ({
  listParcours: jest.fn(), createParcours: jest.fn(), getParcours: jest.fn(),
  updateParcours: jest.fn(), deleteParcours: jest.fn(), createVersion: jest.fn(),
}));
jest.mock('../src/server/services/stepService', () => ({
  addStep:           jest.fn().mockResolvedValue({ id: 's1', title: '' }),
  listSteps:         jest.fn().mockResolvedValue([{ id: 's1' }, { id: 's2' }]),
  getStep:           jest.fn().mockResolvedValue({ id: 's1', instruction: '' }),
  updateStep:        jest.fn().mockResolvedValue({ id: 's1', instruction: 'Cliquez' }),
  removeStep:        jest.fn().mockResolvedValue(undefined),
  reorderSteps:      jest.fn().mockResolvedValue(undefined),
  replaceScreenshot: jest.fn().mockResolvedValue({ id: 's1', sourceCaptureId: 'c2' }),
}));
jest.mock('../src/server/services/captureService', () => ({
  captureOne: jest.fn(), startAutoCapture: jest.fn(),
  stopAutoCapture: jest.fn(), isCapturing: jest.fn().mockReturnValue(false),
}));
jest.mock('../src/server/config', () => ({ dataDir: '/tmp/scm', port: 3000, capture: { intervalMs: 2000 } }));

const app = require('../src/server/index');
const BASE = '/api/parcours/p1/versions/v1/steps';

test('GET steps retourne la liste', async () => {
  const res = await request(app).get(BASE);
  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(2);
});

test('POST steps ajoute une étape', async () => {
  const res = await request(app).post(BASE).send({ captureId: 'c1', captureFilename: 'c1.png' });
  expect(res.status).toBe(201);
  expect(res.body.id).toBe('s1');
});

test('PUT steps/order réordonne', async () => {
  const res = await request(app).put(`${BASE}/order`).send({ orderedIds: ['s2', 's1'] });
  expect(res.status).toBe(200);
});

test('GET steps/:stepId retourne une étape', async () => {
  const res = await request(app).get(`${BASE}/s1`);
  expect(res.status).toBe(200);
  expect(res.body.id).toBe('s1');
});

test('PUT steps/:stepId met à jour', async () => {
  const res = await request(app).put(`${BASE}/s1`).send({ instruction: 'Cliquez' });
  expect(res.status).toBe(200);
  expect(res.body.instruction).toBe('Cliquez');
});

test('DELETE steps/:stepId retourne 204', async () => {
  const res = await request(app).delete(`${BASE}/s1`);
  expect(res.status).toBe(204);
});

test('PUT steps/:stepId/screenshot remplace le screenshot', async () => {
  const res = await request(app)
    .put(`${BASE}/s1/screenshot`)
    .send({ captureId: 'c2', captureFilename: 'c2.png' });
  expect(res.status).toBe(200);
  expect(res.body.sourceCaptureId).toBe('c2');
});
```

- [ ] **Step 3 : Vérifier que les tests échouent**

```bash
npm test -- tests/routes/parcours.test.js tests/routes/steps.test.js
```
Attendu : FAIL — routes non trouvées

- [ ] **Step 4 : Implémenter routes/parcours.js**

```js
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
```

- [ ] **Step 5 : Implémenter routes/steps.js**

```js
// src/server/routes/steps.js
const express = require('express');
const router  = express.Router({ mergeParams: true });
const svc     = require('../services/stepService');
const config  = require('../config');

const { id: parcoursId, ver } = (req) => ({ id: req.params.id, ver: req.params.ver });

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
```

- [ ] **Step 6 : Modifier src/server/index.js**

Ajouter après les imports existants et avant `app.use('/api/capture'...)` :

```js
const parcoursRoutes = require('./routes/parcours');
const stepsRoutes    = require('./routes/steps');
```

Ajouter après `app.use('/data/gallery', ...)` :

```js
app.use('/data/parcours', express.static(path.join(process.cwd(), config.dataDir, 'parcours')));
```

Ajouter après `app.use('/api/gallery', galleryRoutes)` :

```js
app.use('/api/parcours', parcoursRoutes);
app.use('/api/parcours/:id/versions/:ver/steps', stepsRoutes);
```

- [ ] **Step 7 : Vérifier que tous les tests passent**

```bash
npm test
```
Attendu : PASS — 33 tests (20 Plan 1 + 6 parcours + 7 steps)

- [ ] **Step 8 : Commit**

```bash
git add src/server/routes/parcours.js src/server/routes/steps.js \
        src/server/index.js \
        tests/routes/parcours.test.js tests/routes/steps.test.js
git commit -m "feat: add parcours + steps REST routes, wire into Express"
```

---

## Task 4 — Layout 3 panneaux + API client

**Files:**
- Modify: `src/client/index.html`
- Modify: `src/client/css/main.css`
- Create: `src/client/css/editor.css`
- Modify: `src/client/js/api.js`

- [ ] **Step 1 : Remplacer src/client/index.html**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ScreenCaptureMaintenance — Auteur</title>
  <link rel="stylesheet" href="css/main.css" />
  <link rel="stylesheet" href="css/editor.css" />
</head>
<body>

  <div id="toolbar">
    <h1>SCM</h1>
    <button id="btn-capture" class="btn btn-primary">● Capturer</button>
    <button id="btn-stop"    class="btn btn-danger" disabled>■ Stop</button>
    <span id="capture-status"></span>
    <div style="flex:1"></div>
    <select id="parcours-select"><option value="">— Parcours —</option></select>
    <button id="btn-new-parcours" class="btn btn-secondary">+ Nouveau</button>
    <button id="btn-new-version"  class="btn btn-secondary" disabled>⎇ Version</button>
  </div>

  <div id="main">
    <div id="gallery-panel">
      <div id="gallery-container"></div>
    </div>

    <div id="editor-panel">
      <div id="canvas-container">
        <canvas id="fabric-canvas"></canvas>
        <div id="no-step-msg">← Glissez une capture sur la timeline</div>
      </div>
      <div id="tool-bar">
        <button class="tool-btn active" data-tool="select">↖ Sélection</button>
        <button class="tool-btn" data-tool="hotspot">□ Hotspot</button>
        <button class="tool-btn" data-tool="text">T Texte</button>
        <button id="btn-del-obj" class="btn btn-danger btn-sm">✕ Supprimer</button>
      </div>
      <div id="step-form" style="display:none">
        <label>Titre <input id="f-title" type="text" placeholder="Titre de l'étape" /></label>
        <label>Instruction <textarea id="f-instruction" rows="2"></textarea></label>
        <label class="row">
          <input id="f-scoring" type="checkbox" /> Scoring activé
          <span class="indent">Points : <input id="f-points" type="number" value="1" min="0" style="width:50px" /></span>
        </label>
        <label class="row"><input id="f-feedback" type="checkbox" /> Feedback activé</label>
        <div id="feedback-fields" style="display:none">
          <label>✓ <input id="f-ok"  type="text" placeholder="Feedback correct" /></label>
          <label>✗ <input id="f-ko"  type="text" placeholder="Feedback incorrect" /></label>
        </div>
        <button id="btn-save-step" class="btn btn-primary btn-sm">💾 Enregistrer</button>
      </div>
    </div>
  </div>

  <div id="timeline-panel">
    <div id="timeline-steps"></div>
    <span id="timeline-hint">Glissez des captures ici pour créer des étapes</span>
  </div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js"></script>
  <script src="js/api.js"></script>
  <script src="js/gallery.js"></script>
  <script src="js/editor.js"></script>
  <script src="js/timeline.js"></script>
  <script src="js/toolbar.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      Gallery.init(document.getElementById('gallery-container'));
      Editor.init(document.getElementById('fabric-canvas'));
      Timeline.init(document.getElementById('timeline-steps'));
      Toolbar.init(document.getElementById('parcours-select'));
    });
  </script>
</body>
</html>
```

- [ ] **Step 2 : Remplacer src/client/css/main.css**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body { font-family: system-ui, sans-serif; background: #f0f2f5;
       color: #1a1a2e; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }

/* ── Toolbar ── */
#toolbar { display: flex; align-items: center; gap: 8px; padding: 8px 16px;
           background: #1a1a2e; color: white; flex-shrink: 0; }
#toolbar h1 { font-size: 1rem; }
#capture-status { font-size: 0.8rem; color: #86efac; }

.btn { padding: 6px 14px; border: none; border-radius: 5px;
       cursor: pointer; font-size: 0.85rem; font-weight: 600; }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-primary   { background: #4ade80; color: #1a1a2e; }
.btn-secondary { background: #334155; color: white; }
.btn-danger    { background: #f87171; color: white; }
.btn-sm        { padding: 4px 10px; font-size: 0.78rem; }

select { padding: 5px 8px; border-radius: 5px; border: 1px solid #475569;
         background: #1e293b; color: white; font-size: 0.85rem; }

/* ── Main (gallery + editor) ── */
#main { display: flex; flex: 1; overflow: hidden; }

#gallery-panel { width: 160px; flex-shrink: 0; overflow-y: auto;
                 background: #1e293b; padding: 8px; border-right: 1px solid #334155; }
#gallery-container { display: flex; flex-direction: column; gap: 6px; }

.gallery-item { position: relative; background: #0f172a; border-radius: 4px;
                overflow: hidden; cursor: grab; border: 2px solid transparent; }
.gallery-item:hover { border-color: #4ade80; }
.gallery-item img { width: 100%; display: block; }
.gallery-item .btn-delete { position: absolute; top: 2px; right: 2px;
  background: rgba(0,0,0,.6); color: white; border: none; border-radius: 3px;
  padding: 1px 5px; cursor: pointer; font-size: 0.7rem; }

#editor-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

/* ── Timeline ── */
#timeline-panel { height: 110px; flex-shrink: 0; background: #0f172a;
                  border-top: 1px solid #334155; display: flex; align-items: center;
                  padding: 8px 12px; gap: 8px; overflow-x: auto; }
#timeline-hint { color: #475569; font-size: 0.8rem; white-space: nowrap; }
#timeline-steps { display: flex; gap: 8px; }
```

- [ ] **Step 3 : Créer src/client/css/editor.css**

```css
/* Canvas */
#canvas-container { flex: 1; overflow: hidden; position: relative;
                    background: #1a1a2e; display: flex; align-items: center;
                    justify-content: center; }
#no-step-msg { position: absolute; color: #475569; font-size: 0.9rem;
               pointer-events: none; }
canvas { display: block; }

/* Tool bar */
#tool-bar { display: flex; gap: 6px; padding: 6px 12px;
            background: #1e293b; border-bottom: 1px solid #334155; flex-shrink: 0; }
.tool-btn { padding: 4px 12px; border: 1px solid #334155; border-radius: 4px;
            background: #1e293b; color: #94a3b8; cursor: pointer; font-size: 0.82rem; }
.tool-btn.active { background: #1d4ed8; color: white; border-color: #1d4ed8; }

/* Step form */
#step-form { padding: 10px 14px; background: #0f172a; flex-shrink: 0;
             border-top: 1px solid #334155; display: flex; flex-direction: column; gap: 6px; }
#step-form label { display: flex; align-items: center; gap: 6px;
                   font-size: 0.82rem; color: #94a3b8; }
#step-form label.row { flex-direction: row; }
.indent { margin-left: 12px; }
#step-form input[type="text"], #step-form textarea {
  flex: 1; background: #1e293b; border: 1px solid #334155; border-radius: 4px;
  color: white; padding: 4px 8px; font-size: 0.82rem; }
#step-form textarea { resize: vertical; }

/* Timeline step cards */
.timeline-step { width: 80px; flex-shrink: 0; background: #1e293b;
                 border-radius: 6px; overflow: hidden; cursor: pointer;
                 border: 2px solid transparent; position: relative; }
.timeline-step.active { border-color: #4ade80; }
.timeline-step img { width: 100%; display: block; }
.timeline-step .step-num { font-size: 0.65rem; color: #94a3b8; text-align: center;
                            padding: 2px; }
.timeline-step .btn-rm-step { position: absolute; top: 2px; right: 2px;
  background: rgba(0,0,0,.7); color: white; border: none; border-radius: 2px;
  padding: 0 4px; cursor: pointer; font-size: 0.7rem; display: none; }
.timeline-step:hover .btn-rm-step { display: block; }
.timeline-drop-zone { width: 6px; flex-shrink: 0; border-radius: 3px;
                      background: transparent; transition: background .15s; }
.timeline-drop-zone.drag-over { background: #4ade80; width: 4px; }
```

- [ ] **Step 4 : Remplacer src/client/js/api.js**

```js
// src/client/js/api.js
const API = {
  // ── Capture ──
  async captureOne()       { return (await fetch('/api/capture/single', { method: 'POST' })).json(); },
  async startCapture()     { return (await fetch('/api/capture/start',  { method: 'POST' })).json(); },
  async stopCapture()      { return (await fetch('/api/capture/stop',   { method: 'POST' })).json(); },
  async getCaptureStatus() { return (await fetch('/api/capture/status')).json(); },

  // ── Gallery ──
  async getGallery()       { return (await fetch('/api/gallery')).json(); },
  async deleteCapture(id)  { return (await fetch(`/api/gallery/${id}`, { method: 'DELETE' })).json(); },

  // ── Parcours ──
  async listParcours()           { return (await fetch('/api/parcours')).json(); },
  async createParcours(title)    { return _post('/api/parcours', { title }); },
  async getParcours(id)          { return (await fetch(`/api/parcours/${id}`)).json(); },
  async updateParcours(id, data) { return _put(`/api/parcours/${id}`, data); },
  async deleteParcours(id)       { await fetch(`/api/parcours/${id}`, { method: 'DELETE' }); },
  async createVersion(id, label) { return _post(`/api/parcours/${id}/versions`, { label }); },

  // ── Steps ──
  async listSteps(id, ver)                    { return (await fetch(_sUrl(id, ver))).json(); },
  async addStep(id, ver, captureId, filename) { return _post(_sUrl(id, ver), { captureId, captureFilename: filename }); },
  async getStep(id, ver, stepId)              { return (await fetch(`${_sUrl(id, ver)}/${stepId}`)).json(); },
  async updateStep(id, ver, stepId, data)     { return _put(`${_sUrl(id, ver)}/${stepId}`, data); },
  async deleteStep(id, ver, stepId)           { await fetch(`${_sUrl(id, ver)}/${stepId}`, { method: 'DELETE' }); },
  async reorderSteps(id, ver, orderedIds)     { return _put(`${_sUrl(id, ver)}/order`, { orderedIds }); },
  async replaceScreenshot(id, ver, stepId, captureId, filename) {
    return _put(`${_sUrl(id, ver)}/${stepId}/screenshot`, { captureId, captureFilename: filename });
  },
};

function _sUrl(id, ver) { return `/api/parcours/${id}/versions/${ver}/steps`; }
async function _post(url, body) {
  return (await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
}
async function _put(url, body) {
  return (await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
}
```

- [ ] **Step 5 : Démarrer le serveur et vérifier le layout**

```bash
npm start
```
Ouvrir http://localhost:3000. Attendu : 3 panneaux visibles (galerie à gauche, éditeur au centre, timeline en bas).

- [ ] **Step 6 : Commit**

```bash
git add src/client/index.html src/client/css/main.css src/client/css/editor.css src/client/js/api.js
git commit -m "feat: 3-panel layout (gallery | editor | timeline) + API client update"
```

---

## Task 5 — Toolbar : sélecteur de parcours

**Files:**
- Modify: `src/client/js/toolbar.js`

- [ ] **Step 1 : Remplacer src/client/js/toolbar.js**

```js
// src/client/js/toolbar.js
const Toolbar = {
  _parcoursId: null,
  _ver:        null,

  init(selectEl) {
    this.select        = selectEl;
    this.btnCapture    = document.getElementById('btn-capture');
    this.btnStop       = document.getElementById('btn-stop');
    this.btnNewParcours = document.getElementById('btn-new-parcours');
    this.btnNewVersion  = document.getElementById('btn-new-version');
    this.statusEl       = document.getElementById('capture-status');
    this._bind();
    this._loadParcours();
    this._syncCaptureStatus();
  },

  get parcoursId() { return this._parcoursId; },
  get ver()        { return this._ver; },

  _bind() {
    this.btnCapture.addEventListener('click', () => this._startCapture());
    this.btnStop.addEventListener('click', () => this._stopCapture());
    this.btnNewParcours.addEventListener('click', () => this._createParcours());
    this.btnNewVersion.addEventListener('click', () => this._createVersion());
    this.select.addEventListener('change', () => this._selectParcours(this.select.value));
  },

  async _loadParcours() {
    const list = await API.listParcours();
    this.select.innerHTML = '<option value="">— Parcours —</option>' +
      list.map(p => `<option value="${p.id}">${p.title} (${p.currentVersion})</option>`).join('');
  },

  async _createParcours() {
    const title = prompt('Nom du parcours :');
    if (!title) return;
    const manifest = await API.createParcours(title);
    await this._loadParcours();
    this.select.value = manifest.id;
    await this._selectParcours(manifest.id);
  },

  async _createVersion() {
    const label = prompt('Label de la nouvelle version :');
    if (!label) return;
    await API.createVersion(this._parcoursId, label);
    const manifest = await API.getParcours(this._parcoursId);
    this._ver = manifest.currentVersion;
    alert(`Version ${manifest.currentVersion} créée.`);
    await Timeline.load(this._parcoursId, this._ver);
  },

  async _selectParcours(id) {
    if (!id) { this._parcoursId = null; this._ver = null;
               this.btnNewVersion.disabled = true; Timeline.clear(); return; }
    const manifest = await API.getParcours(id);
    this._parcoursId = id;
    this._ver = manifest.currentVersion;
    this.btnNewVersion.disabled = false;
    await Timeline.load(id, this._ver);
  },

  async _startCapture() {
    await API.startCapture();
    this.btnCapture.disabled = true;
    this.btnStop.disabled = false;
    this.statusEl.textContent = '● Capture en cours…';
    this._pollInterval = setInterval(() => Gallery.refresh(), 2500);
  },

  async _stopCapture() {
    await API.stopCapture();
    this.btnCapture.disabled = false;
    this.btnStop.disabled = true;
    this.statusEl.textContent = '';
    clearInterval(this._pollInterval);
    await Gallery.refresh();
  },

  async _syncCaptureStatus() {
    const { capturing } = await API.getCaptureStatus();
    if (capturing) {
      this.btnCapture.disabled = true;
      this.btnStop.disabled = false;
      this.statusEl.textContent = '● Capture en cours…';
      this._pollInterval = setInterval(() => Gallery.refresh(), 2500);
    }
  },
};
```

- [ ] **Step 2 : Vérifier manuellement**

```bash
npm start
```
- Créer un parcours via "+ Nouveau" → il apparaît dans le sélecteur
- Sélectionner un parcours → timeline se vide (aucune étape)
- Bouton "⎇ Version" devient actif

- [ ] **Step 3 : Commit**

```bash
git add src/client/js/toolbar.js
git commit -m "feat: toolbar parcours selector + new parcours/version actions"
```

---

## Task 6 — Timeline

**Files:**
- Create: `src/client/js/timeline.js`
- Modify: `src/client/js/gallery.js`

- [ ] **Step 1 : Créer src/client/js/timeline.js**

```js
// src/client/js/timeline.js
const Timeline = {
  _container: null,
  _parcoursId: null,
  _ver: null,
  _steps: [],
  _activeStepId: null,

  init(container) {
    this._container = container;
    this._container.addEventListener('dragover', e => e.preventDefault());
    this._container.addEventListener('drop', e => this._onDropFromGallery(e));
  },

  async load(parcoursId, ver) {
    this._parcoursId = parcoursId;
    this._ver = ver;
    this._steps = await API.listSteps(parcoursId, ver);
    this._render();
  },

  clear() { this._parcoursId = null; this._ver = null; this._steps = []; this._render(); },

  _render() {
    const hint = document.getElementById('timeline-hint');
    this._container.innerHTML = '';
    if (!this._steps.length) { if (hint) hint.style.display = ''; return; }
    if (hint) hint.style.display = 'none';

    this._steps.forEach((step, idx) => {
      // Drop zone before each card
      this._container.appendChild(this._makeDropZone(idx));

      const card = document.createElement('div');
      card.className = 'timeline-step' + (step.id === this._activeStepId ? ' active' : '');
      card.dataset.stepId = step.id;
      card.dataset.idx = idx;
      card.draggable = true;
      card.innerHTML = `
        <img src="/data/parcours/${this._parcoursId}/versions/${this._ver}/steps/${step.id}.png"
             alt="étape ${idx + 1}" />
        <div class="step-num">${idx + 1}</div>
        <button class="btn-rm-step" data-id="${step.id}">✕</button>`;
      card.addEventListener('click', () => this._activateStep(step.id));
      card.querySelector('.btn-rm-step').addEventListener('click', async (e) => {
        e.stopPropagation();
        await this._removeStep(step.id);
      });
      card.addEventListener('dragstart', e => {
        e.dataTransfer.setData('stepId', step.id);
        e.dataTransfer.effectAllowed = 'move';
      });
      this._container.appendChild(card);
    });
    // Final drop zone
    this._container.appendChild(this._makeDropZone(this._steps.length));
  },

  _makeDropZone(targetIdx) {
    const dz = document.createElement('div');
    dz.className = 'timeline-drop-zone';
    dz.dataset.targetIdx = targetIdx;
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
    dz.addEventListener('drop', async (e) => {
      e.preventDefault();
      dz.classList.remove('drag-over');
      const stepId = e.dataTransfer.getData('stepId');
      if (stepId) { await this._reorderStep(stepId, targetIdx); return; }
      const captureId = e.dataTransfer.getData('captureId');
      const captureFilename = e.dataTransfer.getData('captureFilename');
      if (captureId) await this._addStepAt(captureId, captureFilename, targetIdx);
    });
    return dz;
  },

  async _onDropFromGallery(e) {
    const captureId = e.dataTransfer.getData('captureId');
    const captureFilename = e.dataTransfer.getData('captureFilename');
    if (!captureId || !this._parcoursId) return;
    await this._addStepAt(captureId, captureFilename, this._steps.length);
  },

  async _addStepAt(captureId, captureFilename, targetIdx) {
    if (!this._parcoursId) return;
    const step = await API.addStep(this._parcoursId, this._ver, captureId, captureFilename);
    this._steps = await API.listSteps(this._parcoursId, this._ver);
    // Move to desired position if not at end
    if (targetIdx < this._steps.length - 1) {
      const newOrder = this._steps.map(s => s.id);
      newOrder.splice(newOrder.indexOf(step.id), 1);
      newOrder.splice(targetIdx, 0, step.id);
      await API.reorderSteps(this._parcoursId, this._ver, newOrder);
      this._steps = await API.listSteps(this._parcoursId, this._ver);
    }
    this._render();
    this._activateStep(step.id);
  },

  async _removeStep(stepId) {
    await API.deleteStep(this._parcoursId, this._ver, stepId);
    if (this._activeStepId === stepId) {
      this._activeStepId = null;
      Editor.clear();
    }
    this._steps = await API.listSteps(this._parcoursId, this._ver);
    this._render();
  },

  async _reorderStep(stepId, targetIdx) {
    const ids = this._steps.map(s => s.id);
    const fromIdx = ids.indexOf(stepId);
    if (fromIdx === -1) return;
    ids.splice(fromIdx, 1);
    const insertAt = fromIdx < targetIdx ? targetIdx - 1 : targetIdx;
    ids.splice(insertAt, 0, stepId);
    await API.reorderSteps(this._parcoursId, this._ver, ids);
    this._steps = await API.listSteps(this._parcoursId, this._ver);
    this._render();
  },

  _activateStep(stepId) {
    this._activeStepId = stepId;
    this._render();
    const step = this._steps.find(s => s.id === stepId);
    if (step) Editor.loadStep(step, this._parcoursId, this._ver);
  },
};
```

- [ ] **Step 2 : Modifier src/client/js/gallery.js pour items draggables**

```js
// src/client/js/gallery.js
const Gallery = {
  container: null,

  init(container) { this.container = container; this.refresh(); },

  async refresh() {
    const { captures } = await API.getGallery();
    this.container.innerHTML = '';
    captures.forEach(entry => {
      const item = document.createElement('div');
      item.className = 'gallery-item';
      item.dataset.id = entry.id;
      item.draggable = true;
      item.innerHTML = `
        <img src="/data/gallery/${entry.filename}" alt="${entry.id}" />
        <button class="btn-delete" data-id="${entry.id}">✕</button>`;
      item.addEventListener('dragstart', e => {
        e.dataTransfer.setData('captureId', entry.id);
        e.dataTransfer.setData('captureFilename', entry.filename);
        e.dataTransfer.effectAllowed = 'copy';
      });
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

- [ ] **Step 3 : Vérifier manuellement**

```bash
npm start
```
- Capturer 2-3 screenshots → apparaissent dans la galerie
- Créer un parcours, sélectionner dans la toolbar
- Glisser un screenshot sur la timeline → carte apparaît
- Glisser un second → ordre visible
- Glisser une carte sur une autre zone → réordonne
- Clic `✕` sur une carte → supprime

- [ ] **Step 4 : Commit**

```bash
git add src/client/js/timeline.js src/client/js/gallery.js
git commit -m "feat: timeline (add, reorder, delete steps) + draggable gallery items"
```

---

## Task 7 — Canvas Editor (Fabric.js)

**Files:**
- Create: `src/client/js/editor.js`

- [ ] **Step 1 : Créer src/client/js/editor.js**

```js
// src/client/js/editor.js
const Editor = {
  _canvas: null,
  _tool: 'select',
  _step: null,
  _parcoursId: null,
  _ver: null,
  _drawing: false,
  _rect: null,
  _startX: 0,
  _startY: 0,

  init(canvasEl) {
    this._canvas = new fabric.Canvas(canvasEl, { selection: true });
    this._bindTools();
    this._bindCanvas();
    this._bindForm();
    document.getElementById('btn-del-obj').addEventListener('click', () => {
      const obj = this._canvas.getActiveObject();
      if (obj) { this._canvas.remove(obj); this._canvas.renderAll(); }
    });
  },

  _bindTools() {
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._tool = btn.dataset.tool;
        this._canvas.isDrawingMode = false;
        this._canvas.selection = this._tool === 'select';
        this._canvas.defaultCursor = this._tool === 'select' ? 'default' : 'crosshair';
      });
    });
  },

  _bindCanvas() {
    this._canvas.on('mouse:down', opt => {
      if (this._tool === 'select') return;
      const p = this._canvas.getPointer(opt.e);
      this._drawing = true;
      this._startX = p.x;
      this._startY = p.y;

      if (this._tool === 'hotspot') {
        this._rect = new fabric.Rect({
          left: p.x, top: p.y, width: 0, height: 0,
          fill: 'rgba(74,222,128,0.25)', stroke: '#4ade80', strokeWidth: 2,
          isHotspot: true, isCorrect: true,
        });
        this._canvas.add(this._rect);
      } else if (this._tool === 'text') {
        const text = new fabric.IText('Texte', {
          left: p.x, top: p.y, fontSize: 16, fill: '#fbbf24',
          fontFamily: 'system-ui', isAnnotation: true, annotationType: 'text',
        });
        this._canvas.add(text);
        this._canvas.setActiveObject(text);
        text.enterEditing();
        this._drawing = false;
      }
    });

    this._canvas.on('mouse:move', opt => {
      if (!this._drawing || this._tool !== 'hotspot' || !this._rect) return;
      const p = this._canvas.getPointer(opt.e);
      const w = p.x - this._startX;
      const h = p.y - this._startY;
      if (w < 0) { this._rect.set({ left: p.x, width: Math.abs(w) }); }
      else        { this._rect.set({ width: w }); }
      if (h < 0) { this._rect.set({ top: p.y, height: Math.abs(h) }); }
      else        { this._rect.set({ height: h }); }
      this._canvas.renderAll();
    });

    this._canvas.on('mouse:up', () => { this._drawing = false; this._rect = null; });
  },

  _bindForm() {
    document.getElementById('f-feedback').addEventListener('change', e => {
      document.getElementById('feedback-fields').style.display = e.target.checked ? '' : 'none';
    });
  },

  async loadStep(step, parcoursId, ver) {
    this._step = step;
    this._parcoursId = parcoursId;
    this._ver = ver;

    document.getElementById('no-step-msg').style.display = 'none';
    document.getElementById('step-form').style.display = '';

    // Fill form
    document.getElementById('f-title').value       = step.title || '';
    document.getElementById('f-instruction').value = step.instruction || '';
    document.getElementById('f-scoring').checked   = step.scoring?.enabled || false;
    document.getElementById('f-points').value      = step.scoring?.points ?? 1;
    document.getElementById('f-feedback').checked  = step.feedback?.enabled || false;
    document.getElementById('feedback-fields').style.display = step.feedback?.enabled ? '' : 'none';
    document.getElementById('f-ok').value  = step.feedback?.correct   || '';
    document.getElementById('f-ko').value  = step.feedback?.incorrect || '';

    // Load canvas
    const imgUrl = `/data/parcours/${parcoursId}/versions/${ver}/steps/${step.id}.png`;
    fabric.Image.fromURL(imgUrl, img => {
      const container = document.getElementById('canvas-container');
      const maxW = container.clientWidth  - 4;
      const maxH = container.clientHeight - 4;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const cW = Math.round(img.width  * scale);
      const cH = Math.round(img.height * scale);

      this._canvas.setWidth(cW);
      this._canvas.setHeight(cH);
      this._canvas.setBackgroundImage(img, this._canvas.renderAll.bind(this._canvas), {
        scaleX: scale, scaleY: scale,
      });

      this._canvas.clear();
      if (step.fabricJson) {
        this._canvas.loadFromJSON(step.fabricJson, () => {
          this._canvas.setBackgroundImage(img, this._canvas.renderAll.bind(this._canvas), {
            scaleX: scale, scaleY: scale,
          });
        });
      } else {
        this._canvas.renderAll();
      }
    });
  },

  clear() {
    this._step = null;
    this._canvas.clear();
    document.getElementById('no-step-msg').style.display = '';
    document.getElementById('step-form').style.display = 'none';
  },

  _collectStepData() {
    const objects = this._canvas.getObjects();
    const hotspots = objects
      .filter(o => o.isHotspot)
      .map(o => ({
        id: o.id || (o.id = crypto.randomUUID()),
        x: Math.round(o.left), y: Math.round(o.top),
        width: Math.round(o.width * (o.scaleX || 1)),
        height: Math.round(o.height * (o.scaleY || 1)),
        isCorrect: o.isCorrect !== false,
      }));
    const annotations = objects
      .filter(o => o.isAnnotation)
      .map(o => ({
        type: o.annotationType || 'text',
        x: Math.round(o.left), y: Math.round(o.top),
        content: o.text || '',
      }));
    return {
      title:       document.getElementById('f-title').value,
      instruction: document.getElementById('f-instruction').value,
      hotspots,
      annotations,
      fabricJson: this._canvas.toJSON(['isHotspot', 'isCorrect', 'isAnnotation', 'annotationType', 'id']),
      scoring: {
        enabled: document.getElementById('f-scoring').checked,
        points:  parseInt(document.getElementById('f-points').value) || 1,
      },
      feedback: {
        enabled:   document.getElementById('f-feedback').checked,
        correct:   document.getElementById('f-ok').value,
        incorrect: document.getElementById('f-ko').value,
      },
    };
  },
};

// Save button wired after DOM ready
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-save-step').addEventListener('click', async () => {
    if (!Editor._step) return;
    const data = Editor._collectStepData();
    await API.updateStep(Editor._parcoursId, Editor._ver, Editor._step.id, data);
    Editor._step = { ...Editor._step, ...data };
  });
});
```

- [ ] **Step 2 : Vérifier manuellement**

```bash
npm start
```
- Créer un parcours, capturer des screenshots, en glisser un sur la timeline
- Cliquer sur la carte → le screenshot s'affiche dans le canvas
- Sélectionner l'outil "Hotspot", dessiner un rectangle → rectangle vert apparaît
- Sélectionner "Texte", cliquer → zone de texte éditable
- Remplir instruction + feedback, cliquer "Enregistrer"
- Cliquer sur une autre étape puis revenir → hotspots et formulaire restaurés

- [ ] **Step 3 : Commit**

```bash
git add src/client/js/editor.js
git commit -m "feat: Fabric.js canvas editor (hotspot + text tools, save/restore)"
```

---

## Task 8 — Tests finaux + push

- [ ] **Step 1 : Lancer tous les tests**

```bash
npm test
```
Attendu : PASS — 33 tests (20 Plan 1 + 7 parcours + 6 steps)

- [ ] **Step 2 : Vérifier le flux complet manuellement**

```bash
npm start
```

Scénario complet :
1. Capturer 3-4 screenshots
2. Créer un parcours "Test plan 2"
3. Glisser 3 captures sur la timeline dans l'ordre voulu
4. Cliquer étape 1 → dessiner 1 hotspot, saisir instruction, enregistrer
5. Cliquer étape 2 → dessiner 1 texte, enregistrer
6. Réordonner les étapes par drag & drop
7. Supprimer l'étape 3
8. Créer une version v2 → la timeline recharge en v2 avec les étapes clonées

- [ ] **Step 3 : Push**

```bash
git push
```
