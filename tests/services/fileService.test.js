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
