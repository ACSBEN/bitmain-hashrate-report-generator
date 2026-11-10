'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeReport } = require('../src/schema');
const { evaluate } = require('../src/thresholds');

const config = {
  default: {
    hashrateMinPct: { warn: 95, fail: 90 },
    avgChipTempC: { warn: 85, fail: 95 },
    pfcTempC: { warn: 80, fail: 90 },
  },
  models: {
    'Antminer S21': { expectedHashrateTHs: 200 },
    'Hot Model': { expectedHashrateTHs: 100, avgChipTempC: { warn: 90, fail: 100 } },
  },
};

const build = (overrides) => normalizeReport({
  miner: { serialNumber: 'SN', model: 'Antminer S21', hashrateTHs: 200, ...overrides.miner },
  hashboards: overrides.hashboards,
  psu: overrides.psu,
}).value;

test('passes when everything is within limits', () => {
  const result = evaluate(build({ hashboards: [{ hashrateTHs: 66.7, avgChipTempC: 70 }] }), config);
  assert.equal(result.overall, 'pass');
  assert.equal(result.expectedHashrateTHs, 200);
  assert.equal(result.fields['hashboards.0.avgChipTempC'].status, 'ok');
  assert.equal(result.fields['hashboards.1.avgChipTempC'].status, 'na');
});

test('flags low hashrate by percent of expected', () => {
  assert.equal(evaluate(build({ miner: { hashrateTHs: 185 } }), config).fields['miner.hashrateTHs'].status, 'warn');
  const result = evaluate(build({ miner: { hashrateTHs: 170 } }), config);
  assert.equal(result.fields['miner.hashrateTHs'].status, 'fail');
  assert.equal(result.overall, 'fail');
  // Board expected = 200 / 3; 60 TH/s is 90% -> warn, not fail.
  const board = evaluate(build({ hashboards: [{ hashrateTHs: 60 }] }), config);
  assert.equal(board.fields['hashboards.0.hashrateTHs'].status, 'warn');
});

test('flags temperatures above warn and fail limits', () => {
  const result = evaluate(build({
    hashboards: [{ avgChipTempC: 85 }, { avgChipTempC: 86 }, { avgChipTempC: 96 }],
    psu: { pfcTempC: 81 },
  }), config);
  assert.equal(result.fields['hashboards.0.avgChipTempC'].status, 'ok');
  assert.equal(result.fields['hashboards.1.avgChipTempC'].status, 'warn');
  assert.equal(result.fields['hashboards.2.avgChipTempC'].status, 'fail');
  assert.equal(result.fields['psu.pfcTempC'].status, 'warn');
  assert.equal(result.overall, 'fail');
});

test('model overrides apply case-insensitively', () => {
  const result = evaluate(build({
    miner: { model: '  hot model ', hashrateTHs: 100 },
    hashboards: [{ avgChipTempC: 92 }],
  }), config);
  assert.equal(result.expectedHashrateTHs, 100);
  assert.equal(result.fields['hashboards.0.avgChipTempC'].status, 'warn');
});

test('unknown model still checks temps but not hashrate', () => {
  const result = evaluate(build({ miner: { model: 'Mystery', hashrateTHs: 1 }, psu: { pfcTempC: 95 } }), config);
  assert.equal(result.expectedHashrateTHs, null);
  assert.equal(result.fields['miner.hashrateTHs'].status, 'ok');
  assert.equal(result.fields['psu.pfcTempC'].status, 'fail');
});
