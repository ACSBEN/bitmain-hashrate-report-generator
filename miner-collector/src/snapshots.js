'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { writeJsonAtomic } = require('../../report-manager/src/fs-util');

// <serial>_<timestamp>, e.g. PIEMFKUBDJHJG00KG_2026-11-23T15-40-12Z
const NAME_PATTERN = /^[A-Za-z0-9-]+_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z$/;

function isValidName(name) {
  return typeof name === 'string' && NAME_PATTERN.test(name);
}

function nameFor(snapshot) {
  const serial = (snapshot.miner.serialNumber || 'unknown').replace(/[^A-Za-z0-9-]/g, '-');
  const stamp = snapshot.capturedAt.replace(/\.\d+Z$/, 'Z').replace(/:/g, '-');
  return `${serial}_${stamp}`;
}

function createSnapshotStore(dir) {
  const fileFor = (name) => path.join(dir, `${name}.json`);

  async function save(snapshot) {
    const name = nameFor(snapshot);
    await writeJsonAtomic(fileFor(name), snapshot);
    return name;
  }

  async function get(name) {
    if (!isValidName(name)) return null;
    try {
      return JSON.parse(await fs.readFile(fileFor(name), 'utf8'));
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }

  async function update(name, changes) {
    const snapshot = await get(name);
    if (!snapshot) return null;
    const updated = { ...snapshot, ...changes };
    await writeJsonAtomic(fileFor(name), updated);
    return updated;
  }

  // Overwrite with `snapshot`, moving the file if its serial (and so its name)
  // changed. Returns the new name.
  async function replace(name, snapshot) {
    const newName = nameFor(snapshot);
    if (newName !== name && await get(newName)) {
      throw new Error(`A snapshot named ${newName} already exists.`);
    }
    await writeJsonAtomic(fileFor(newName), snapshot);
    if (newName !== name) await fs.unlink(fileFor(name));
    return newName;
  }

  // Newest first. Names end in a sortable UTC timestamp, so sort on that
  // rather than opening every (log-heavy) file.
  async function list({ limit = 20 } = {}) {
    let files;
    try {
      files = await fs.readdir(dir);
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
    return files
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -5))
      .filter(isValidName)
      .map((name) => {
        const [serial, stamp] = name.split('_');
        const capturedAt = stamp.replace(/T(\d{2})-(\d{2})-(\d{2})Z$/, 'T$1:$2:$3Z');
        return { name, serial, capturedAt };
      })
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
      .slice(0, limit);
  }

  return { save, get, update, replace, list };
}

module.exports = { createSnapshotStore, isValidName, nameFor };
