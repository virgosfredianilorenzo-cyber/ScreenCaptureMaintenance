// src/client/js/api.js
const API = {
  async captureOne() {
    const res = await fetch('/api/capture/single', { method: 'POST' });
    return res.json();
  },
  async startCapture() {
    const res = await fetch('/api/capture/start', { method: 'POST' });
    return res.json();
  },
  async stopCapture() {
    const res = await fetch('/api/capture/stop', { method: 'POST' });
    return res.json();
  },
  async getCaptureStatus() {
    const res = await fetch('/api/capture/status');
    return res.json();
  },
  async getGallery() {
    const res = await fetch('/api/gallery');
    return res.json();
  },
  async deleteCapture(id) {
    const res = await fetch(`/api/gallery/${id}`, { method: 'DELETE' });
    return res.json();
  },
};
