// tests/routes/gallery.test.js
const request = require('supertest');

const mockIndex = {
  captures: [
    { id: 'id-1', filename: 'id-1.png', createdAt: '2026-01-01' },
    { id: 'id-2', filename: 'id-2.png', createdAt: '2026-01-02' },
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
  expect(res.body.captures[0].id).toBe('id-1');
});

test('GET /api/gallery retourne une galerie vide si index absent', async () => {
  const fileService = require('../../src/server/services/fileService');
  fileService.readJson.mockRejectedValueOnce(new Error('ENOENT'));
  const res = await request(app).get('/api/gallery');
  expect(res.status).toBe(200);
  expect(res.body.captures).toEqual([]);
});

test('DELETE /api/gallery/:id supprime la capture et met à jour index', async () => {
  const res = await request(app).delete('/api/gallery/id-1');
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
  const fileService = require('../../src/server/services/fileService');
  expect(fileService.deleteFile).toHaveBeenCalled();
  expect(fileService.writeJson).toHaveBeenCalled();
});

test('DELETE /api/gallery/:id retourne 404 si id inconnu', async () => {
  const res = await request(app).delete('/api/gallery/unknown-id');
  expect(res.status).toBe(404);
});
