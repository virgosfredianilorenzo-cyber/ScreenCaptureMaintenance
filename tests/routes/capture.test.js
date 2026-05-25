// tests/routes/capture.test.js
const request = require('supertest');

jest.mock('../../src/server/services/captureService', () => ({
  captureOne: jest.fn().mockResolvedValue({ id: 'abc', filename: 'abc.png', createdAt: '2026-01-01' }),
  startAutoCapture: jest.fn(),
  stopAutoCapture: jest.fn(),
  isCapturing: jest.fn().mockReturnValue(false),
}));
jest.mock('../../src/server/config', () => ({
  dataDir: '/tmp/scm-test-data',
  capture: { intervalMs: 2000 },
}));

const app = require('../../src/server/index');

test('POST /api/capture/single retourne une entrée galerie', async () => {
  const res = await request(app).post('/api/capture/single');
  expect(res.status).toBe(200);
  expect(res.body.id).toBe('abc');
});

test('POST /api/capture/start démarre la capture', async () => {
  const captureService = require('../../src/server/services/captureService');
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
  const captureService = require('../../src/server/services/captureService');
  captureService.isCapturing.mockReturnValue(true);
  const res = await request(app).get('/api/capture/status');
  expect(res.status).toBe(200);
  expect(res.body.capturing).toBe(true);
});
