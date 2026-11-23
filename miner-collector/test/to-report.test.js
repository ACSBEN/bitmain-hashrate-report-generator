'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalize } = require('../src/vnish/normalize');
const { snapshotToReport } = require('../src/to-report');
const { normalizeReport } = require('../../report-manager/src/schema');
const { fixtureResult } = require('./helpers');

function fixtureReport() {
  const snapshot = normalize(fixtureResult(), { capturedAt: '2026-11-23T15:40:12.000Z' });
  return snapshotToReport(snapshot, { snapshotName: 'PIEMFKUBDJHJG00KG_2026-11-23T15-40-12Z' });
}

test('the generated report passes report-manager validation', () => {
  const { errors, value } = normalizeReport(fixtureReport());
  assert.deepEqual(errors, {});
  assert.equal(value.source, 'api');
  assert.equal(value.hashboards.length, 3);
});

test('miner fields come from info, the average hashrate and uptime', () => {
  const report = fixtureReport();
  assert.deepEqual(report.miner, {
    serialNumber: 'PIEMFKUBDJHJG00KG',
    model: 'Antminer S21 Pro',
    firmwareVersion: 'Vnish 1.3.5',
    hashrateTHs: 151.983,
    runTimeSeconds: 4020,
  });
  assert.match(report.notes, /192\.168\.0\.103/);
  assert.match(report.reportDate, /^\d{4}-\d{2}-\d{2}$/);
});

test('board temps are the mean and spread of the four sensors', () => {
  const [b1, b2, b3] = fixtureReport().hashboards;
  // Board 1 sensors: PCB 49/32/50/51, chip 64/47/65/66.
  assert.deepEqual(b1, {
    serialNumber: null,
    model: null,
    hashrateTHs: 50.812,
    avgPcbTempC: 45.5,
    pcbTempDeltaC: 19,
    avgChipTempC: 60.5,
    chipTempDeltaC: 19,
  });
  assert.equal(b2.serialNumber, null);
  assert.equal(b3.serialNumber, 'SMTTYSCBDJFAA01M9');
  assert.equal(b3.model, 'A3HB70601');
});

test('PSU LLC temps are averaged and diffed', () => {
  assert.deepEqual(fixtureReport().psu, { pfcTempC: 25, avgLlcTempC: 28, llcTempDeltaC: 0 });
});
