'use strict';

// JSON endpoints that Vnish serves without auth, keyed by the name used in the
// raw bundle handed to normalize(). See API/vnish-api.md.
const JSON_ENDPOINTS = {
  info: '/info',
  model: '/model',
  status: '/status',
  summary: '/summary',
  perfSummary: '/perf-summary',
  boards: '/boards',
  factoryInfo: '/chains/factory-info',
  notes: '/notes',
  ui: '/ui',
};

const LOG_TYPES = ['status', 'miner', 'autotune', 'pool', 'hwscan', 'system', 'messages', 'api'];

// IPv4 address or hostname, optionally with a port. No scheme or path: the
// collector always builds http://<host>/api/v1 itself.
const HOST_PATTERN = /^(?=.{1,253}(?::\d{1,5})?$)[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)*(:\d{1,5})?$/;

class CollectError extends Error {
  // 400 for bad input, 502 when the miner can't be read.
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

function parseHost(input) {
  const host = String(input ?? '').trim();
  if (!host) throw new CollectError('Enter the miner\'s IP address.', 400);
  if (!HOST_PATTERN.test(host)) {
    throw new CollectError(`"${host}" is not a valid IP address or hostname. Enter something like 192.168.0.103.`, 400);
  }
  return host;
}

function describeError(err, timeoutMs) {
  if (err.name === 'TimeoutError' || err.name === 'AbortError') return `timed out after ${timeoutMs / 1000} s`;
  switch (err.cause?.code) {
    case 'ECONNREFUSED': return 'connection refused';
    case 'EHOSTUNREACH':
    case 'ENETUNREACH': return 'host unreachable';
    case 'ENOTFOUND': return 'host not found';
    case 'ECONNRESET': return 'connection reset';
    default: return err.message;
  }
}

/**
 * Pull every unauthenticated endpoint and log from a Vnish miner in parallel.
 * Returns { host, raw, logs, errors }. errors is keyed by endpoint name (or
 * "logs.<type>") so one failing section doesn't sink the whole snapshot. Only
 * a failure of /info is fatal, since without it we can't tell what we're
 * talking to.
 */
async function fetchAll(input, { fetchImpl = globalThis.fetch, timeoutMs = 10_000 } = {}) {
  const host = parseHost(input);
  const base = `http://${host}/api/v1`;
  const errors = {};

  async function get(path, as) {
    const res = await fetchImpl(base + path, {
      headers: { accept: as === 'json' ? 'application/json' : 'text/plain' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (as === 'text') return res.text();
    const body = await res.text();
    try {
      return JSON.parse(body);
    } catch {
      throw new Error('response was not JSON');
    }
  }

  async function settle(key, path, as) {
    try {
      return await get(path, as);
    } catch (err) {
      errors[key] = describeError(err, timeoutMs);
      return null;
    }
  }

  const jsonEntries = Object.entries(JSON_ENDPOINTS);
  const [jsonResults, logResults] = await Promise.all([
    Promise.all(jsonEntries.map(([key, path]) => settle(key, path, 'json'))),
    Promise.all(LOG_TYPES.map((type) => settle(`logs.${type}`, `/logs/${type}`, 'text'))),
  ]);

  const raw = Object.fromEntries(jsonEntries.map(([key], i) => [key, jsonResults[i]]));
  const logs = Object.fromEntries(LOG_TYPES.map((type, i) => [type, logResults[i]]));

  if (!raw.info) {
    const reason = errors.info || 'empty response';
    const hint = reason === 'response was not JSON' || reason.startsWith('HTTP ')
      ? ' It doesn\'t look like a Vnish miner.'
      : '';
    throw new CollectError(`Could not read miner info from ${host}: ${reason}.${hint}`);
  }
  if (typeof raw.info !== 'object' || !('serial' in raw.info || 'miner' in raw.info)) {
    throw new CollectError(`${host} answered, but it doesn't look like a Vnish miner.`);
  }

  return { host, raw, logs, errors };
}

module.exports = { fetchAll, parseHost, CollectError, JSON_ENDPOINTS, LOG_TYPES };
