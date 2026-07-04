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
