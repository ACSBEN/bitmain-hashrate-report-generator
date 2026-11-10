'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeReport } = require('../src/schema');

const minimal = { miner: { serialNumber: 'SN1', model: 'Antminer S21' } };

test('fills defaults and exactly three hashboards', () => {
  const { value, errors } = normalizeReport(minimal);
  assert.deepEqual(errors, {});
  assert.equal(value.schemaVersion, 1);
  assert.equal(value.source, 'manual');
  assert.match(value.reportDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(value.hashboards.length, 3);
  assert.deepEqual(value.hashboards.map((b) => b.slot), [0, 1, 2]);
  assert.equal(value.hashboards[1].avgChipTempC, null);
  assert.equal(value.psu.pfcTempC, null);
});

test('requires miner serial number and model', () => {
  const { errors } = normalizeReport({ miner: { serialNumber: '  ' } });
  assert.ok(errors['miner.serialNumber']);
  assert.ok(errors['miner.model']);
});

test('coerces numeric strings and treats blanks as not recorded', () => {
  const { value, errors } = normalizeReport({
    ...minimal,
    miner: { ...minimal.miner, hashrateTHs: ' 201.5 ', runTimeSeconds: '3600' },
    hashboards: [{ avgPcbTempC: '58' }, { avgPcbTempC: '' }],
    psu: { pfcTempC: 52 },
  });
  assert.deepEqual(errors, {});
  assert.equal(value.miner.hashrateTHs, 201.5);
  assert.equal(value.miner.runTimeSeconds, 3600);
  assert.equal(value.hashboards[0].avgPcbTempC, 58);
  assert.equal(value.hashboards[1].avgPcbTempC, null);
  assert.equal(value.psu.pfcTempC, 52);
});

test('rejects non-numeric, negative and out-of-range input', () => {
  const { errors } = normalizeReport({
    ...minimal,
    miner: { ...minimal.miner, hashrateTHs: 'fast', runTimeSeconds: 1.5 },
    hashboards: [{}, { pcbTempDeltaC: -2 }, {}, {}],
    reportDate: 'yesterday',
    source: 'carrier pigeon',
  });
  assert.ok(errors['miner.hashrateTHs']);
  assert.ok(errors['miner.runTimeSeconds']);
  assert.ok(errors['hashboards.1.pcbTempDeltaC']);
  assert.ok(errors.hashboards);
  assert.ok(errors.reportDate);
  assert.ok(errors.source);
});

test('accepts full ISO timestamps as report date', () => {
  const { value, errors } = normalizeReport({ ...minimal, reportDate: '2026-11-09T14:30:00Z' });
  assert.deepEqual(errors, {});
  assert.equal(value.reportDate, '2026-11-09');
});

test('expected hashrate is optional but must be above zero', () => {
  assert.equal(normalizeReport(minimal).value.miner.expectedHashrateTHs, null);
  const ok = normalizeReport({ ...minimal, miner: { ...minimal.miner, expectedHashrateTHs: '210' } });
  assert.deepEqual(ok.errors, {});
  assert.equal(ok.value.miner.expectedHashrateTHs, 210);
  for (const bad of ['0', '-5', 'lots']) {
    const { errors } = normalizeReport({ ...minimal, miner: { ...minimal.miner, expectedHashrateTHs: bad } });
    assert.ok(errors['miner.expectedHashrateTHs'], bad);
  }
});
