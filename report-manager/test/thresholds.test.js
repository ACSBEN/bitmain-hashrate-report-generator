'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeReport } = require('../src/schema');
const { evaluate, normalizeThresholds } = require('../src/thresholds');

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

test('a globally disabled check reports off and never affects overall status', () => {
  const off = { ...config, default: { ...config.default, avgChipTempC: { enabled: false, warn: 85, fail: 95 } } };
  const result = evaluate(build({ hashboards: [{ avgChipTempC: 120 }] }), off);
  assert.equal(result.fields['hashboards.0.avgChipTempC'].status, 'off');
  assert.equal(result.overall, 'pass');
});

test('a model can disable one check or enable one that is off globally', () => {
  const cfg = {
    default: {
      avgChipTempC: { warn: 85, fail: 95 },
      pfcTempC: { enabled: false, warn: 80, fail: 90 },
    },
    models: {
      'Antminer S21': {
        expectedHashrateTHs: 200,
        avgChipTempC: { enabled: false },
        pfcTempC: { enabled: true },
      },
      Other: {},
    },
  };
  const hot = { hashboards: [{ avgChipTempC: 120 }], psu: { pfcTempC: 95 } };
  const s21 = evaluate(build(hot), cfg);
  assert.equal(s21.fields['hashboards.0.avgChipTempC'].status, 'off');
  // Re-enabled for this model; inherits the global limits.
  assert.equal(s21.fields['psu.pfcTempC'].status, 'fail');

  const other = evaluate(build({ ...hot, miner: { model: 'Other' } }), cfg);
  assert.equal(other.fields['hashboards.0.avgChipTempC'].status, 'fail');
  assert.equal(other.fields['psu.pfcTempC'].status, 'off');
});

test('partial model overrides merge with global limits', () => {
  const cfg = {
    default: { avgChipTempC: { warn: 85, fail: 95 } },
    models: { 'Antminer S21': { avgChipTempC: { fail: 88 } } },
  };
  const result = evaluate(build({ hashboards: [{ avgChipTempC: 86 }, { avgChipTempC: 89 }] }), cfg);
  assert.equal(result.fields['hashboards.0.avgChipTempC'].status, 'warn');
  assert.equal(result.fields['hashboards.1.avgChipTempC'].status, 'fail');
});

test('normalizeThresholds validates limits and model names', () => {
  const { errors } = normalizeThresholds({
    default: {
      avgChipTempC: { warn: 99, fail: 90 },
      hashrateMinPct: { warn: 90, fail: 95 },
      pfcTempC: { warn: 'hot', fail: 90 },
      avgPcbTempC: { enabled: true },
    },
    models: {
      'Antminer S21': { expectedHashrateTHs: -5 },
      'antminer s21 ': {},
    },
  });
  assert.ok(errors['default.avgChipTempC.warn']);
  assert.ok(errors['default.hashrateMinPct.fail']);
  assert.ok(errors['default.pfcTempC.warn']);
  assert.ok(errors['default.avgPcbTempC.warn']);
  assert.ok(errors['models.Antminer S21.expectedHashrateTHs']);
  assert.ok(errors['models.antminer s21 .name']);
});

test('normalizeThresholds keeps limits for disabled checks and drops blanks', () => {
  const { value, errors } = normalizeThresholds({
    default: { avgChipTempC: { enabled: false, warn: 85, fail: '' } },
    models: { S21: { expectedHashrateTHs: '200', avgChipTempC: { enabled: 'false' } } },
  });
  assert.deepEqual(errors, {});
  assert.deepEqual(value.default.avgChipTempC, { enabled: false, warn: 85 });
  // Checks missing from the file come back switched off.
  assert.deepEqual(value.default.pfcTempC, { enabled: false });
  assert.deepEqual(value.models.S21, { expectedHashrateTHs: 200, avgChipTempC: { enabled: false } });
});
