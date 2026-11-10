'use strict';

const path = require('node:path');
const express = require('express');
const { createStore } = require('./store');
const reportRoutes = require('./routes/reports');
const settingsRoutes = require('./routes/settings');
const format = require('./format');

const ROOT = path.join(__dirname, '..');

function createApp({
  dataDir = path.join(ROOT, 'data', 'reports'),
  thresholdsFile = path.join(ROOT, 'config', 'thresholds.json'),
} = {}) {
  const app = express();
  const store = createStore(dataDir);

  app.set('view engine', 'ejs');
  app.set('views', path.join(ROOT, 'views'));
  app.locals.format = format;

  app.use(express.urlencoded({ extended: true, limit: '100kb' }));
  app.use(express.static(path.join(ROOT, 'public')));

  app.use((req, res, next) => {
    res.locals.currentPath = req.path;
    next();
  });

  app.use(reportRoutes({ store, thresholdsFile, publicDir: path.join(ROOT, 'public') }));
  app.use(settingsRoutes({ thresholdsFile }));

  app.use((req, res) => {
    res.status(404).render('error', { title: 'Not found', message: 'That page or report does not exist.' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).render('error', { title: 'Something went wrong', message: err.message });
  });

  return app;
}

module.exports = { createApp };
