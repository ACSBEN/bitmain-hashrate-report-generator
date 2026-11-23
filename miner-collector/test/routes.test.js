'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../src/app');
const { stubFetch } = require('./helpers');

async function startApp(t, { fetchImpl = stubFetch() } = {}) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'collector-routes-'));
  const snapshotDir = path.join(tmp, 'snapshots');
  const reportsDir = path.join(tmp, 'reports');
  const server = createApp({ snapshotDir, reportsDir, fetchImpl, timeoutMs: 500 }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(async () => {
    server.close();
    await fs.rm(tmp, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (url, fields = {}) => fetch(base + url, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
  });
  return { base, post, snapshotDir, reportsDir };
}

test('GET / shows the IP form', async (t) => {
  const { base } = await startApp(t);
  const res = await fetch(base + '/');
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /name="host"/);
  assert.match(html, /No snapshots yet/);
});

test('collecting saves a snapshot and shows the success screen', async (t) => {
  const { base, post, snapshotDir } = await startApp(t);
  const res = await post('/collect', { host: '192.168.0.103' });
  assert.equal(res.status, 303);
  const location = res.headers.get('location');
  assert.match(location, /^\/snapshots\/PIEMFKUBDJHJG00KG_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z$/);

  const files = await fs.readdir(snapshotDir);
  assert.equal(files.length, 1);
  const saved = JSON.parse(await fs.readFile(path.join(snapshotDir, files[0]), 'utf8'));
  assert.equal(saved.miner.serialNumber, 'PIEMFKUBDJHJG00KG');
  assert.deepEqual(saved.errors, {});

  const page = await fetch(base + location);
  assert.equal(page.status, 200);
  const html = await page.text();
  for (const heading of ['Overview', 'Hashboards', 'Board 1', 'Board 3', 'PSU', 'Cooling', 'Pools', 'System &amp; network', 'Tuning', 'Logs']) {
    assert.ok(html.includes(heading), `missing section: ${heading}`);
  }
  assert.match(html, /PW380X1215GA-c/);
  assert.match(html, /class="cell grade-orange/);

  const download = await fetch(base + location + '/download.json');
  assert.equal(download.status, 200);
  assert.match(download.headers.get('content-disposition'), /attachment/);
  assert.equal((await download.json()).miner.model, 'Antminer S21 Pro');

  const index = await (await fetch(base + '/')).text();
  assert.match(index, /PIEMFKUBDJHJG00KG/);
});

test('a failing section is recorded but does not stop the collection', async (t) => {
  const fetchImpl = stubFetch({ '/summary': () => new Response('boom', { status: 500 }) });
  const { base, post } = await startApp(t, { fetchImpl });
  const res = await post('/collect', { host: '192.168.0.103' });
  assert.equal(res.status, 303);
  const html = await (await fetch(base + res.headers.get('location'))).text();
  assert.match(html, /could not be read/);
  assert.match(html, /HTTP 500/);
});

test('an invalid address is rejected without fetching', async (t) => {
  let called = false;
  const { post } = await startApp(t, { fetchImpl: async () => { called = true; } });
  const res = await post('/collect', { host: 'http://evil/../x' });
  assert.equal(res.status, 400);
  assert.match(await res.text(), /not a valid IP address/);
  assert.equal(called, false);
});

test('an unreachable miner shows a friendly error', async (t) => {
  const fetchImpl = async () => {
    throw new TypeError('fetch failed', { cause: Object.assign(new Error('connect'), { code: 'EHOSTUNREACH' }) });
  };
  const { post } = await startApp(t, { fetchImpl });
  const res = await post('/collect', { host: '192.168.0.250' });
  assert.equal(res.status, 502);
  const html = await res.text();
  assert.match(html, /Could not read miner info from 192\.168\.0\.250: host unreachable/);
  assert.match(html, /value="192\.168\.0\.250"/);
});

test('a host that is not a Vnish miner is rejected', async (t) => {
  const fetchImpl = async () => new Response('<html>router login</html>');
  const { post } = await startApp(t, { fetchImpl });
  const res = await post('/collect', { host: '192.168.0.1' });
  assert.equal(res.status, 502);
  assert.match(await res.text(), /doesn(&#39;|')t look like a Vnish miner/);
});

test('Create report writes a valid report and links the snapshot to it', async (t) => {
  const { base, post, reportsDir } = await startApp(t);
  const location = (await post('/collect', { host: '192.168.0.103' })).headers.get('location');

  const res = await post(`${location}/report`);
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), `${location}?created=1`);

  const files = (await fs.readdir(reportsDir)).filter((f) => f.endsWith('.json'));
  assert.equal(files.length, 1);
  const report = JSON.parse(await fs.readFile(path.join(reportsDir, files[0]), 'utf8'));
  assert.equal(report.source, 'api');
  assert.equal(report.miner.serialNumber, 'PIEMFKUBDJHJG00KG');
  assert.equal(report.hashboards[0].avgPcbTempC, 45.5);

  const html = await (await fetch(base + location + '?created=1')).text();
  assert.match(html, /Report created/);
  assert.ok(html.includes(`/reports/${report.id}`));

  // A second click doesn't create a duplicate.
  await post(`${location}/report`);
  assert.equal((await fs.readdir(reportsDir)).filter((f) => f.endsWith('.json')).length, 1);
});

test('unknown or malformed snapshot names are 404s', async (t) => {
  const { base } = await startApp(t);
  assert.equal((await fetch(base + '/snapshots/nope')).status, 404);
  assert.equal((await fetch(base + '/snapshots/..%2F..%2Fpackage')).status, 404);
  assert.equal((await fetch(base + '/snapshots/ABC_2026-01-01T00-00-00Z')).status, 404);
});
