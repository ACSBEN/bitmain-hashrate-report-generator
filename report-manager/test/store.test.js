'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createStore, ValidationError } = require('../src/store');

async function tempStore(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'report-store-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return createStore(dir);
}

const input = (serialNumber, reportDate) => ({ reportDate, miner: { serialNumber, model: 'Antminer S21' } });

test('create, get, update and remove a report', async (t) => {
  const store = await tempStore(t);
  const created = await store.create(input('SN1', '2026-11-01'));
  assert.ok(created.id);
  assert.equal(created.createdAt, created.updatedAt);

  const loaded = await store.get(created.id);
  assert.equal(loaded.miner.serialNumber, 'SN1');

  await new Promise((r) => setTimeout(r, 5));
  const updated = await store.update(created.id, input('SN1-B', '2026-11-01'));
  assert.equal(updated.miner.serialNumber, 'SN1-B');
  assert.equal(updated.createdAt, created.createdAt);
  assert.notEqual(updated.updatedAt, created.updatedAt);

  assert.equal(await store.remove(created.id), true);
  assert.equal(await store.get(created.id), null);
  assert.equal(await store.remove(created.id), false);
});

test('list sorts newest report date first and skips bad files', async (t) => {
  const store = await tempStore(t);
  await store.create(input('OLD', '2026-01-01'));
  await store.create(input('NEW', '2026-06-01'));
  await fs.writeFile(path.join(store.dir, '00000000-0000-4000-8000-000000000000.json'), '{not json');
  await fs.writeFile(path.join(store.dir, '00000000-0000-4000-8000-000000000001.json'), '{"miner":{}}');
  await fs.writeFile(path.join(store.dir, 'notes.txt'), 'ignore me');

  const warn = t.mock.method(console, 'warn', () => {});
  const reports = await store.list();
  assert.deepEqual(reports.map((r) => r.miner.serialNumber), ['NEW', 'OLD']);
  assert.equal(warn.mock.callCount(), 2);
});

test('rejects invalid data and unsafe ids', async (t) => {
  const store = await tempStore(t);
  await assert.rejects(store.create({ miner: {} }), ValidationError);
  assert.equal(await store.get('../../etc/passwd'), null);
  assert.equal(await store.update('nope', input('X')), null);
  assert.equal(await store.remove('../x'), false);
});
