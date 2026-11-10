'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { normalizeReport } = require('./schema');

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidId(id) {
  return typeof id === 'string' && ID_PATTERN.test(id);
}

class ValidationError extends Error {
  constructor(errors) {
    super('Report data is invalid');
    this.errors = errors;
  }
}

/**
 * File-backed report store: one JSON file per report at <dir>/<id>.json.
 * Writes go to a temp file first and are renamed into place so a crash never
 * leaves a half-written report behind.
 */
function createStore(dir) {
  const fileFor = (id) => path.join(dir, `${id}.json`);

  async function writeAtomic(report) {
    await fs.mkdir(dir, { recursive: true });
    const target = fileFor(report.id);
    const tmp = `${target}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(report, null, 2) + '\n', 'utf8');
    await fs.rename(tmp, target);
  }

  async function readFile(id) {
    try {
      return JSON.parse(await fs.readFile(fileFor(id), 'utf8'));
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }

  // Re-normalize on read so files written by hand or by the collector are
  // coerced into the current shape. Invalid files are skipped, not fatal.
  function hydrate(raw, id) {
    const { value, errors } = normalizeReport(raw);
    if (Object.keys(errors).length > 0) {
      console.warn(`[store] skipping invalid report ${id}:`, errors);
      return null;
    }
    return {
      ...value,
      id,
      createdAt: raw.createdAt || null,
      updatedAt: raw.updatedAt || raw.createdAt || null,
    };
  }

  async function list() {
    let names;
    try {
      names = await fs.readdir(dir);
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
    const reports = [];
    for (const name of names) {
      if (!name.endsWith('.json')) continue;
      const id = name.slice(0, -'.json'.length);
      if (!isValidId(id)) continue;
      try {
        const raw = await readFile(id);
        const report = raw && hydrate(raw, id);
        if (report) reports.push(report);
      } catch (err) {
        console.warn(`[store] could not read ${name}: ${err.message}`);
      }
    }
    return reports.sort((a, b) =>
      b.reportDate.localeCompare(a.reportDate) ||
      String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  async function get(id) {
    if (!isValidId(id)) return null;
    const raw = await readFile(id);
    return raw && hydrate(raw, id);
  }

  async function create(input, { id = crypto.randomUUID() } = {}) {
    if (!isValidId(id)) throw new Error(`Invalid report id: ${id}`);
    const { value, errors } = normalizeReport(input);
    if (Object.keys(errors).length > 0) throw new ValidationError(errors);
    const now = new Date().toISOString();
    const report = { ...value, id, createdAt: now, updatedAt: now };
    await writeAtomic(report);
    return report;
  }

  async function update(id, input) {
    const existing = await get(id);
    if (!existing) return null;
    const { value, errors } = normalizeReport(input);
    if (Object.keys(errors).length > 0) throw new ValidationError(errors);
    const report = {
      ...value,
      id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    await writeAtomic(report);
    return report;
  }

  async function remove(id) {
    if (!isValidId(id)) return false;
    try {
      await fs.unlink(fileFor(id));
      return true;
    } catch (err) {
      if (err.code === 'ENOENT') return false;
      throw err;
    }
  }

  return { dir, list, get, create, update, remove };
}

module.exports = { createStore, isValidId, ValidationError };
