const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseFile, validatePoint } = require('../api/_lib/gps-data');
const { boxesOverlap, duplicateLicenceNumbers, intelligenceFor, parseBoundaryFile, pointInPolygon, validateTitleRecord } = require('../api/_lib/title-intelligence');

const kwaraFixture = 'test-data/preview-kwara-gps-field-test.gpx';
const geometry = { type: 'Polygon', coordinates: [[[4.535, 8.49], [4.55, 8.49], [4.55, 8.505], [4.535, 8.505], [4.535, 8.49]]] };
const activeTitle = { id: 'title-active', licence_no: 'KWARA-TEST-ACTIVE', licence_holder: 'Preview Minerals Ltd', licence_type: 'Exploration Licence', status: 'active', commodities: ['Gold'], expiry_date: '2030-12-31', area_m2: 150000, official_source: 'Preview cadastral test dataset', source_url: 'https://example.com/cadastral', dataset_date: '2026-09-18', last_verified_at: '2026-09-18', verification_status: 'verified', geometry };

test('Kwara GPX fixture point matches a real imported polygon shape, not a centroid', () => {
  const points = parseFile(kwaraFixture, fs.readFileSync(kwaraFixture).toString('base64'));
  assert.equal(points.length, 2);
  assert.equal(pointInPolygon(points[0].point.longitude, points[0].point.latitude, geometry), true);
  const result = intelligenceFor(points[0].point, [activeTitle]);
  assert.equal(result.result, 'match');
  assert.equal(result.matches[0].licence_no, 'KWARA-TEST-ACTIVE');
  assert.equal(result.matches[0].land_owner_occupier, 'Pending Verification');
});

test('outside, overlapping, and expired title outcomes retain conservative status', () => {
  const outside = intelligenceFor({ longitude: 4.8, latitude: 8.8 }, [activeTitle]);
  assert.equal(outside.result, 'no_match');
  assert.equal(outside.message, 'No matching mining title found in the current cadastral dataset. Official NMCO availability verification required.');
  const expired = { ...activeTitle, id: 'title-expired', licence_no: 'KWARA-TEST-EXPIRED', status: 'expired', expiry_date: '2020-01-01' };
  const conflict = intelligenceFor({ longitude: 4.5421, latitude: 8.4966 }, [activeTitle, expired]);
  assert.equal(conflict.result, 'conflict_review_required');
  assert.equal(conflict.matches.length, 2);
  assert.equal(conflict.matches.find((item) => item.licence_no === 'KWARA-TEST-EXPIRED').status, 'expired');
  assert.equal(boxesOverlap(activeTitle.geometry, expired.geometry), true);
});

test('boundary validation rejects missing geometry and duplicate licences, while GPS validation rejects invalid coordinates', () => {
  const invalid = validateTitleRecord({ licence_no: 'BAD-1', licence_holder: 'Holder', official_source: 'NMCO', dataset_date: '2026-09-18' });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((item) => item.includes('Polygon geometry')));
  const valid = validateTitleRecord({ licence_no: 'DUP-1', licence_holder: 'Holder', official_source: 'NMCO', dataset_date: '2026-09-18' }, geometry);
  assert.equal(duplicateLicenceNumbers([{ row: 1, record: valid.record }, { row: 2, record: valid.record }]).length, 1);
  assert.equal(validatePoint({ latitude: 95, longitude: 4.5 }).valid, false);
});

test('GeoJSON, KML and CSV boundary imports use supplied polygon geometry', () => {
  const feature = { type: 'Feature', properties: { licence_no: 'FORMAT-1', licence_holder: 'Holder', official_source: 'NMCO', dataset_date: '2026-09-18' }, geometry };
  const geojson = parseBoundaryFile('titles.geojson', Buffer.from(JSON.stringify({ type: 'FeatureCollection', features: [feature] })).toString('base64'));
  assert.equal(geojson[0].valid, true);
  const kml = '<kml><Placemark><name>FORMAT-2</name><ExtendedData><Data name="licence_holder"><value>Holder</value></Data><Data name="official_source"><value>NMCO</value></Data><Data name="dataset_date"><value>2026-09-18</value></Data></ExtendedData><Polygon><outerBoundaryIs><LinearRing><coordinates>4.535,8.49 4.55,8.49 4.55,8.505 4.535,8.505 4.535,8.49</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></kml>';
  assert.equal(parseBoundaryFile('titles.kml', Buffer.from(kml).toString('base64'))[0].valid, true);
  const csv = `Licence Number,Licence Holder / Operator,Source,Dataset Date,Geometry\nFORMAT-3,Holder,NMCO,2026-09-18,"${JSON.stringify(geometry).replaceAll('"', '""')}"`;
  assert.equal(parseBoundaryFile('titles.csv', Buffer.from(csv).toString('base64'))[0].valid, true);
});
