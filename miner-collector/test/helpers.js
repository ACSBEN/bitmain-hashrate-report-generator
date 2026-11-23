'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { JSON_ENDPOINTS, LOG_TYPES } = require('../src/vnish/client');

// Responses captured from an Antminer S21 Pro on Vnish 1.3.5 (logs trimmed).
const FIXTURES = path.join(__dirname, 'fixtures', 'vnish');
const FILE_FOR = {
  info: 'info', model: 'model', status: 'status', summary: 'summary', perfSummary: 'perf-summary',
  boards: 'boards', factoryInfo: 'factory-info', notes: 'notes', ui: 'ui',
};

function loadJson(key) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, `${FILE_FOR[key]}.json`), 'utf8'));
}

function loadLog(type) {
  return fs.readFileSync(path.join(FIXTURES, 'logs', `${type}.txt`), 'utf8');
}

// What client.fetchAll() returns for the fixture miner.
function fixtureResult() {
  return {
    host: '192.168.0.103',
    raw: Object.fromEntries(Object.keys(JSON_ENDPOINTS).map((key) => [key, loadJson(key)])),
    logs: Object.fromEntries(LOG_TYPES.map((type) => [type, loadLog(type)])),
    errors: {},
  };
}

// A fetch() stand-in serving the fixtures. `overrides` maps an API path
// (e.g. "/info") to a function returning a Response, or throwing.
function stubFetch(overrides = {}) {
  const byPath = Object.fromEntries(Object.entries(JSON_ENDPOINTS).map(([key, p]) => [p, key]));
  return async (url) => {
    const apiPath = new URL(url).pathname.replace(/^\/api\/v1/, '');
    if (overrides[apiPath]) return overrides[apiPath]();
    if (byPath[apiPath]) return Response.json(loadJson(byPath[apiPath]));
    const log = apiPath.match(/^\/logs\/(\w+)$/);
    if (log && LOG_TYPES.includes(log[1])) return new Response(loadLog(log[1]));
    return new Response('not found', { status: 404 });
  };
}

module.exports = { fixtureResult, stubFetch, loadJson };
