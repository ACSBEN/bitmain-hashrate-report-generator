'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalize, parseUptime } = require('../src/vnish/normalize');
const { fixtureResult } = require('./helpers');

const CAPTURED_AT = '2026-11-23T15:40:12.000Z';

test('parseUptime handles the Vnish and Linux uptime formats', () => {
  assert.equal(parseUptime('1:07'), 4020);
  assert.equal(parseUptime('0:05'), 300);
  assert.equal(parseUptime('3 days, 4:05'), 3 * 86400 + 4 * 3600 + 5 * 60);
  assert.equal(parseUptime('1 day,  0:00'), 86400);
  assert.equal(parseUptime('2 days'), 2 * 86400);
  assert.equal(parseUptime('37 min'), 37 * 60);
  assert.equal(parseUptime(125), 125);
});

test('parseUptime returns null for anything it cannot read', () => {
  for (const raw of ['', 'soon', '1:75', '1:02:03', null, undefined, -5, {}]) {
    assert.equal(parseUptime(raw), null, `expected null for ${JSON.stringify(raw)}`);
  }
});

test('normalize maps miner identity, status and performance', () => {
  const s = normalize(fixtureResult(), { capturedAt: CAPTURED_AT });
  assert.equal(s.snapshotVersion, 1);
  assert.equal(s.capturedAt, CAPTURED_AT);
  assert.deepEqual(s.source, { firmware: 'vnish', host: '192.168.0.103' });
  assert.equal(s.miner.model, 'Antminer S21 Pro');
  assert.equal(s.miner.serialNumber, 'PIEMFKUBDJHJG00KG');
  assert.equal(s.miner.firmware.name, 'Vnish');
  assert.equal(s.miner.firmware.version, '1.3.5');
  assert.equal(s.miner.chainCount, 3);
  assert.equal(s.status.state, 'auto-tuning');
  assert.equal(s.status.stateTimeSeconds, 3902);
  // GH/s -> TH/s
  assert.equal(s.performance.hashrate.averageTHs, 151.983);
  assert.equal(s.performance.hashrate.realtimeTHs, 154.529);
  assert.equal(s.performance.powerW, 2092);
  assert.equal(s.performance.efficiencyJTH, 13.76);
  assert.deepEqual(s.performance.chipTempC, { min: 46, max: 66 });
  assert.equal(s.system.uptimeSeconds, 4020);
});

test('normalize merges summary, boards and factory info per hashboard', () => {
  const s = normalize(fixtureResult(), { capturedAt: CAPTURED_AT });
  assert.equal(s.hashboards.length, 3);
  const [b1, , b3] = s.hashboards;
  assert.equal(b1.id, 1);
  assert.equal(b1.slot, 0);
  assert.equal(b1.state, 'mining');
  assert.equal(b1.voltageV, 13.064);
  assert.equal(b1.hashrate.realtimeTHs, 50.812);
  assert.deepEqual(b1.chipStatuses, { red: 0, orange: 1, grey: 64 });
  assert.equal(b1.sensors.length, 4);
  assert.deepEqual(b1.sensors[0], { location: 18, state: 'measure', pcbTempC: 49, chipTempC: 64 });
  assert.equal(b1.chips.length, 65);
  assert.equal(b1.chips[0].tempC, null, 'zero chip temps are treated as not reported');
  // Board 1's EEPROM reads N/A; board 3's is readable.
  assert.equal(b1.factory.serialNumber, null);
  assert.equal(b1.factory.boardModel, null);
  assert.equal(b3.factory.serialNumber, 'SMTTYSCBDJFAA01M9');
  assert.equal(b3.factory.voltageV, 14.38);
  assert.equal(b3.factory.hashrateTHs, 79.03);
});

test('normalize maps PSU, cooling, pools, system, tuning and logs', () => {
  const s = normalize(fixtureResult(), { capturedAt: CAPTURED_AT });
  assert.deepEqual(
    { model: s.psu.model, pfc: s.psu.pfcTempC, llc1: s.psu.llc1TempC, llc2: s.psu.llc2TempC },
    { model: 'PW380X1215GA-c', pfc: 25, llc1: 28, llc2: 28 },
  );
  assert.equal(s.cooling.fans.length, 4);
  assert.equal(s.cooling.fanDutyPct, 35);
  assert.equal(s.pools.length, 2);
  assert.equal(s.pools[0].url, 'btc.global.luxor.tech:700');
  assert.equal(s.pools[0].accepted, 269);
  assert.equal(s.system.network.mac, '02:BF:73:EB:42:FB');
  assert.equal(s.tuning.preset.label, '2500 watt ~ 176 TH');
  assert.equal(s.tuning.presetSwitcher.topPreset, '4690');
  assert.equal(s.tuning.overclockLimits.defaultVoltageV, 13.8);
  assert.equal(s.chipLayout.rows, 13);
  assert.equal(s.chipLayout.cols, 5);
  assert.deepEqual(Object.keys(s.logs).sort(), ['api', 'autotune', 'hwscan', 'messages', 'miner', 'pool', 'status', 'system']);
  assert.match(s.logs.status, /Initializing/);
});

test('normalize tolerates missing sections', () => {
  const result = fixtureResult();
  result.raw.summary = null;
  result.raw.boards = null;
  result.raw.factoryInfo = null;
  result.errors = { summary: 'timed out after 10 s' };
  const s = normalize(result, { capturedAt: CAPTURED_AT });
  assert.equal(s.miner.serialNumber, 'PIEMFKUBDJHJG00KG');
  assert.equal(s.performance.hashrate.averageTHs, null);
  assert.deepEqual(s.hashboards, []);
  assert.deepEqual(s.pools, []);
  assert.equal(s.psu.pfcTempC, null);
  assert.equal(s.errors.summary, 'timed out after 10 s');
});
