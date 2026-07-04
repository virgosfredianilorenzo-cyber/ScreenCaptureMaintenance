// tests/routes/parcours.test.js
const request = require('supertest');

jest.mock('../../src/server/services/parcoursService', () => ({
  listParcours:   jest.fn().mockResolvedValue([{ id: 'p1', title: 'Test' }]),
  createParcours: jest.fn().mockResolvedValue({ id: 'p1', title: 'New', currentVersion: 'v1' }),
  getParcours:    jest.fn().mockResolvedValue({ id: 'p1', title: 'Test', currentVersion: 'v1' }),
  updateParcours: jest.fn().mockResolvedValue({ id: 'p1', title: 'Updated' }),
  deleteParcours: jest.fn().mockResolvedValue(undefined),
  createVersion:  jest.fn().mockResolvedValue({ version: 'v2', stepOrder: [] }),
}));
jest.mock('../../src/server/services/stepService', () => ({
  addStep:           jest.fn(),
  listSteps:         jest.fn().mockResolvedValue([]),
  getStep:           jest.fn(),
  updateStep:        jest.fn(),
  removeStep:        jest.fn(),
  reorderSteps:      jest.fn(),
  replaceScreenshot: jest.fn(),
}));
jest.mock('../../src/server/services/captureService', () => ({
  captureOne: jest.fn(), startAutoCapture: jest.fn(),
  stopAutoCapture: jest.fn(), isCapturing: jest.fn().mockReturnValue(false),
}));
jest.mock('../../src/server/config', () => ({ dataDir: '/tmp/scm', port: 3000, capture: { intervalMs: 2000 } }));

const app = require('../../src/server/index');

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
