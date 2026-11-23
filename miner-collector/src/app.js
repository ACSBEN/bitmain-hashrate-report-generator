'use strict';

const path = require('node:path');
const express = require('express');
const { createSnapshotStore } = require('./snapshots');
const collectRoutes = require('./routes');
const helpers = require('./view-helpers');

const ROOT = path.join(__dirname, '..');
const REPORT_MANAGER_ROOT = path.join(ROOT, '..', 'report-manager');

function createApp({
  snapshotDir = path.join(ROOT, 'data', 'snapshots'),
  reportsDir = path.join(REPORT_MANAGER_ROOT, 'data', 'reports'),
  reportManagerUrl = process.env.REPORT_MANAGER_URL || 'http://127.0.0.1:3000',
  fetchImpl = globalThis.fetch,
  timeoutMs = 10_000,
} = {}) {
  const app = express();
  const snapshots = createSnapshotStore(snapshotDir);

  app.set('view engine', 'ejs');
  app.set('views', path.join(ROOT, 'views'));
  app.locals.h = helpers;
  app.locals.reportManagerUrl = reportManagerUrl;

  app.use(express.urlencoded({ extended: false, limit: '10kb' }));
  app.use(express.static(path.join(ROOT, 'public')));

  app.use(collectRoutes({ snapshots, reportsDir, fetchImpl, timeoutMs }));

  app.use((req, res) => {
    res.status(404).render('error', { title: 'Not found', message: 'That page or snapshot does not exist.' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).render('error', { title: 'Something went wrong', message: err.message });
  });

  return app;
}

module.exports = { createApp };
