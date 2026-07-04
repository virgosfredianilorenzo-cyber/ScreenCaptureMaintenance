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

test('getParcours retourne le manifest d\'un parcours existant', async () => {
  const m = await svc.createParcours(tmpDir, { title: 'Get me' });
  const fetched = await svc.getParcours(tmpDir, m.id);
  expect(fetched.id).toBe(m.id);
  expect(fetched.title).toBe('Get me');
  expect(fetched.currentVersion).toBe('v1');
});

test('getVersion retourne une version spécifique', async () => {
  const m = await svc.createParcours(tmpDir, { title: 'P' });
  // Créer une v2
  const vPath = path.join(tmpDir, 'parcours', m.id, 'versions', 'v1', 'version.json');
  const v1 = JSON.parse(await fs.readFile(vPath, 'utf-8'));
  v1.stepOrder = ['step-xyz'];
  await fs.writeFile(vPath, JSON.stringify(v1));
  const v2 = await svc.createVersion(tmpDir, m.id, { label: 'v2' });

  // Récupérer v1 (version non-courante)
  const fetched = await svc.getVersion(tmpDir, m.id, 'v1');
  expect(fetched.version).toBe('v1');
  expect(fetched.stepOrder).toEqual(['step-xyz']);
  // v2 doit aussi être récupérable
  const fetched2 = await svc.getVersion(tmpDir, m.id, v2.version);
  expect(fetched2.version).toBe(v2.version);
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
