'use strict';

const fs = require('node:fs');
const { HASHBOARD_COUNT } = require('./schema');

// Temperature/delta metrics: a value above `warn` warns, above `fail` fails.
const MAX_METRICS = {
  hashboards: ['avgPcbTempC', 'pcbTempDeltaC', 'avgChipTempC', 'chipTempDeltaC'],
  psu: ['pfcTempC', 'avgLlcTempC', 'llcTempDeltaC'],
};

const STATUS_RANK = { na: 0, ok: 1, warn: 2, fail: 3 };

// Read from disk on every call so edits to the config apply without a restart.
function loadThresholds(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function findModelConfig(config, model) {
  const models = config.models || {};
  const wanted = String(model || '').trim().toLowerCase();
  const key = Object.keys(models).find((name) => name.trim().toLowerCase() === wanted);
  return key ? models[key] : {};
}

// Per-model entries override the defaults metric by metric.
function resolveLimits(config, model) {
  return { ...(config.default || {}), ...findModelConfig(config, model) };
}

function checkMax(value, limit) {
  if (value === null || value === undefined) return { status: 'na' };
  if (!limit) return { status: 'ok' };
  if (limit.fail !== undefined && value > limit.fail) {
    return { status: 'fail', detail: `Above fail limit of ${limit.fail}` };
  }
  if (limit.warn !== undefined && value > limit.warn) {
    return { status: 'warn', detail: `Above warning limit of ${limit.warn}` };
  }
  return { status: 'ok' };
}

function checkHashrate(value, expected, limit) {
  if (value === null || value === undefined) return { status: 'na' };
  if (!expected || !limit) return { status: 'ok' };
  // Round so float noise (e.g. 60 / (200 / 3) -> 89.999…) can't trip a limit.
  const pct = Math.round((value / expected) * 10000) / 100;
  const detail = `${pct.toFixed(1)}% of expected ${+expected.toFixed(2)} TH/s`;
  if (limit.fail !== undefined && pct < limit.fail) return { status: 'fail', detail, pct };
  if (limit.warn !== undefined && pct < limit.warn) return { status: 'warn', detail, pct };
  return { status: 'ok', detail, pct };
}

/**
 * Evaluate a report against the threshold config.
 * Returns { overall, expectedHashrateTHs, fields } where fields maps a field
 * path (e.g. "hashboards.2.avgChipTempC") to { status, detail? }.
 * status is one of ok | warn | fail | na (value not recorded).
 */
function evaluate(report, config) {
  const limits = resolveLimits(config, report.miner.model);
  const expected = Number.isFinite(limits.expectedHashrateTHs) ? limits.expectedHashrateTHs : null;
  const fields = {};

  fields['miner.hashrateTHs'] = checkHashrate(report.miner.hashrateTHs, expected, limits.hashrateMinPct);

  report.hashboards.forEach((board, slot) => {
    const boardExpected = expected === null ? null : expected / HASHBOARD_COUNT;
    fields[`hashboards.${slot}.hashrateTHs`] =
      checkHashrate(board.hashrateTHs, boardExpected, limits.hashrateMinPct);
    for (const key of MAX_METRICS.hashboards) {
      fields[`hashboards.${slot}.${key}`] = checkMax(board[key], limits[key]);
    }
  });

  for (const key of MAX_METRICS.psu) {
    fields[`psu.${key}`] = checkMax(report.psu[key], limits[key]);
  }

  const worst = Object.values(fields).reduce(
    (acc, { status }) => (STATUS_RANK[status] > STATUS_RANK[acc] ? status : acc), 'na');
  const overall = worst === 'fail' ? 'fail' : worst === 'warn' ? 'warn' : 'pass';

  return { overall, expectedHashrateTHs: expected, fields };
}

module.exports = { loadThresholds, resolveLimits, evaluate };
