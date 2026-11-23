'use strict';

const express = require('express');
const { fetchAll, CollectError } = require('./vnish/client');
const { normalize } = require('./vnish/normalize');
const { snapshotToReport } = require('./to-report');
const { createStore, ValidationError } = require('../../report-manager/src/store');

module.exports = function collectRoutes({ snapshots, reportsDir, fetchImpl, timeoutMs }) {
  const router = express.Router();
  const reports = createStore(reportsDir);

  async function renderIndex(res, { status = 200, error = null, host = '' } = {}) {
    res.status(status).render('index', { title: 'Collect', error, host, recent: await snapshots.list() });
  }

  router.get('/', (req, res) => renderIndex(res));

  router.post('/collect', async (req, res) => {
    const host = String(req.body.host ?? '').trim();
    let result;
    try {
      result = await fetchAll(host, { fetchImpl, timeoutMs });
    } catch (err) {
      if (!(err instanceof CollectError)) throw err;
      return renderIndex(res, { status: err.status, error: err.message, host });
    }
    const name = await snapshots.save(normalize(result));
    res.redirect(303, `/snapshots/${name}`);
  });

  async function load(req, res) {
    const snapshot = await snapshots.get(req.params.name);
    if (!snapshot) res.status(404).render('error', { title: 'Not found', message: 'That snapshot does not exist.' });
    return snapshot;
  }

  router.get('/snapshots/:name', async (req, res) => {
    const snapshot = await load(req, res);
    if (!snapshot) return;
    res.render('snapshot', {
      title: snapshot.miner.serialNumber || req.params.name,
      name: req.params.name,
      snapshot,
      created: req.query.created === '1',
      error: null,
    });
  });

  router.get('/snapshots/:name/download.json', async (req, res) => {
    const snapshot = await load(req, res);
    if (!snapshot) return;
    res.attachment(`${req.params.name}.json`).type('json').send(JSON.stringify(snapshot, null, 2) + '\n');
  });

  router.post('/snapshots/:name/report', async (req, res) => {
    const snapshot = await load(req, res);
    if (!snapshot) return;
    if (snapshot.reportId) return res.redirect(303, `/snapshots/${req.params.name}`);
    let report;
    try {
      report = await reports.create(snapshotToReport(snapshot, { snapshotName: req.params.name }));
    } catch (err) {
      if (!(err instanceof ValidationError)) throw err;
      const fields = Object.entries(err.errors).map(([field, msg]) => `${field}: ${msg}`).join('; ');
      return res.status(422).render('snapshot', {
        title: snapshot.miner.serialNumber || req.params.name,
        name: req.params.name,
        snapshot,
        created: false,
        error: `This snapshot can't be turned into a report: ${fields}`,
      });
    }
    await snapshots.update(req.params.name, { reportId: report.id });
    res.redirect(303, `/snapshots/${req.params.name}?created=1`);
  });

  return router;
};
