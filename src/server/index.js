// src/server/index.js
const express = require('express');
const path = require('path');
const config = require('./config');
const captureRoutes = require('./routes/capture');
const galleryRoutes = require('./routes/gallery');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));
app.use('/data/gallery', express.static(path.join(process.cwd(), config.dataDir, 'gallery')));

app.use('/api/capture', captureRoutes);
app.use('/api/gallery', galleryRoutes);
app.use(errorHandler);

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`ScreenCaptureMaintenance running on http://localhost:${config.port}`);
  });
}

module.exports = app;
