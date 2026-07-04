// src/client/js/editor.js
const Editor = {
  _canvas: null,
  _tool: 'select',
  _step: null,
  _parcoursId: null,
  _ver: null,
  _drawing: false,
  _rect: null,
  _startX: 0,
  _startY: 0,

  init(canvasEl) {
    this._canvas = new fabric.Canvas(canvasEl, { selection: true });
    this._bindTools();
    this._bindCanvas();
    this._bindForm();
    document.getElementById('btn-del-obj').addEventListener('click', () => {
      const obj = this._canvas.getActiveObject();
      if (obj) { this._canvas.remove(obj); this._canvas.renderAll(); }
    });
  },

  _bindTools() {
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._tool = btn.dataset.tool;
        this._canvas.isDrawingMode = false;
        this._canvas.selection = this._tool === 'select';
        this._canvas.defaultCursor = this._tool === 'select' ? 'default' : 'crosshair';
      });
    });
  },

  _bindCanvas() {
    this._canvas.on('mouse:down', opt => {
      if (this._tool === 'select') return;
      const p = this._canvas.getPointer(opt.e);
      this._drawing = true;
      this._startX = p.x;
      this._startY = p.y;

      if (this._tool === 'hotspot') {
        this._rect = new fabric.Rect({
          left: p.x, top: p.y, width: 0, height: 0,
          fill: 'rgba(74,222,128,0.25)', stroke: '#4ade80', strokeWidth: 2,
          isHotspot: true, isCorrect: true,
        });
        this._canvas.add(this._rect);
      } else if (this._tool === 'text') {
        const text = new fabric.IText('Texte', {
          left: p.x, top: p.y, fontSize: 16, fill: '#fbbf24',
          fontFamily: 'system-ui', isAnnotation: true, annotationType: 'text',
        });
        this._canvas.add(text);
        this._canvas.setActiveObject(text);
        text.enterEditing();
        this._drawing = false;
      }
    });

    this._canvas.on('mouse:move', opt => {
      if (!this._drawing || this._tool !== 'hotspot' || !this._rect) return;
      const p = this._canvas.getPointer(opt.e);
      const w = p.x - this._startX;
      const h = p.y - this._startY;
      if (w < 0) { this._rect.set({ left: p.x, width: Math.abs(w) }); }
      else        { this._rect.set({ width: w }); }
      if (h < 0) { this._rect.set({ top: p.y, height: Math.abs(h) }); }
      else        { this._rect.set({ height: h }); }
      this._canvas.renderAll();
    });

    this._canvas.on('mouse:up', () => { this._drawing = false; this._rect = null; });
  },

  _bindForm() {
    document.getElementById('f-feedback').addEventListener('change', e => {
      document.getElementById('feedback-fields').style.display = e.target.checked ? '' : 'none';
    });
  },

  async loadStep(step, parcoursId, ver) {
    this._step = step;
    this._parcoursId = parcoursId;
    this._ver = ver;

    document.getElementById('no-step-msg').style.display = 'none';
    document.getElementById('step-form').style.display = '';

    // Fill form
    document.getElementById('f-title').value       = step.title || '';
    document.getElementById('f-instruction').value = step.instruction || '';
    document.getElementById('f-scoring').checked   = step.scoring?.enabled || false;
    document.getElementById('f-points').value      = step.scoring?.points ?? 1;
    document.getElementById('f-feedback').checked  = step.feedback?.enabled || false;
    document.getElementById('feedback-fields').style.display = step.feedback?.enabled ? '' : 'none';
    document.getElementById('f-ok').value  = step.feedback?.correct   || '';
    document.getElementById('f-ko').value  = step.feedback?.incorrect || '';

    // Load canvas
    const imgUrl = `/data/parcours/${parcoursId}/versions/${ver}/steps/${step.id}.png`;
    fabric.Image.fromURL(imgUrl, img => {
      const container = document.getElementById('canvas-container');
      const maxW = container.clientWidth  - 4;
      const maxH = container.clientHeight - 4;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const cW = Math.round(img.width  * scale);
      const cH = Math.round(img.height * scale);

      this._canvas.setWidth(cW);
      this._canvas.setHeight(cH);
      this._canvas.clear();

      this._canvas.setBackgroundImage(img, this._canvas.renderAll.bind(this._canvas), {
        scaleX: scale, scaleY: scale,
      });

      if (step.fabricJson) {
        this._canvas.loadFromJSON(step.fabricJson, () => {
          this._canvas.renderAll();
        });
      } else {
        this._canvas.renderAll();
      }
    });
  },

  clear() {
    this._step = null;
    this._canvas.clear();
    document.getElementById('no-step-msg').style.display = '';
    document.getElementById('step-form').style.display = 'none';
  },

  _collectStepData() {
    const objects = this._canvas.getObjects();
    const hotspots = objects
      .filter(o => o.isHotspot)
      .map(o => ({
        id: o.id || (o.id = crypto.randomUUID()),
        x: Math.round(o.left), y: Math.round(o.top),
        width: Math.round(o.width * (o.scaleX || 1)),
        height: Math.round(o.height * (o.scaleY || 1)),
        isCorrect: o.isCorrect !== false,
      }));
    const annotations = objects
      .filter(o => o.isAnnotation)
      .map(o => ({
        type: o.annotationType || 'text',
        x: Math.round(o.left), y: Math.round(o.top),
        content: o.text || '',
      }));
    return {
      title:       document.getElementById('f-title').value,
      instruction: document.getElementById('f-instruction').value,
      hotspots,
      annotations,
      fabricJson: this._canvas.toJSON(['isHotspot', 'isCorrect', 'isAnnotation', 'annotationType', 'id']),
      scoring: {
        enabled: document.getElementById('f-scoring').checked,
        points:  parseInt(document.getElementById('f-points').value) || 1,
      },
      feedback: {
        enabled:   document.getElementById('f-feedback').checked,
        correct:   document.getElementById('f-ok').value,
        incorrect: document.getElementById('f-ko').value,
      },
    };
  },
};

// Save button wired after DOM ready
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-save-step').addEventListener('click', async () => {
    if (!Editor._step) return;
    const data = Editor._collectStepData();
    await API.updateStep(Editor._parcoursId, Editor._ver, Editor._step.id, data);
    Editor._step = { ...Editor._step, ...data };
  });
});
