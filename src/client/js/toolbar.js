// src/client/js/toolbar.js
const Toolbar = {
  init() {
    this.btnCapture = document.getElementById('btn-capture');
    this.btnStop = document.getElementById('btn-stop');
    this.statusEl = document.getElementById('capture-status');
    this._bind();
    this._syncStatus();
  },

  _bind() {
    this.btnCapture.addEventListener('click', () => this._start());
    this.btnStop.addEventListener('click', () => this._stop());
  },

  async _start() {
    await API.startCapture();
    this.btnCapture.disabled = true;
    this.btnStop.disabled = false;
    this.statusEl.textContent = '● Capture en cours…';
    this._pollGallery();
  },

  async _stop() {
    await API.stopCapture();
    this.btnCapture.disabled = false;
    this.btnStop.disabled = true;
    this.statusEl.textContent = '';
    clearInterval(this._pollInterval);
    await Gallery.refresh();
  },

  _pollGallery() {
    this._pollInterval = setInterval(() => Gallery.refresh(), 2500);
  },

  async _syncStatus() {
    const { capturing } = await API.getCaptureStatus();
    if (capturing) {
      this.btnCapture.disabled = true;
      this.btnStop.disabled = false;
      this.statusEl.textContent = '● Capture en cours…';
      this._pollGallery();
    }
  },
};
