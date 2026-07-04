// src/server/index.js
const express = require('express');
const path = require('path');
const config = require('./config');
const captureRoutes  = require('./routes/capture');
const galleryRoutes  = require('./routes/gallery');
const parcoursRoutes = require('./routes/parcours');
const stepsRoutes    = require('./routes/steps');
const errorHandler   = require('./middleware/errorHandler');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));
app.use('/data/gallery',   express.static(path.join(process.cwd(), config.dataDir, 'gallery')));
app.use('/data/parcours',  express.static(path.join(process.cwd(), config.dataDir, 'parcours')));

app.use('/api/capture', captureRoutes);
app.use('/api/gallery',  galleryRoutes);
app.use('/api/parcours', parcoursRoutes);
app.use('/api/parcours/:id/versions/:ver/steps', stepsRoutes);
app.use(errorHandler);

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`ScreenCaptureMaintenance running on http://localhost:${config.port}`);
  });
}

module.exports = app;
