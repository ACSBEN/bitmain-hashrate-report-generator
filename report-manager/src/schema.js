'use strict';

// Single source of truth for report fields. Validation, the edit form and the
// report view all iterate these tables so they cannot drift apart.

const SCHEMA_VERSION = 1;
const HASHBOARD_COUNT = 3;
const SOURCES = ['manual', 'api'];

const MINER_FIELDS = [
  { key: 'serialNumber', label: 'Serial Number', type: 'text', required: true },
  { key: 'model', label: 'Model', type: 'text', required: true },
  { key: 'firmwareVersion', label: 'Firmware Version', type: 'text' },
  { key: 'hashrateTHs', label: 'Hashrate', unit: 'TH/s', type: 'number', min: 0 },
  {
    key: 'expectedHashrateTHs', label: 'Expected Hashrate', unit: 'TH/s', type: 'number', positive: true,
    hint: 'Leave blank to use the model setting from Thresholds',
  },
  { key: 'runTimeSeconds', label: 'Run Time', type: 'duration', min: 0 },
];

const HASHBOARD_FIELDS = [
  { key: 'serialNumber', label: 'Serial Number', type: 'text' },
  { key: 'model', label: 'Model', type: 'text' },
  { key: 'hashrateTHs', label: 'Hashrate', unit: 'TH/s', type: 'number', min: 0 },
  { key: 'avgPcbTempC', label: 'Average PCB Temp', unit: '°C', type: 'number' },
  { key: 'pcbTempDeltaC', label: 'PCB Temp Delta', unit: '°C', type: 'number', min: 0 },
  { key: 'avgChipTempC', label: 'Average Chip Temp', unit: '°C', type: 'number' },
  { key: 'chipTempDeltaC', label: 'Chip Temp Delta', unit: '°C', type: 'number', min: 0 },
];

const PSU_FIELDS = [
  { key: 'pfcTempC', label: 'PFC Temp', unit: '°C', type: 'number' },
  { key: 'avgLlcTempC', label: 'Average LLC Temp', unit: '°C', type: 'number' },
  { key: 'llcTempDeltaC', label: 'LLC Temp Delta', unit: '°C', type: 'number', min: 0 },
];

const MAX_TEXT_LENGTH = 200;
const MAX_NOTES_LENGTH = 5000;

function isBlank(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function normalizeText(raw, field, path, errors) {
  if (isBlank(raw)) {
    if (field.required) errors[path] = `${field.label} is required`;
    return '';
  }
  const text = String(raw).trim();
  if (text.length > MAX_TEXT_LENGTH) {
    errors[path] = `${field.label} must be at most ${MAX_TEXT_LENGTH} characters`;
  }
  return text;
}

// Blank numbers mean "not recorded" and are stored as null.
function normalizeNumber(raw, field, path, errors) {
  if (isBlank(raw)) {
    if (field.required) errors[path] = `${field.label} is required`;
    return null;
  }
  const num = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(num)) {
    errors[path] = `${field.label} must be a number`;
    return null;
  }
  if (field.positive && num <= 0) {
    errors[path] = `${field.label} must be greater than 0`;
    return null;
  }
  if (field.min !== undefined && num < field.min) {
    errors[path] = `${field.label} must be at least ${field.min}`;
    return null;
  }
  if (field.type === 'duration' && !Number.isInteger(num)) {
    errors[path] = `${field.label} must be a whole number of seconds`;
    return null;
  }
  return num;
}

function normalizeSection(input, fields, prefix, errors) {
  const source = input && typeof input === 'object' ? input : {};
  const out = {};
  for (const field of fields) {
    const path = `${prefix}.${field.key}`;
    out[field.key] = field.type === 'text'
      ? normalizeText(source[field.key], field, path, errors)
      : normalizeNumber(source[field.key], field, path, errors);
  }
  return out;
}

function normalizeDate(raw, errors) {
  if (isBlank(raw)) return new Date().toISOString().slice(0, 10);
  const text = String(raw).trim();
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  if (!match || Number.isNaN(Date.parse(match[1]))) {
    errors.reportDate = 'Report date must be a valid date (YYYY-MM-DD)';
    return text;
  }
  return match[1];
}

/**
 * Validate and coerce raw input (form body or JSON from the collector) into the
 * report data shape. Returns { value, errors }; errors is keyed by field path
 * (e.g. "hashboards.1.avgChipTempC") and is empty when the input is valid.
 * Identity/timestamp fields (id, createdAt, updatedAt) are left to the store.
 */
function normalizeReport(input) {
  const raw = input && typeof input === 'object' ? input : {};
  const errors = {};

  const source = isBlank(raw.source) ? 'manual' : String(raw.source).trim();
  if (!SOURCES.includes(source)) errors.source = `Source must be one of: ${SOURCES.join(', ')}`;

  const notes = isBlank(raw.notes) ? '' : String(raw.notes);
  if (notes.length > MAX_NOTES_LENGTH) errors.notes = `Notes must be at most ${MAX_NOTES_LENGTH} characters`;

  const rawBoards = raw.hashboards;
  if (rawBoards !== undefined && !Array.isArray(rawBoards) && typeof rawBoards !== 'object') {
    errors.hashboards = 'Hashboards must be a list';
  }
  if (Array.isArray(rawBoards) && rawBoards.length > HASHBOARD_COUNT) {
    errors.hashboards = `A miner has exactly ${HASHBOARD_COUNT} hashboards`;
  }

  const hashboards = [];
  for (let slot = 0; slot < HASHBOARD_COUNT; slot++) {
    const board = rawBoards && typeof rawBoards === 'object' ? rawBoards[slot] : undefined;
    hashboards.push({ slot, ...normalizeSection(board, HASHBOARD_FIELDS, `hashboards.${slot}`, errors) });
  }

  const value = {
    schemaVersion: SCHEMA_VERSION,
    reportDate: normalizeDate(raw.reportDate, errors),
    source,
    notes,
    miner: normalizeSection(raw.miner, MINER_FIELDS, 'miner', errors),
    hashboards,
    psu: normalizeSection(raw.psu, PSU_FIELDS, 'psu', errors),
  };

  return { value, errors };
}

module.exports = {
  SCHEMA_VERSION,
  HASHBOARD_COUNT,
  SOURCES,
  MINER_FIELDS,
  HASHBOARD_FIELDS,
  PSU_FIELDS,
  normalizeReport,
};
