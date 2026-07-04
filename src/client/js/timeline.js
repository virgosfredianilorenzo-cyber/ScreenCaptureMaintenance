// src/client/js/timeline.js
const Timeline = {
  _container: null,
  _parcoursId: null,
  _ver: null,
  _steps: [],
  _activeStepId: null,

  init(container) {
    this._container = container;
    this._container.addEventListener('dragover', e => e.preventDefault());
    this._container.addEventListener('drop', e => this._onDropFromGallery(e));
  },

  async load(parcoursId, ver) {
    this._parcoursId = parcoursId;
    this._ver = ver;
    this._steps = await API.listSteps(parcoursId, ver);
    this._render();
  },

  clear() {
    this._parcoursId = null;
    this._ver = null;
    this._steps = [];
    this._activeStepId = null;
    this._render();
  },

  _render() {
    const hint = document.getElementById('timeline-hint');
    this._container.innerHTML = '';
    if (!this._steps.length) {
      if (hint) hint.style.display = '';
      return;
    }
    if (hint) hint.style.display = 'none';

    this._steps.forEach((step, idx) => {
      // Drop zone before each card
      this._container.appendChild(this._makeDropZone(idx));

      const card = document.createElement('div');
      card.className = 'timeline-step' + (step.id === this._activeStepId ? ' active' : '');
      card.dataset.stepId = step.id;
      card.dataset.idx = idx;
      card.draggable = true;

      const img = document.createElement('img');
      img.src = `/data/parcours/${encodeURIComponent(this._parcoursId)}/versions/${encodeURIComponent(this._ver)}/steps/${encodeURIComponent(step.id)}.png`;
      img.alt = `étape ${idx + 1}`;

      const numEl = document.createElement('div');
      numEl.className = 'step-num';
      numEl.textContent = idx + 1;

      const rmBtn = document.createElement('button');
      rmBtn.className = 'btn-rm-step';
      rmBtn.dataset.id = step.id;
      rmBtn.textContent = '✕';

      card.appendChild(img);
      card.appendChild(numEl);
      card.appendChild(rmBtn);

      card.addEventListener('click', () => this._activateStep(step.id));
      rmBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this._removeStep(step.id);
      });
      card.addEventListener('dragstart', e => {
        e.dataTransfer.setData('stepId', step.id);
        e.dataTransfer.effectAllowed = 'move';
      });

      this._container.appendChild(card);
    });

    // Final drop zone
    this._container.appendChild(this._makeDropZone(this._steps.length));
  },

  _makeDropZone(targetIdx) {
    const dz = document.createElement('div');
    dz.className = 'timeline-drop-zone';
    dz.dataset.targetIdx = targetIdx;
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
    dz.addEventListener('drop', async (e) => {
      e.preventDefault();
      dz.classList.remove('drag-over');
      const stepId = e.dataTransfer.getData('stepId');
      if (stepId) { await this._reorderStep(stepId, targetIdx); return; }
      const captureId = e.dataTransfer.getData('captureId');
      const captureFilename = e.dataTransfer.getData('captureFilename');
      if (captureId) await this._addStepAt(captureId, captureFilename, targetIdx);
    });
    return dz;
  },

  async _onDropFromGallery(e) {
    const captureId = e.dataTransfer.getData('captureId');
    const captureFilename = e.dataTransfer.getData('captureFilename');
    if (!captureId || !this._parcoursId) return;
    await this._addStepAt(captureId, captureFilename, this._steps.length);
  },

  async _addStepAt(captureId, captureFilename, targetIdx) {
    if (!this._parcoursId) return;
    const step = await API.addStep(this._parcoursId, this._ver, captureId, captureFilename);
    this._steps = await API.listSteps(this._parcoursId, this._ver);
    // Move to desired position if not at end
    if (targetIdx < this._steps.length - 1) {
      const newOrder = this._steps.map(s => s.id);
      newOrder.splice(newOrder.indexOf(step.id), 1);
      newOrder.splice(targetIdx, 0, step.id);
      await API.reorderSteps(this._parcoursId, this._ver, newOrder);
      this._steps = await API.listSteps(this._parcoursId, this._ver);
    }
    this._render();
    this._activateStep(step.id);
  },

  async _removeStep(stepId) {
    await API.removeStep(this._parcoursId, this._ver, stepId);
    if (this._activeStepId === stepId) {
      this._activeStepId = null;
      if (typeof Editor !== 'undefined' && typeof Editor.clear === 'function') {
        Editor.clear();
      }
    }
    this._steps = await API.listSteps(this._parcoursId, this._ver);
    this._render();
  },

  async _reorderStep(stepId, targetIdx) {
    const ids = this._steps.map(s => s.id);
    const fromIdx = ids.indexOf(stepId);
    if (fromIdx === -1) return;
    ids.splice(fromIdx, 1);
    const insertAt = fromIdx < targetIdx ? targetIdx - 1 : targetIdx;
    ids.splice(insertAt, 0, stepId);
    await API.reorderSteps(this._parcoursId, this._ver, ids);
    this._steps = await API.listSteps(this._parcoursId, this._ver);
    this._render();
  },

  _activateStep(stepId) {
    this._activeStepId = stepId;
    this._render();
    const step = this._steps.find(s => s.id === stepId);
    if (step && typeof Editor !== 'undefined' && typeof Editor.loadStep === 'function') {
      Editor.loadStep(step, this._parcoursId, this._ver);
    }
  },
};
