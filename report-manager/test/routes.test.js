'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../src/app');

async function startApp(t) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'report-routes-'));
  const server = createApp({ dataDir }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(async () => {
    server.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (url, fields) => fetch(base + url, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
  });
  return { base, post, dataDir };
}

const formFields = {
  reportDate: '2026-11-09',
  source: 'manual',
  'miner[serialNumber]': 'SN-ROUTE-1',
  'miner[model]': 'Antminer S21',
  'miner[hashrateTHs]': '170',
  'miner[runTime][days]': '1',
  'miner[runTime][hours]': '2',
  'miner[runTime][minutes]': '',
  'hashboards[2][slot]': '2',
  'hashboards[2][avgChipTempC]': '99',
  'psu[pfcTempC]': '50',
  notes: '<script>alert(1)</script>',
};

test('full report lifecycle over HTTP', async (t) => {
  const { base, post, dataDir } = await startApp(t);

  const created = await post('/reports', formFields);
  assert.equal(created.status, 303);
  const location = created.headers.get('location');
  const id = /\/reports\/([0-9a-f-]+)\?saved=1/.exec(location)[1];

  const stored = JSON.parse(await fs.readFile(path.join(dataDir, `${id}.json`), 'utf8'));
  assert.equal(stored.miner.runTimeSeconds, 26 * 3600);
  assert.equal(stored.hashboards[2].avgChipTempC, 99);
  assert.equal(stored.hashboards[0].avgChipTempC, null);

  const view = await (await fetch(base + location)).text();
  assert.match(view, /SN-ROUTE-1/);
  assert.match(view, /badge-fail/);
  assert.match(view, /1d 2h 0m/);
  assert.ok(!view.includes('<script>alert(1)</script>'), 'notes must be escaped');

  const list = await (await fetch(`${base}/?q=route`)).text();
  assert.match(list, new RegExp(`/reports/${id}`));
  const filtered = await (await fetch(`${base}/?status=pass`)).text();
  assert.ok(!filtered.includes(`/reports/${id}`));

  const edit = await (await fetch(`${base}/reports/${id}/edit`)).text();
  assert.match(edit, /name="miner\[runTime\]\[days\]" value="1"/);

  const updated = await post(`/reports/${id}`, { ...formFields, 'miner[hashrateTHs]': '199' });
  assert.equal(updated.status, 303);
  const after = JSON.parse(await fs.readFile(path.join(dataDir, `${id}.json`), 'utf8'));
  assert.equal(after.miner.hashrateTHs, 199);
  assert.equal(after.createdAt, stored.createdAt);

  const html = await fetch(`${base}/reports/${id}/download.html`);
  assert.match(html.headers.get('content-disposition'), /attachment; filename="?report-SN-ROUTE-1-2026-11-09\.html"?/);
  const htmlBody = await html.text();
  assert.match(htmlBody, /<style>/);
  assert.ok(!htmlBody.includes('/css/report.css'), 'standalone download must inline its CSS');

  const json = await fetch(`${base}/reports/${id}/download.json`);
  assert.equal((await json.json()).id, id);

  const deleted = await post(`/reports/${id}/delete`, {});
  assert.equal(deleted.status, 303);
  assert.equal((await fetch(`${base}/reports/${id}`)).status, 404);
});

test('invalid form input re-renders with errors and keeps values', async (t) => {
  const { post, dataDir } = await startApp(t);
  const res = await post('/reports', {
    ...formFields,
    'miner[serialNumber]': '',
    'hashboards[1][avgPcbTempC]': 'hot',
  });
  assert.equal(res.status, 422);
  const body = await res.text();
  assert.match(body, /Serial Number is required/);
  assert.match(body, /Average PCB Temp must be a number/);
  assert.match(body, /name="miner\[model\]" type="text" maxlength="200" value="Antminer S21"/);
  assert.match(body, /value="hot"/);
  assert.deepEqual(await fs.readdir(dataDir), []);
});

test('unknown and malformed ids return 404', async (t) => {
  const { base } = await startApp(t);
  assert.equal((await fetch(`${base}/reports/00000000-0000-4000-8000-000000000000`)).status, 404);
  assert.equal((await fetch(`${base}/reports/..%2F..%2Fpackage`)).status, 404);
  assert.equal((await fetch(`${base}/nope`)).status, 404);
});
