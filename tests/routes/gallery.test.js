// tests/routes/gallery.test.js
const request = require('supertest');

const UUID1 = 'a0000000-0000-0000-0000-000000000001';
const UUID2 = 'a0000000-0000-0000-0000-000000000002';
const UUID_MISSING = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

const mockIndex = {
  captures: [
    { id: UUID1, filename: `${UUID1}.png`, createdAt: '2026-01-01' },
    { id: UUID2, filename: `${UUID2}.png`, createdAt: '2026-01-02' },
  ],
};

jest.mock('../../src/server/services/fileService', () => ({
  readJson: jest.fn().mockResolvedValue(JSON.parse(JSON.stringify(mockIndex))),
  writeJson: jest.fn().mockResolvedValue(undefined),
  deleteFile: jest.fn().mockResolvedValue(undefined),
  savePng: jest.fn().mockResolvedValue(undefined),
  listFiles: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../src/server/services/captureService', () => ({
  captureOne: jest.fn(),
  startAutoCapture: jest.fn(),
  stopAutoCapture: jest.fn(),
  isCapturing: jest.fn().mockReturnValue(false),
}));
jest.mock('../../src/server/config', () => ({
  dataDir: '/tmp/scm-test-data',
  capture: { intervalMs: 2000 },
}));

const app = require('../../src/server/index');

beforeEach(() => {
  const fileService = require('../../src/server/services/fileService');
  fileService.readJson.mockResolvedValue(JSON.parse(JSON.stringify(mockIndex)));
});

test('GET /api/gallery retourne la liste des captures', async () => {
  const res = await request(app).get('/api/gallery');
  expect(res.status).toBe(200);
  expect(res.body.captures).toHaveLength(2);
  expect(res.body.captures[0].id).toBe(UUID1);
});

test('GET /api/gallery retourne une galerie vide si index absent', async () => {
  const fileService = require('../../src/server/services/fileService');
  fileService.readJson.mockRejectedValueOnce(new Error('ENOENT'));
  const res = await request(app).get('/api/gallery');
  expect(res.status).toBe(200);
  expect(res.body.captures).toEqual([]);
});

test('DELETE /api/gallery/:id supprime la capture et met à jour index', async () => {
  const res = await request(app).delete(`/api/gallery/${UUID1}`);
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
  const fileService = require('../../src/server/services/fileService');
  expect(fileService.deleteFile).toHaveBeenCalled();
  expect(fileService.writeJson).toHaveBeenCalled();
});

test('DELETE /api/gallery/:id retourne 400 si id invalide', async () => {
  const res = await request(app).delete('/api/gallery/not-a-uuid');
  expect(res.status).toBe(400);
});

test('DELETE /api/gallery/:id retourne 404 si id inconnu', async () => {
  const res = await request(app).delete(`/api/gallery/${UUID_MISSING}`);
  expect(res.status).toBe(404);
});
