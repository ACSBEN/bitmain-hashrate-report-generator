'use strict';

const fs = require('node:fs');
const { HASHBOARD_COUNT, HASHBOARD_FIELDS, PSU_FIELDS } = require('./schema');
const { writeJsonAtomic } = require('./fs-util');

const labelOf = (fields, key) => fields.find((f) => f.key === key).label;

// Every check the app can run. `max` metrics flag a value above the limit;
// `minPct` flags hashrate below a percent of the model's expected hashrate.
const METRICS = [
  { key: 'hashrateMinPct', label: 'Hashrate', unit: '% of expected', kind: 'minPct', group: 'Miner & hashboards' },
  ...['avgPcbTempC', 'pcbTempDeltaC', 'avgChipTempC', 'chipTempDeltaC'].map((key) => ({
    key, label: labelOf(HASHBOARD_FIELDS, key), unit: '°C', kind: 'max', group: 'Hashboards',
  })),
  ...['pfcTempC', 'avgLlcTempC', 'llcTempDeltaC'].map((key) => ({
    key, label: labelOf(PSU_FIELDS, key), unit: '°C', kind: 'max', group: 'Power supply',
  })),
];
const MAX_PCT = 200;

const STATUS_RANK = { na: 0, off: 0, ok: 1, warn: 2, fail: 3 };

// Read from disk on every call so edits to the config apply without a restart.
function loadThresholds(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveThresholds(file, config) {
  return writeJsonAtomic(file, config);
}

function findModelName(config, model) {
  const wanted = String(model || '').trim().toLowerCase();
  return Object.keys(config.models || {}).find((name) => name.trim().toLowerCase() === wanted);
}

function findModelConfig(config, model) {
  const name = findModelName(config, model);
  return name ? config.models[name] : {};
}

// Model entries override the defaults key by key within each metric, so a
// model can set just { enabled: false } or just a different fail limit.
function resolveLimits(config, model) {
  const defaults = config.default || {};
  const modelConfig = findModelConfig(config, model);
  const limits = { expectedHashrateTHs: modelConfig.expectedHashrateTHs };
  for (const { key } of METRICS) {
    if (defaults[key] || modelConfig[key]) limits[key] = { ...defaults[key], ...modelConfig[key] };
  }
  return limits;
}

const isEnabled = (limit) => Boolean(limit) && limit.enabled !== false;

function checkMax(value, limit) {
  if (limit && !isEnabled(limit)) return { status: 'off' };
  if (value === null || value === undefined) return { status: 'na' };
  if (!limit) return { status: 'ok' };
  if (limit.fail !== undefined && limit.fail !== null && value > limit.fail) {
    return { status: 'fail', detail: `Above fail limit of ${limit.fail}` };
  }
  if (limit.warn !== undefined && limit.warn !== null && value > limit.warn) {
    return { status: 'warn', detail: `Above warning limit of ${limit.warn}` };
  }
  return { status: 'ok' };
}

function checkHashrate(value, expected, limit) {
  if (limit && !isEnabled(limit)) return { status: 'off' };
  if (value === null || value === undefined) return { status: 'na' };
  if (!expected || !limit) return { status: 'ok' };
  // Round so float noise (e.g. 60 / (200 / 3) -> 89.999…) can't trip a limit.
  const pct = Math.round((value / expected) * 10000) / 100;
  const detail = `${pct.toFixed(1)}% of expected ${+expected.toFixed(2)} TH/s`;
  if (limit.fail !== undefined && limit.fail !== null && pct < limit.fail) return { status: 'fail', detail, pct };
  if (limit.warn !== undefined && limit.warn !== null && pct < limit.warn) return { status: 'warn', detail, pct };
  return { status: 'ok', detail, pct };
}

/**
 * Evaluate a report against the threshold config.
 * Returns { overall, expectedHashrateTHs, expectedSource, fields }, where
 * expectedSource is 'report', 'model' or null, and fields maps a field
 * path (e.g. "hashboards.2.avgChipTempC") to { status, detail? }.
 * status is one of ok | warn | fail | na (value not recorded) | off (check
 * disabled). na and off never affect the overall status.
 */
function evaluate(report, config) {
  const limits = resolveLimits(config, report.miner.model);
  // An expected hashrate set on the report itself overrides the model's.
  const fromReport = Number.isFinite(report.miner.expectedHashrateTHs) ? report.miner.expectedHashrateTHs : null;
  const fromModel = Number.isFinite(limits.expectedHashrateTHs) ? limits.expectedHashrateTHs : null;
  const expected = fromReport ?? fromModel;
  const expectedSource = fromReport !== null ? 'report' : fromModel !== null ? 'model' : null;
  const fields = {};
  const maxKeys = (group) => METRICS.filter((m) => m.group === group).map((m) => m.key);

  fields['miner.hashrateTHs'] = checkHashrate(report.miner.hashrateTHs, expected, limits.hashrateMinPct);

  report.hashboards.forEach((board, slot) => {
    const boardExpected = expected === null ? null : expected / HASHBOARD_COUNT;
    fields[`hashboards.${slot}.hashrateTHs`] =
      checkHashrate(board.hashrateTHs, boardExpected, limits.hashrateMinPct);
    for (const key of maxKeys('Hashboards')) {
      fields[`hashboards.${slot}.${key}`] = checkMax(board[key], limits[key]);
    }
  });

  for (const key of maxKeys('Power supply')) {
    fields[`psu.${key}`] = checkMax(report.psu[key], limits[key]);
  }

  const worst = Object.values(fields).reduce(
    (acc, { status }) => (STATUS_RANK[status] > STATUS_RANK[acc] ? status : acc), 'na');
  const overall = worst === 'fail' ? 'fail' : worst === 'warn' ? 'warn' : 'pass';

  return { overall, expectedHashrateTHs: expected, expectedSource, fields };
}

// ---------------------------------------------------------------------------
// Validation for config edits. Error keys are field paths such as
// "default.avgChipTempC.warn" or "models.Antminer S21.expectedHashrateTHs".

const isBlank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

function parseBool(v) {
  return !(v === false || v === 0 || (typeof v === 'string' && ['false', '0', 'off', ''].includes(v.trim().toLowerCase())));
}

function parseLimitNumber(raw, metric, path, errors) {
  if (isBlank(raw)) return null;
  const num = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(num)) {
    errors[path] = `${metric.label}: must be a number`;
    return null;
  }
  if (metric.kind === 'minPct' && (num < 0 || num > MAX_PCT)) {
    errors[path] = `${metric.label}: must be between 0 and ${MAX_PCT}%`;
    return null;
  }
  return num;
}

