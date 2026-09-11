const test = require('node:test');
const assert = require('node:assert/strict');
const { parseFile, validatePoint } = require('../api/_lib/gps-data');

test('GPX waypoints and tracks are parsed into validated GPS points', () => {
  const gpx = '<gpx><wpt lat="7.5" lon="6.8"><name>Site A</name><ele>220</ele><time>2026-01-01T10:00:00Z</time></wpt></gpx>';
  const points = parseFile('field.gpx', Buffer.from(gpx).toString('base64'));
  assert.equal(points[0].valid, true);
  assert.equal(points[0].point.field_site_name, 'Site A');
  assert.equal(points[0].point.altitude_m, 220);
});

test('GPX standard metadata is retained for field-data review', () => {
  const gpx = '<gpx><wpt lat="8.4966" lon="4.5421"><name>KWARA GPS TEST SITE</name><cmt>GPS-TEST-001</cmt><type>Gold</type><src>GPS H1 Test Import</src><desc>Preview GPS integration test — not real field data</desc></wpt></gpx>';
  const point = parseFile('kwara-test.gpx', Buffer.from(gpx).toString('base64'))[0];
  assert.equal(point.valid, true);
  assert.deepEqual(point.point, { field_site_name: 'KWARA GPS TEST SITE', sample_id: 'GPS-TEST-001', mineral_observed: 'Gold', field_notes: 'Preview GPS integration test — not real field data', attachments: [], gps_source: 'GPS H1 Test Import', source_format: 'gpx', latitude: 8.4966, longitude: 4.5421, altitude_m: null, recorded_at: null, verification_status: 'pending' });
});

test('KML coordinates and invalid GPS coordinates are handled safely', () => {
  const kml = '<kml><Document><Placemark><name>Site B</name><Point><coordinates>6.8,7.5,221</coordinates></Point></Placemark></Document></kml>';
  assert.equal(parseFile('field.kml', Buffer.from(kml).toString('base64'))[0].valid, true);
  assert.equal(validatePoint({ latitude: 100, longitude: 6.8 }).valid, false);
});
