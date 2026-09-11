const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCoordinateImport, parseImport, validateRecord } = require('../api/_lib/admin-data');

test('admin record validation rejects missing required fields and invalid coordinates', () => {
  const result = validateRecord({ licence_no: '', operator: '', state: '', commodities: '', latitude: 120 });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((item) => item.includes('Licence Number')));
  assert.ok(result.errors.some((item) => item.includes('Latitude')));
});

test('CSV imports are parsed and validated before database import', () => {
  const csv = 'Licence Number,Operator,State,Mineral / Commodities,Latitude,Longitude\nML 100,Example Mining,Kogi,Gold; Copper,7.5,6.8';
  const rows = parseImport('records.csv', Buffer.from(csv).toString('base64'));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].valid, true);
  assert.equal(rows[0].record.licence_no, 'ML 100');
  assert.deepEqual(rows[0].record.commodities, ['Gold', 'Copper']);
});

test('coordinate imports validate licence keys and coordinate bounds independently', () => {
  const csv = 'Licence Number,Latitude,Longitude\nML 100,7.5,6.8';
  const rows = parseCoordinateImport(Buffer.from(csv).toString('base64'));
  assert.equal(rows[0].valid, true);
  assert.equal(rows[0].record.longitude, 6.8);
});
