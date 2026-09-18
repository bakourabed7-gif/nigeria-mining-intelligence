const crypto = require('node:crypto');
const { XMLParser } = require('fast-xml-parser');

const text = (value, max = 2000) => String(value ?? '').trim().slice(0, max);
const nullableText = (value, max) => text(value, max) || null;
const normaliseLicence = (value) => text(value, 120).replace(/\s+/g, ' ').toUpperCase();
const asList = (value) => Array.isArray(value) ? value.map((item) => text(item, 120)).filter(Boolean) : text(value, 2000).split(/[;,|]/).map((item) => item.trim()).filter(Boolean);
const date = (value) => value ? text(value, 10) : null;
const optionalNumber = (value) => value === '' || value === null || value === undefined ? null : Number(value);

function coordinatesOf(geometry) {
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type) || !Array.isArray(geometry.coordinates)) return [];
  return geometry.type === 'Polygon' ? geometry.coordinates.flat() : geometry.coordinates.flat(2);
}
function validGeometry(geometry) {
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type) || !Array.isArray(geometry.coordinates)) return false;
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.length > 0 && polygons.every((polygon) => Array.isArray(polygon) && polygon.length > 0 && polygon.every((ring) => Array.isArray(ring) && ring.length >= 4 && ring.every((coordinate) => Array.isArray(coordinate) && coordinate.length >= 2 && Number.isFinite(Number(coordinate[0])) && Number.isFinite(Number(coordinate[1])) && Number(coordinate[0]) >= -180 && Number(coordinate[0]) <= 180 && Number(coordinate[1]) >= -90 && Number(coordinate[1]) <= 90) && Number(ring[0][0]) === Number(ring[ring.length - 1][0]) && Number(ring[0][1]) === Number(ring[ring.length - 1][1])));
}
function parseGeometry(value) {
  if (typeof value === 'object' && value) return value;
  try { return JSON.parse(String(value || '')); } catch (_) { return null; }
}
function titleRecord(input, geometry) {
  return {
    licence_no: normaliseLicence(input.licence_no ?? input['Licence Number']),
    licence_type: nullableText(input.licence_type ?? input['Licence Type'], 160),
    licence_holder: nullableText(input.licence_holder ?? input.operator ?? input['Licence Holder / Operator'] ?? input.Operator, 300),
    state: nullableText(input.state ?? input.State, 120),
    lga: nullableText(input.lga ?? input.LGA, 160),
    commodities: asList(input.commodities ?? input['Mineral / Commodities'] ?? input.Commodities),
    status: nullableText(input.status ?? input.Status, 80) || 'pending',
    issue_date: date(input.issue_date ?? input['Issue Date']),
    expiry_date: date(input.expiry_date ?? input['Expiry Date']),
    area_m2: optionalNumber(input.area_m2 ?? input.Area),
    geometry: parseGeometry(geometry ?? input.geometry ?? input.Geometry),
    official_source: nullableText(input.official_source ?? input.source ?? input.Source, 300),
    source_url: nullableText(input.source_url ?? input['Source URL'], 2000),
    dataset_date: date(input.dataset_date ?? input['Dataset Date']),
    last_verified_at: date(input.last_verified_at ?? input['Last Verified Date']),
    verification_status: (nullableText(input.verification_status ?? input['Verification Status'], 20) || 'pending').toLowerCase()
  };
}
function validateTitleRecord(input, geometry) {
  const record = titleRecord(input, geometry);
  const errors = [];
  if (!record.licence_no) errors.push('Licence Number is required.');
  if (!record.licence_holder) errors.push('Licence Holder / Operator is required.');
  if (!record.official_source) errors.push('Official Source is required.');
  if (!record.dataset_date) errors.push('Dataset Date is required.');
  if (!validGeometry(record.geometry)) errors.push('Polygon geometry must be a valid closed GeoJSON Polygon or MultiPolygon.');
  if (record.area_m2 !== null && (!Number.isFinite(record.area_m2) || record.area_m2 < 0)) errors.push('Area must be a positive number.');
  if (!['pending', 'verified', 'rejected'].includes(record.verification_status)) errors.push('Verification Status must be pending, verified, or rejected.');
  return { valid: errors.length === 0, errors, record };
}
function csvRows(raw) {
  const rows = []; let row = []; let value = ''; let quoted = false;
  for (let i = 0; i < raw.length; i += 1) { const char = raw[i]; if (char === '"') { if (quoted && raw[i + 1] === '"') { value += char; i += 1; } else quoted = !quoted; } else if (char === ',' && !quoted) { row.push(value); value = ''; } else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && raw[i + 1] === '\n') i += 1; row.push(value); if (row.some((item) => item.trim())) rows.push(row); row = []; value = ''; } else value += char; }
  row.push(value); if (row.some((item) => item.trim())) rows.push(row);
  const [header, ...data] = rows; return data.map((items) => Object.fromEntries(header.map((key, index) => [key.trim(), items[index] ?? ''])));
}
function kmlRecords(raw) {
  const doc = new XMLParser({ ignoreAttributes: false }).parse(raw);
  const result = [];
  const collect = (node) => { if (!node || typeof node !== 'object') return; Object.entries(node).forEach(([key, value]) => { if (key === 'Placemark') (Array.isArray(value) ? value : [value]).forEach((mark) => { const coords = mark?.Polygon?.outerBoundaryIs?.LinearRing?.coordinates; if (!coords) return; const attributes = Object.fromEntries((Array.isArray(mark?.ExtendedData?.Data) ? mark.ExtendedData.Data : mark?.ExtendedData?.Data ? [mark.ExtendedData.Data] : []).map((item) => [item.name || item['@_name'], item.value])); const ring = String(coords).trim().split(/\s+/).map((item) => item.split(',').slice(0, 2).map(Number)); result.push({ input: { ...attributes, licence_no: attributes.licence_no || mark.name, licence_holder: attributes.licence_holder || mark?.ExtendedData?.licence_holder, official_source: attributes.official_source || mark?.ExtendedData?.official_source, dataset_date: attributes.dataset_date || mark?.ExtendedData?.dataset_date }, geometry: { type: 'Polygon', coordinates: [ring] } }); }); else (Array.isArray(value) ? value : [value]).forEach(collect); }); };
  collect(doc); return result;
}
function parseBoundaryFile(filename, contents) {
  const name = text(filename, 255).toLowerCase(); const raw = Buffer.from(String(contents || ''), 'base64').toString('utf8');
  if (!raw || Buffer.byteLength(raw) > 8 * 1024 * 1024) throw new Error('Boundary upload must be between 1 byte and 8 MB.');
  let rows;
  if (name.endsWith('.geojson') || name.endsWith('.json')) { const data = JSON.parse(raw); const features = data.type === 'FeatureCollection' ? data.features : data.type === 'Feature' ? [data] : []; rows = features.map((feature) => ({ input: feature.properties || {}, geometry: feature.geometry })); }
  else if (name.endsWith('.kml')) rows = kmlRecords(raw);
  else if (name.endsWith('.csv')) rows = csvRows(raw).map((input) => ({ input, geometry: input.geometry ?? input.Geometry }));
  else throw new Error('Use GeoJSON, KML, or CSV with a GeoJSON geometry column for title boundaries.');
  if (!rows.length || rows.length > 5000) throw new Error('Boundary upload must contain 1–5,000 records.');
  return rows.map(({ input, geometry }, index) => ({ row: index + 1, ...validateTitleRecord(input, geometry) }));
}
function duplicateLicenceNumbers(records) { const seen = new Set(); return records.filter((item) => { const licence = normaliseLicence(item.record?.licence_no); if (!licence || seen.has(licence)) return Boolean(licence); seen.add(licence); return false; }); }
function pointInRing(longitude, latitude, ring) { let inside = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i]; const [xj, yj] = ring[j]; const crosses = ((yi > latitude) !== (yj > latitude)) && (longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi); if (crosses) inside = !inside; } return inside; }
function pointInPolygon(longitude, latitude, geometry) { if (!validGeometry(geometry)) return false; const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates; return polygons.some((polygon) => pointInRing(longitude, latitude, polygon[0]) && !polygon.slice(1).some((hole) => pointInRing(longitude, latitude, hole))); }
function boundingBox(geometry) { const coordinates = coordinatesOf(geometry); const xs = coordinates.map((item) => Number(item[0])); const ys = coordinates.map((item) => Number(item[1])); return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }; }
function boxesOverlap(left, right) { const a = boundingBox(left); const b = boundingBox(right); return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY; }
function titleInsertValues(record, userId, overlapFlag = false) { return [crypto.randomUUID(), record.licence_no, normaliseLicence(record.licence_no), record.licence_type, record.licence_holder, record.state, record.lga, JSON.stringify(record.commodities), record.status, record.issue_date, record.expiry_date, record.area_m2, JSON.stringify(record.geometry), record.official_source, record.source_url, record.dataset_date, record.last_verified_at, record.verification_status, overlapFlag, userId]; }
const titleInsertSql = 'INSERT INTO mining_title_polygons (id, licence_no, licence_no_normalized, licence_type, licence_holder, state, lga, commodities, status, issue_date, expiry_date, area_m2, geometry, official_source, source_url, dataset_date, last_verified_at, verification_status, overlap_flag, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13::jsonb,$14,$15,$16,$17,$18,$19,$20) RETURNING *';
function titleMatch(row) { return { id: row.id, licence_no: row.licence_no, licence_holder: row.licence_holder, licence_type: row.licence_type, status: row.status, commodities: row.commodities, expiry_date: row.expiry_date, area_m2: row.area_m2, official_source: row.official_source, source_url: row.source_url, dataset_date: row.dataset_date, last_verified_at: row.last_verified_at, verification_status: row.verification_status, land_owner_occupier: 'Pending Verification' }; }
function intelligenceFor(point, rows) { const matches = rows.filter((row) => pointInPolygon(point.longitude, point.latitude, row.geometry)).map(titleMatch); if (!matches.length) return { result: 'no_match', message: 'No matching mining title found in the current cadastral dataset. Official NMCO availability verification required.', matches: [] }; if (matches.length > 1) return { result: 'conflict_review_required', message: 'Conflict / Review Required', matches }; return { result: 'match', message: 'Mining title match found.', matches }; }
module.exports = { boxesOverlap, duplicateLicenceNumbers, intelligenceFor, normaliseLicence, parseBoundaryFile, pointInPolygon, titleInsertSql, titleInsertValues, validateTitleRecord };
