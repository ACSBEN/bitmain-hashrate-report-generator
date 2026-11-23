'use strict';

const { formatDuration, formatDateTime } = require('../../report-manager/src/format');

const DASH = '—';

// A number with optional unit; null/undefined -> "—".
function num(value, unit = '', digits = 1) {
  if (value === null || value === undefined || value === '') return DASH;
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  const s = n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: digits });
  return unit ? `${s} ${unit}` : s;
}

function text(value) {
  return value === null || value === undefined || value === '' ? DASH : String(value);
}

function yesNo(value) {
  if (value === null || value === undefined) return DASH;
  return value ? 'Yes' : 'No';
}

function range(r, unit = '°C') {
  if (!r || (r.min === null && r.max === null)) return DASH;
  return `${text(r.min)} – ${text(r.max)} ${unit}`;
}

// CSS modifier for a state/status word (mining, ok, active, failure…).
function tone(state) {
  const s = String(state || '').toLowerCase();
  if (['mining', 'ok', 'active', 'working', 'tuned'].includes(s)) return 'good';
  if (['failure', 'failed', 'error', 'dead', 'disconnected', 'stopped', 'red'].includes(s)) return 'bad';
  if (!s) return 'neutral';
  return 'warn';
}

function bytesKB(kb) {
  if (kb === null || kb === undefined) return DASH;
  return kb >= 1024 ? `${num(kb / 1024, 'MB', 1)}` : `${num(kb, 'KB', 0)}`;
}

module.exports = { num, text, yesNo, range, tone, bytesKB, duration: formatDuration, dateTime: formatDateTime };
