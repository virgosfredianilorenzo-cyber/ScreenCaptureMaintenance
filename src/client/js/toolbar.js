// src/client/js/toolbar.js
const Toolbar = {
  _parcoursId: null,
  _ver:        null,

  init(selectEl) {
    this.select        = selectEl;
    this.btnCapture    = document.getElementById('btn-capture');
    this.btnStop       = document.getElementById('btn-stop');
    this.btnNewParcours = document.getElementById('btn-new-parcours');
    this.btnNewVersion  = document.getElementById('btn-new-version');
    this.statusEl       = document.getElementById('capture-status');
    this._bind();
    this._loadParcours();
    this._syncCaptureStatus();
  },

  get parcoursId() { return this._parcoursId; },
  get ver()        { return this._ver; },

  _bind() {
    this.btnCapture.addEventListener('click', () => this._startCapture());
    this.btnStop.addEventListener('click', () => this._stopCapture());
    this.btnNewParcours.addEventListener('click', () => this._createParcours());
    this.btnNewVersion.addEventListener('click', () => this._createVersion());
    this.select.addEventListener('change', () => this._selectParcours(this.select.value));
  },

  async _loadParcours() {
    const list = await API.listParcours();
    this.select.innerHTML = '<option value="">— Parcours —</option>' +
      list.map(p => `<option value="${p.id}">${p.title} (${p.currentVersion})</option>`).join('');
  },

  async _createParcours() {
    const title = prompt('Nom du parcours :');
    if (!title) return;
    const manifest = await API.createParcours(title);
    await this._loadParcours();
    this.select.value = manifest.id;
    await this._selectParcours(manifest.id);
  },

  async _createVersion() {
    const label = prompt('Label de la nouvelle version :');
    if (!label) return;
    await API.createVersion(this._parcoursId, label);
    const manifest = await API.getParcours(this._parcoursId);
    this._ver = manifest.currentVersion;
    await this._loadParcours();
    this.select.value = this._parcoursId;
    alert(`Version ${manifest.currentVersion} créée.`);
    await Timeline.load(this._parcoursId, this._ver);
  },

  async _selectParcours(id) {
    if (!id) { this._parcoursId = null; this._ver = null;
               this.btnNewVersion.disabled = true; Timeline.clear(); return; }
    const manifest = await API.getParcours(id);
    this._parcoursId = id;
    this._ver = manifest.currentVersion;
    this.btnNewVersion.disabled = false;
    await Timeline.load(id, this._ver);
  },

  async _startCapture() {
    await API.startCapture();
    this.btnCapture.disabled = true;
    this.btnStop.disabled = false;
    this.statusEl.textContent = '● Capture en cours…';
    this._pollInterval = setInterval(() => Gallery.refresh(), 2500);
  },

  async _stopCapture() {
    try {
      await API.stopCapture();
    } finally {
      this.btnCapture.disabled = false;
      this.btnStop.disabled = true;
      this.statusEl.textContent = '';
      clearInterval(this._pollInterval);
      await Gallery.refresh();
    }
  },

  async _syncCaptureStatus() {
    const { capturing } = await API.getCaptureStatus();
    if (capturing) {
      this.btnCapture.disabled = true;
      this.btnStop.disabled = false;
      this.statusEl.textContent = '● Capture en cours…';
      this._pollInterval = setInterval(() => Gallery.refresh(), 2500);
    }
  },
};
