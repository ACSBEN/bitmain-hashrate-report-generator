'use strict';

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function splitDuration(seconds) {
  if (seconds === null || seconds === undefined) return { days: '', hours: '', minutes: '' };
  return {
    days: Math.floor(seconds / DAY),
    hours: Math.floor((seconds % DAY) / HOUR),
    minutes: Math.floor((seconds % HOUR) / MINUTE),
  };
}

// Combine the form's day/hour/minute inputs into seconds. All blank -> null
// ("not recorded"); anything unparseable is passed through as-is so schema
// validation reports it.
function joinDuration(parts) {
  const p = parts && typeof parts === 'object' ? parts : {};
  const values = [p.days, p.hours, p.minutes].map((v) => (v === undefined ? '' : String(v).trim()));
  if (values.every((v) => v === '')) return null;
  const [days, hours, minutes] = values.map((v) => (v === '' ? 0 : Number(v)));
  if (![days, hours, minutes].every((n) => Number.isFinite(n) && n >= 0)) return 'invalid';
  return Math.round(days * DAY + hours * HOUR + minutes * MINUTE);
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return '—';
  const { days, hours, minutes } = splitDuration(seconds);
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (days || hours) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(' ');
}

function formatNumber(value, digits = 1) {
  if (value === null || value === undefined || value === '') return '—';
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatValue(field, value) {
  if (field.type === 'duration') return formatDuration(value);
  if (field.type === 'number') {
    if (value === null || value === undefined) return '—';
    return `${formatNumber(value, field.unit === 'TH/s' ? 2 : 1)} ${field.unit || ''}`.trim();
  }
  return value === '' || value === null || value === undefined ? '—' : String(value);
}

function formatDate(isoDate) {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
  });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

module.exports = {
  splitDuration,
  joinDuration,
  formatDuration,
  formatNumber,
  formatValue,
  formatDate,
  formatDateTime,
};
