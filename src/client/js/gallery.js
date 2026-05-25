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
      item.innerHTML = `
        <img src="/data/gallery/${entry.filename}" alt="${entry.id}" />
        <span class="gallery-date">${new Date(entry.createdAt).toLocaleTimeString()}</span>
        <button class="btn-delete" data-id="${entry.id}">✕</button>
      `;
      item.querySelector('.btn-delete').addEventListener('click', async (e) => {
        e.stopPropagation();
        await API.deleteCapture(entry.id);
        await this.refresh();
      });
      this.container.appendChild(item);
    });
  },
};
