const test = require('node:test');
const assert = require('node:assert/strict');
const { analysis, freeSearchResults, score, search } = require('../api/_lib/intelligence');
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

test('Free search preview returns at most three basic records without numeric AI scores', () => {
  const preview = freeSearchResults(search(records()), 3);
  assert.equal(preview.length, 3);
  assert.ok(preview.every((record) => !('ai_score' in record)));
  assert.ok(preview.every((record) => ['High Potential', 'Medium Potential', 'Lower Potential'].includes(record.potential_label)));
});
