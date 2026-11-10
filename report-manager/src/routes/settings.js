'use strict';

const express = require('express');
const {
  METRICS,
  loadThresholds,
  saveThresholds,
  findModelName,
  normalizeModel,
  normalizeThresholds,
  validateModelName,
} = require('../thresholds');

const BASE = '/settings/thresholds';
const modelUrl = (name) => `${BASE}/models/${encodeURIComponent(name)}`;
const MODES = ['inherit', 'custom', 'off'];

// Global form: one row per metric. An unchecked checkbox is simply absent.
function globalFormToRaw(body) {
  const rows = (body && body.default) || {};
  const raw = {};
  for (const { key } of METRICS) {
    const row = rows[key] || {};
    raw[key] = { enabled: row.enabled !== undefined, warn: row.warn, fail: row.fail };
  }
  return raw;
}

// Model form: each metric is inherit (no override), custom, or off. Limits
// typed while "off" are kept so switching back to custom restores them.
function modelFormToRaw(body) {
  const rows = (body && body.metrics) || {};
  const raw = { expectedHashrateTHs: body.expectedHashrateTHs };
  for (const { key } of METRICS) {
    const row = rows[key] || {};
    if (row.mode === 'custom') raw[key] = { enabled: true, warn: row.warn, fail: row.fail };
    if (row.mode === 'off') raw[key] = { enabled: false, warn: row.warn, fail: row.fail };
  }
  return raw;
}

function modelToForm(name, entry, defaults) {
  const metrics = {};
  for (const { key } of METRICS) {
    const override = entry[key];
    const mode = !override ? 'inherit' : override.enabled === false ? 'off' : 'custom';
    metrics[key] = {
      mode,
      warn: override?.warn ?? defaults[key].warn ?? '',
      fail: override?.fail ?? defaults[key].fail ?? '',
    };
  }
  return { name, expectedHashrateTHs: entry.expectedHashrateTHs ?? '', metrics };
}

function describeOverrides(entry) {
  const off = METRICS.filter((m) => entry[m.key]?.enabled === false).map((m) => m.label);
  const custom = METRICS.filter((m) => entry[m.key] && entry[m.key].enabled !== false).map((m) => m.label);
  return { off, custom };
}

module.exports = function settingsRoutes({ thresholdsFile }) {
  const router = express.Router();

  // Always work from a validated copy so a hand-edited file with gaps
  // still renders and saves cleanly.
  function loadConfig() {
    return normalizeThresholds(loadThresholds(thresholdsFile)).value;
  }

  function renderIndex(res, { config, form, errors = {}, addForm = {}, addErrors = {}, saved = false, status = 200 }) {
    res.status(status).render('thresholds', {
      title: 'Thresholds',
      metrics: METRICS,
      form,
      errors,
      models: Object.entries(config.models).map(([name, entry]) => ({
        name, entry, url: modelUrl(name), ...describeOverrides(entry),
      })),
      addForm,
      addErrors,
      saved,
    });
  }

  function renderModel(res, { form, errors = {}, defaults, originalName, status = 200 }) {
    res.status(status).render('threshold-model', {
      title: originalName ? `Thresholds: ${originalName}` : 'Thresholds',
      metrics: METRICS,
      modes: MODES,
      form,
      errors,
      defaults,
      action: modelUrl(originalName),
    });
  }

  router.get(BASE, (req, res) => {
    const config = loadConfig();
    renderIndex(res, { config, form: config.default, saved: req.query.saved === '1' });
  });

  router.post(BASE, async (req, res) => {
    const current = loadConfig();
    const rawDefaults = globalFormToRaw(req.body);
    const { value, errors } = normalizeThresholds({ default: rawDefaults, models: current.models });
    if (Object.keys(errors).length > 0) {
      return renderIndex(res, { config: current, form: rawDefaults, errors, status: 422 });
    }
    await saveThresholds(thresholdsFile, value);
    res.redirect(303, `${BASE}?saved=1`);
  });

  router.post(`${BASE}/models`, async (req, res) => {
    const config = loadConfig();
    const errors = {};
    const name = validateModelName(req.body.name, Object.keys(config.models), errors);
    const entry = normalizeModel({ expectedHashrateTHs: req.body.expectedHashrateTHs }, config.default, errors);
    if (Object.keys(errors).length > 0) {
      return renderIndex(res, {
        config, form: config.default, addForm: req.body, addErrors: errors, status: 422,
      });
    }
    await saveThresholds(thresholdsFile, {
      default: config.default,
      models: { ...config.models, [name]: entry },
    });
    res.redirect(303, `${BASE}?saved=1`);
  });

  function loadModelOr404(req, res) {
    const config = loadConfig();
    const name = findModelName(config, req.params.name);
    if (!name) {
      res.status(404).render('error', { title: 'Model not found', message: 'No threshold settings exist for that model.' });
      return null;
    }
    return { config, name };
  }

  router.get(`${BASE}/models/:name/edit`, (req, res) => {
    const found = loadModelOr404(req, res);
    if (!found) return;
    const { config, name } = found;
    renderModel(res, {
      form: modelToForm(name, config.models[name], config.default),
      defaults: config.default,
      originalName: name,
    });
  });

  router.post(`${BASE}/models/:name`, async (req, res) => {
    const found = loadModelOr404(req, res);
    if (!found) return;
    const { config, name: originalName } = found;
    const errors = {};
    const others = Object.keys(config.models).filter((n) => n !== originalName);
    const name = validateModelName(req.body.name, others, errors);
    const entry = normalizeModel(modelFormToRaw(req.body), config.default, errors);
    if (Object.keys(errors).length > 0) {
      return renderModel(res, {
        form: { name: req.body.name, expectedHashrateTHs: req.body.expectedHashrateTHs, metrics: req.body.metrics || {} },
        errors,
        defaults: config.default,
        originalName,
        status: 422,
      });
    }
    // Rebuild in place so a rename keeps the model's position in the list.
    const models = {};
    for (const [key, value] of Object.entries(config.models)) {
      if (key === originalName) models[name] = entry;
      else models[key] = value;
    }
    await saveThresholds(thresholdsFile, { default: config.default, models });
    res.redirect(303, `${BASE}?saved=1`);
  });

  router.post(`${BASE}/models/:name/delete`, async (req, res) => {
    const found = loadModelOr404(req, res);
    if (!found) return;
    const { config, name } = found;
    const { [name]: _removed, ...models } = config.models;
    await saveThresholds(thresholdsFile, { default: config.default, models });
    res.redirect(303, `${BASE}?saved=1`);
  });

  return router;
};
