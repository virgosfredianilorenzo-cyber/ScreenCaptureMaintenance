// src/client/js/gallery.js
const Gallery = {
  container: null,

  init(container) {
    this.container = container;
    this.refresh();
  },

  async refresh() {
    const { captures } = await API.getGallery();
    this.container.innerHTML = '';
    captures.forEach(entry => {
      const item = document.createElement('div');
      item.className = 'gallery-item';
      item.dataset.id = entry.id;

      const img = document.createElement('img');
      img.src = `/data/gallery/${encodeURIComponent(entry.filename)}`;
      img.alt = entry.id;

      const date = document.createElement('span');
      date.className = 'gallery-date';
      date.textContent = new Date(entry.createdAt).toLocaleTimeString();

      const btn = document.createElement('button');
      btn.className = 'btn-delete';
      btn.dataset.id = entry.id;
      btn.textContent = '✕';

      item.appendChild(img);
      item.appendChild(date);
      item.appendChild(btn);

      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await API.deleteCapture(entry.id);
        await this.refresh();
      });

      this.container.appendChild(item);
    });
  },
};