// Check the warn/fail pair that will actually be used, after merging.
function checkOrdering(metric, limit, prefix, errors) {
  if (!isEnabled(limit)) return;
  for (const part of ['warn', 'fail']) {
    if (limit[part] === null || limit[part] === undefined) {
      errors[`${prefix}.${part}`] ??= `${metric.label}: ${part} limit is required when the check is enabled`;
    }
  }
  if (limit.warn === null || limit.warn === undefined || limit.fail === null || limit.fail === undefined) return;
  if (metric.kind === 'max' && limit.warn > limit.fail) {
    errors[`${prefix}.warn`] ??= `${metric.label}: warning limit must not be above the fail limit`;
  }
  if (metric.kind === 'minPct' && limit.fail > limit.warn) {
    errors[`${prefix}.fail`] ??= `${metric.label}: fail percent must not be above the warning percent`;
  }
}

// Strip nulls so the saved file only records what was actually set.
function compactLimit(limit) {
  const out = {};
  if (limit.enabled !== undefined) out.enabled = limit.enabled;
  if (limit.warn !== null && limit.warn !== undefined) out.warn = limit.warn;
  if (limit.fail !== null && limit.fail !== undefined) out.fail = limit.fail;
  return out;
}

function normalizeDefaults(raw, errors) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const metric of METRICS) {
    const prefix = `default.${metric.key}`;
    const entry = source[metric.key] && typeof source[metric.key] === 'object' ? source[metric.key] : null;
    // A metric missing from the file is treated as switched off.
    const limit = {
      enabled: entry ? parseBool(entry.enabled ?? true) : false,
      warn: parseLimitNumber(entry?.warn, metric, `${prefix}.warn`, errors),
      fail: parseLimitNumber(entry?.fail, metric, `${prefix}.fail`, errors),
    };
    checkOrdering(metric, limit, prefix, errors);
    out[metric.key] = compactLimit(limit);
  }
  return out;
}

/**
 * Normalize one model entry. Metric overrides are partial; they are checked
 * after merging with `defaults`. `prefix` scopes the error keys.
 */
function normalizeModel(raw, defaults, errors, prefix = '') {
  const source = raw && typeof raw === 'object' ? raw : {};
  const p = (key) => (prefix ? `${prefix}.${key}` : key);
  const out = {};

  if (!isBlank(source.expectedHashrateTHs)) {
    const num = Number(String(source.expectedHashrateTHs).trim());
    if (!Number.isFinite(num) || num <= 0) {
      errors[p('expectedHashrateTHs')] = 'Expected hashrate must be a number above 0';
    } else {
      out.expectedHashrateTHs = num;
    }
  }

  for (const metric of METRICS) {
    const entry = source[metric.key];
    if (!entry || typeof entry !== 'object') continue;
    const override = {};
    if (entry.enabled !== undefined) override.enabled = parseBool(entry.enabled);
    for (const part of ['warn', 'fail']) {
      const num = parseLimitNumber(entry[part], metric, p(`${metric.key}.${part}`), errors);
      if (num !== null) override[part] = num;
    }
    if (Object.keys(override).length === 0) continue;
    checkOrdering(metric, { ...defaults[metric.key], ...override }, p(metric.key), errors);
    out[metric.key] = override;
  }
  return out;
}

function validateModelName(name, otherNames, errors, key = 'name') {
  const trimmed = isBlank(name) ? '' : String(name).trim();
  if (!trimmed) {
    errors[key] = 'Model name is required';
  } else if (trimmed.length > 200) {
    errors[key] = 'Model name must be at most 200 characters';
  } else if (otherNames.some((n) => n.trim().toLowerCase() === trimmed.toLowerCase())) {
    errors[key] = `A model named "${trimmed}" already exists`;
  }
  return trimmed;
}

/** Validate a whole config object. Returns { value, errors }. */
function normalizeThresholds(input) {
  const raw = input && typeof input === 'object' ? input : {};
  const errors = {};
  const defaults = normalizeDefaults(raw.default, errors);
  const models = {};
  for (const [name, entry] of Object.entries(raw.models || {})) {
    const cleanName = validateModelName(name, Object.keys(models), errors, `models.${name}.name`);
    models[cleanName] = normalizeModel(entry, defaults, errors, `models.${name}`);
  }
  return { value: { default: defaults, models }, errors };
}

module.exports = {
  METRICS,
  loadThresholds,
  saveThresholds,
  findModelName,
  resolveLimits,
  evaluate,
  normalizeDefaults,
  normalizeModel,
  normalizeThresholds,
  validateModelName,
};
