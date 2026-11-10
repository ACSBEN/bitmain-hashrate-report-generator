'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { joinDuration, splitDuration, formatDuration } = require('../src/format');

test('duration round-trips through form parts', () => {
  const seconds = joinDuration({ days: '3', hours: '4', minutes: '12' });
  assert.equal(seconds, 3 * 86400 + 4 * 3600 + 12 * 60);
  assert.deepEqual(splitDuration(seconds), { days: 3, hours: 4, minutes: 12 });
  assert.equal(formatDuration(seconds), '3d 4h 12m');
});

test('duration blanks and bad input', () => {
  assert.equal(joinDuration({ days: '', hours: '', minutes: '' }), null);
  assert.equal(joinDuration(undefined), null);
  assert.equal(joinDuration({ hours: '2' }), 7200);
  assert.equal(joinDuration({ days: '-1' }), 'invalid');
  assert.equal(formatDuration(null), '—');
  assert.equal(formatDuration(125 * 60), '2h 5m');
});
