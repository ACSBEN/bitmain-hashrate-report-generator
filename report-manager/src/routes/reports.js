'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const express = require('express');
const schema = require('../schema');
const { ValidationError } = require('../store');
const { loadThresholds, evaluate } = require('../thresholds');
const { splitDuration, joinDuration } = require('../format');

// The form edits run time as days/hours/minutes; everything else maps 1:1 to
// the stored shape.
function reportToForm(report) {
  return {
    ...report,
    miner: { ...report.miner, runTime: splitDuration(report.miner.runTimeSeconds) },
  };
}

// The body parser compacts sparse arrays (only hashboards[2] submitted ends up
// at index 0), so each board carries a hidden slot field and is placed by it.
function boardsBySlot(raw) {
  const boards = Array.from({ length: schema.HASHBOARD_COUNT }, () => ({}));
  const list = Array.isArray(raw) ? raw : Object.values(raw || {});
  list.forEach((board, index) => {
    if (!board || typeof board !== 'object') return;
    const slot = board.slot === undefined ? index : Number(board.slot);
    if (Number.isInteger(slot) && slot >= 0 && slot < boards.length) {
      const { slot: _ignored, ...fields } = board;
      boards[slot] = fields;
    }
  });
  return boards;
}

function formToInput(body) {
  const miner = { ...(body.miner || {}) };
  miner.runTimeSeconds = joinDuration(miner.runTime);
  delete miner.runTime;
  return {
    reportDate: body.reportDate,
    source: body.source,
    notes: body.notes,
    miner,
    hashboards: boardsBySlot(body.hashboards),
    psu: body.psu || {},
  };
}

function blankForm() {
  return {
    reportDate: new Date().toISOString().slice(0, 10),
    source: 'manual',
    notes: '',
    miner: { runTime: splitDuration(null) },
    hashboards: Array.from({ length: schema.HASHBOARD_COUNT }, () => ({})),
    psu: {},
  };
}

function safeFilePart(text) {
  return String(text || 'report').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 60);
}

function matchesQuery(report, q) {
  if (!q) return true;
  const haystack = [
    report.miner.serialNumber,
    report.miner.model,
    report.miner.firmwareVersion,
    ...report.hashboards.map((b) => b.serialNumber),
  ].join(' ').toLowerCase();
  return haystack.includes(q.toLowerCase());
}

module.exports = function reportRoutes({ store, thresholdsFile, publicDir }) {
  const router = express.Router();

  const evaluateReport = (report) => evaluate(report, loadThresholds(thresholdsFile));

  async function loadOr404(req, res) {
    const report = await store.get(req.params.id);
    if (!report) {
      res.status(404).render('error', { title: 'Report not found', message: 'No report exists with that id.' });
      return null;
    }
    return report;
  }

  function renderForm(res, { form, errors = {}, report = null, status = 200 }) {
    res.status(status).render('form', {
      title: report ? `Edit ${report.miner.serialNumber}` : 'New Report',
      form: { ...form, hashboards: boardsBySlot(form.hashboards) },
      errors,
      report,
      schema,
    });
  }

  router.get('/', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const status = ['pass', 'warn', 'fail'].includes(req.query.status) ? req.query.status : '';
    const all = (await store.list()).map((report) => ({ report, evaluation: evaluateReport(report) }));
    const rows = all.filter(({ report, evaluation }) =>
      matchesQuery(report, q) && (!status || evaluation.overall === status));
    res.render('index', { title: 'Reports', rows, total: all.length, q, status });
  });

  router.get('/reports/new', (req, res) => {
    renderForm(res, { form: blankForm() });
  });

  router.post('/reports', async (req, res) => {
    try {
      const report = await store.create(formToInput(req.body));
      res.redirect(303, `/reports/${report.id}?saved=1`);
    } catch (err) {
      if (!(err instanceof ValidationError)) throw err;
      renderForm(res, { form: req.body, errors: err.errors, status: 422 });
    }
  });

  router.get('/reports/:id', async (req, res) => {
    const report = await loadOr404(req, res);
    if (!report) return;
    res.render('report', {
      title: `Report ${report.miner.serialNumber}`,
      report,
      evaluation: evaluateReport(report),
      schema,
      saved: req.query.saved === '1',
    });
  });

  router.get('/reports/:id/edit', async (req, res) => {
    const report = await loadOr404(req, res);
    if (!report) return;
    renderForm(res, { form: reportToForm(report), report });
  });

  router.post('/reports/:id', async (req, res) => {
    const existing = await loadOr404(req, res);
    if (!existing) return;
    try {
      await store.update(existing.id, formToInput(req.body));
      res.redirect(303, `/reports/${existing.id}?saved=1`);
    } catch (err) {
      if (!(err instanceof ValidationError)) throw err;
      renderForm(res, { form: req.body, errors: err.errors, report: existing, status: 422 });
    }
  });

  router.post('/reports/:id/delete', async (req, res) => {
    const existing = await loadOr404(req, res);
    if (!existing) return;
    await store.remove(existing.id);
    res.redirect(303, '/');
  });

  router.get('/reports/:id/download.html', async (req, res) => {
    const report = await loadOr404(req, res);
    if (!report) return;
    const css = await fs.readFile(path.join(publicDir, 'css', 'report.css'), 'utf8');
    const name = `report-${safeFilePart(report.miner.serialNumber)}-${report.reportDate}.html`;
    res.attachment(name);
    res.render('standalone', {
      title: `Report ${report.miner.serialNumber}`,
      report,
      evaluation: evaluateReport(report),
      schema,
      css,
    });
  });

  router.get('/reports/:id/download.json', async (req, res) => {
    const report = await loadOr404(req, res);
    if (!report) return;
    const name = `report-${safeFilePart(report.miner.serialNumber)}-${report.reportDate}.json`;
    res.attachment(name);
    res.type('application/json').send(JSON.stringify(report, null, 2) + '\n');
  });

  return router;
};
