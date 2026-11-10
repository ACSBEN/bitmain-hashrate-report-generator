'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../src/app');
const { createStore } = require('../src/store');
const { METRICS } = require('../src/thresholds');

// A fixed copy, so tests don't depend on whatever the live config is set to.
const CONFIG = path.join(__dirname, 'fixtures', 'thresholds.json');

async function startApp(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'report-settings-'));
  const dataDir = path.join(dir, 'reports');
  const thresholdsFile = path.join(dir, 'thresholds.json');
  await fs.copyFile(CONFIG, thresholdsFile);
  const server = createApp({ dataDir, thresholdsFile }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(async () => {
    server.close();
    await fs.rm(dir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (url, fields) => fetch(base + url, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
  });
  const readConfig = async () => JSON.parse(await fs.readFile(thresholdsFile, 'utf8'));
  return { base, post, readConfig, store: createStore(dataDir) };
}

// Mirror what the browser submits for the global table.
function globalForm(config, changes = {}) {
  const fields = {};
  for (const { key } of METRICS) {
    const limit = { enabled: true, ...config.default[key], ...changes[key] };
    if (limit.enabled !== false) fields[`default[${key}][enabled]`] = 'on';
    fields[`default[${key}][warn]`] = String(limit.warn ?? '');
    fields[`default[${key}][fail]`] = String(limit.fail ?? '');
  }
  return fields;
}

test('disabling a global check changes report status', async (t) => {
  const { base, post, readConfig, store } = await startApp(t);
  const report = await store.create({
    miner: { serialNumber: 'HOT1', model: 'Antminer S21' },
    hashboards: [{ avgChipTempC: 99 }],
  });
  assert.match(await (await fetch(`${base}/reports/${report.id}`)).text(), /badge badge-fail/);

  const res = await post('/settings/thresholds', globalForm(await readConfig(), { avgChipTempC: { enabled: false } }));
  assert.equal(res.status, 303);
  const saved = await readConfig();
  assert.equal(saved.default.avgChipTempC.enabled, false);
  assert.equal(saved.default.avgChipTempC.fail, 95, 'limits are kept while disabled');
  assert.equal(saved.models['Antminer S21'].expectedHashrateTHs, 200, 'models untouched');

  const view = await (await fetch(`${base}/reports/${report.id}`)).text();
  assert.match(view, /badge badge-pass/);
  assert.ok(!view.includes('st-fail'));
});

test('invalid global limits re-render with errors and keep input', async (t) => {
  const { post, readConfig } = await startApp(t);
  const before = await readConfig();
  const res = await post('/settings/thresholds', globalForm(before, { pfcTempC: { warn: 99, fail: 90 } }));
  assert.equal(res.status, 422);
  const body = await res.text();
  assert.match(body, /PFC Temp: warning limit must not be above the fail limit/);
  assert.match(body, /name="default\[pfcTempC\]\[warn\]"\s+value="99"/);
  assert.deepEqual(await readConfig(), before);
});

test('add, edit with overrides, rename and delete a model', async (t) => {
  const { base, post, readConfig, store } = await startApp(t);
  const report = await store.create({
    miner: { serialNumber: 'S23-1', model: 'antminer s23', hashrateTHs: 310 },
    psu: { pfcTempC: 85 },
  });

  assert.equal((await post('/settings/thresholds/models', { name: 'Antminer S23', expectedHashrateTHs: '330' })).status, 303);
  assert.equal((await readConfig()).models['Antminer S23'].expectedHashrateTHs, 330);
  // 310 / 330 = 93.9% -> warn; PFC 85 > 80 -> warn.
  assert.match(await (await fetch(`${base}/reports/${report.id}`)).text(), /badge badge-warn/);

  const dup = await post('/settings/thresholds/models', { name: ' ANTMINER S23 ', expectedHashrateTHs: '1' });
  assert.equal(dup.status, 422);
  assert.match(await dup.text(), /already exists/);

  const editUrl = `/settings/thresholds/models/${encodeURIComponent('Antminer S23')}`;
  const edit = await (await fetch(`${base}${editUrl}/edit`)).text();
  assert.match(edit, /value="Antminer S23"/);

  const saved = await post(editUrl, {
    name: 'Antminer S23 Hyd',
    expectedHashrateTHs: '300',
    'metrics[pfcTempC][mode]': 'off',
    'metrics[avgChipTempC][mode]': 'custom',
    'metrics[avgChipTempC][warn]': '90',
    'metrics[avgChipTempC][fail]': '100',
    'metrics[avgPcbTempC][mode]': 'inherit',
    'metrics[avgPcbTempC][warn]': '1',
  });
  assert.equal(saved.status, 303);
  const config = await readConfig();
  assert.equal(config.models['Antminer S23'], undefined);
  assert.deepEqual(config.models['Antminer S23 Hyd'], {
    expectedHashrateTHs: 300,
    avgChipTempC: { enabled: true, warn: 90, fail: 100 },
    pfcTempC: { enabled: false },
  });

  const bad = await post(`/settings/thresholds/models/${encodeURIComponent('Antminer S23 Hyd')}`, {
    name: 'Antminer S21',
    'metrics[avgChipTempC][mode]': 'custom',
    'metrics[avgChipTempC][warn]': '100',
    'metrics[avgChipTempC][fail]': '90',
  });
  assert.equal(bad.status, 422);
  const badBody = await bad.text();
  assert.match(badBody, /already exists/);
  assert.match(badBody, /Average Chip Temp: warning limit must not be above the fail limit/);

  const del = await post(`/settings/thresholds/models/${encodeURIComponent('antminer s23 hyd')}/delete`, {});
  assert.equal(del.status, 303);
  assert.equal((await readConfig()).models['Antminer S23 Hyd'], undefined);
  assert.equal((await fetch(`${base}${editUrl}/edit`)).status, 404);
});

test('settings page lists checks and models', async (t) => {
  const { base } = await startApp(t);
  const page = await (await fetch(`${base}/settings/thresholds`)).text();
  for (const { label } of METRICS) assert.ok(page.includes(label), label);
  assert.match(page, /Antminer S19j Pro/);
  assert.match(page, /class="nav-link active" href="\/settings\/thresholds"/);
});
