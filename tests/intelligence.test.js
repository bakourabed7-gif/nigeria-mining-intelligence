const test = require('node:test');
const assert = require('node:assert/strict');
const { analysis, score, search } = require('../api/_lib/intelligence');
const { records } = require('../api/_lib/data');

test('records are searchable and receive bounded scores', () => {
  const results = search(records(), { state: 'Kogi', status: 'active' });
  assert.ok(results.length > 0);
  assert.ok(results.every((record) => record.state === 'Kogi' && record.status === 'active'));
  assert.ok(results.every((record) => score(record) >= 0 && score(record) <= 99));
});

test('analysis preserves source provenance and due-diligence guidance', () => {
  const record = records()[0];
  const result = analysis(record);
  assert.equal(result.licence, record.licence_no);
  assert.equal(result.provenance.source_url, record.source_url);
  assert.ok(result.risks.length > 0 && result.actions.length > 0);
});
