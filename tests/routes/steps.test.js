// tests/routes/steps.test.js
const request = require('supertest');

jest.mock('../../src/server/services/parcoursService', () => ({
  listParcours: jest.fn(), createParcours: jest.fn(), getParcours: jest.fn(),
  updateParcours: jest.fn(), deleteParcours: jest.fn(), createVersion: jest.fn(),
}));
jest.mock('../../src/server/services/stepService', () => ({
  addStep:           jest.fn().mockResolvedValue({ id: 's1', title: '' }),
  listSteps:         jest.fn().mockResolvedValue([{ id: 's1' }, { id: 's2' }]),
  getStep:           jest.fn().mockResolvedValue({ id: 's1', instruction: '' }),
  updateStep:        jest.fn().mockResolvedValue({ id: 's1', instruction: 'Cliquez' }),
  removeStep:        jest.fn().mockResolvedValue(undefined),
  reorderSteps:      jest.fn().mockResolvedValue(undefined),
  replaceScreenshot: jest.fn().mockResolvedValue({ id: 's1', sourceCaptureId: 'c2' }),
}));
jest.mock('../../src/server/services/captureService', () => ({
  captureOne: jest.fn(), startAutoCapture: jest.fn(),
  stopAutoCapture: jest.fn(), isCapturing: jest.fn().mockReturnValue(false),
}));
jest.mock('../../src/server/config', () => ({ dataDir: '/tmp/scm', port: 3000, capture: { intervalMs: 2000 } }));

const app = require('../../src/server/index');
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
