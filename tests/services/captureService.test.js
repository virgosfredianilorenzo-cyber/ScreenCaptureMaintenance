const path = require('path');
const os = require('os');
const fs = require('fs').promises;

const mockPng = Buffer.from([0x89, 0x50]);

// Mock screenshot-desktop (macOS/Windows path)
jest.mock('screenshot-desktop', () => jest.fn().mockResolvedValue(Buffer.from([0x89, 0x50])));

// Mock child_process.execFile (Linux Python fallback path)
jest.mock('child_process', () => {
  const { EventEmitter } = require('events');
  return {
    execFile: jest.fn((_cmd, _args, _opts) => {
      const proc = new EventEmitter();
      proc.stdout = new EventEmitter();
      process.nextTick(() => {
        proc.stdout.emit('data', Buffer.from([0x89, 0x50]));
        proc.emit('close', 0);
      });
      return proc;
    }),
  };
});

jest.mock('crypto', () => ({ randomUUID: () => 'test-uuid-1234' }));

let tmpDir;
let captureService;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scm-cap-'));
  jest.resetModules();
  jest.mock('screenshot-desktop', () => jest.fn().mockResolvedValue(Buffer.from([0x89, 0x50])));
  jest.mock('child_process', () => {
    const { EventEmitter } = require('events');
    return {
      execFile: jest.fn((_cmd, _args, _opts) => {
        const proc = new EventEmitter();
        proc.stdout = new EventEmitter();
        process.nextTick(() => {
          proc.stdout.emit('data', Buffer.from([0x89, 0x50]));
          proc.emit('close', 0);
        });
        return proc;
      }),
    };
  });
  jest.mock('crypto', () => ({ randomUUID: () => 'test-uuid-1234' }));
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
