// src/client/js/api.js
const API = {
  // ── Capture ──
  async captureOne()       { return (await fetch('/api/capture/single', { method: 'POST' })).json(); },
  async startCapture()     { return (await fetch('/api/capture/start',  { method: 'POST' })).json(); },
  async stopCapture()      { return (await fetch('/api/capture/stop',   { method: 'POST' })).json(); },
  async getCaptureStatus() { return (await fetch('/api/capture/status')).json(); },

  // ── Gallery ──
  async getGallery()       { return (await fetch('/api/gallery')).json(); },
  async deleteCapture(id)  { return (await fetch(`/api/gallery/${id}`, { method: 'DELETE' })).json(); },

  // ── Parcours ──
  async listParcours()           { return (await fetch('/api/parcours')).json(); },
  async createParcours(title)    { return _post('/api/parcours', { title }); },
  async getParcours(id)          { return (await fetch(`/api/parcours/${id}`)).json(); },
  async updateParcours(id, data) { return _put(`/api/parcours/${id}`, data); },
  async deleteParcours(id)       { return (await fetch(`/api/parcours/${id}`, { method: 'DELETE' })).json(); },
  async createVersion(id, label) { return _post(`/api/parcours/${id}/versions`, { label }); },

  // ── Steps ──
  async listSteps(id, ver)                    { return (await fetch(_sUrl(id, ver))).json(); },
  async addStep(id, ver, captureId, filename) { return _post(_sUrl(id, ver), { captureId, captureFilename: filename }); },
  async getStep(id, ver, stepId)              { return (await fetch(`${_sUrl(id, ver)}/${stepId}`)).json(); },
  async updateStep(id, ver, stepId, data)     { return _put(`${_sUrl(id, ver)}/${stepId}`, data); },
  async removeStep(id, ver, stepId)           { return (await fetch(`${_sUrl(id, ver)}/${stepId}`, { method: 'DELETE' })).json(); },
  async reorderSteps(id, ver, orderedIds)     { return _put(`${_sUrl(id, ver)}/order`, { orderedIds }); },
  async replaceScreenshot(id, ver, stepId, captureId, filename) {
    return _put(`${_sUrl(id, ver)}/${stepId}/screenshot`, { captureId, captureFilename: filename });
  },
};

function _sUrl(id, ver) { return `/api/parcours/${id}/versions/${ver}/steps`; }
async function _post(url, body) {
  return (await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
}
async function _put(url, body) {
  return (await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
}
