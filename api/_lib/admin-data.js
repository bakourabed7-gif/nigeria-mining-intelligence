const crypto = require('node:crypto');
const XLSX = require('xlsx');

const fields = ['licence_no', 'operator', 'state', 'lga', 'commodities', 'latitude', 'longitude', 'title_type', 'status', 'area_m2', 'issue_date', 'expiry_date', 'source', 'source_url', 'verification_status', 'last_verified_at', 'geological_notes', 'infrastructure_notes', 'risk_notes', 'ai_score'];
const text = (value, max = 2000) => String(value ?? '').trim().slice(0, max);
const normaliseLicence = (value) => text(value, 120).replace(/\s+/g, ' ').toUpperCase();
const optionalNumber = (value) => value === '' || value === null || value === undefined ? null : Number(value);
const asCommodities = (value) => Array.isArray(value) ? value.map((item) => text(item, 80)).filter(Boolean) : text(value, 500).split(/[,;|]/).map((item) => item.trim()).filter(Boolean);
const date = (value) => value ? text(value, 10) : null;

function validateRecord(input) {
  const record = {};
  const errors = [];
  record.licence_no = normaliseLicence(input.licence_no ?? input['Licence Number']);
  record.operator = text(input.operator ?? input.Operator, 240);
  record.state = text(input.state ?? input.State, 100);
  record.lga = text(input.lga ?? input.LGA, 160) || null;
  record.commodities = asCommodities(input.commodities ?? input['Mineral / Commodities']);
  record.latitude = optionalNumber(input.latitude ?? input.Latitude);
  record.longitude = optionalNumber(input.longitude ?? input.Longitude);
  record.title_type = text(input.title_type ?? input['Licence Type'], 100) || null;
  record.status = text(input.status ?? input.Status, 40).toLowerCase() || 'active';
  record.area_m2 = optionalNumber(input.area_m2 ?? input.Area);
  record.issue_date = date(input.issue_date ?? input['Issue Date']);
  record.expiry_date = date(input.expiry_date ?? input['Expiry Date']);
  record.source = text(input.source ?? input.Source, 180) || null;
  record.source_url = text(input.source_url ?? input['Source URL'], 2000) || null;
  record.verification_status = text(input.verification_status ?? input['Verification Status'], 20).toLowerCase() || 'pending';
  record.last_verified_at = date(input.last_verified_at ?? input['Last Verified Date']);
  record.geological_notes = text(input.geological_notes ?? input['Geological Notes'], 10000) || null;
  record.infrastructure_notes = text(input.infrastructure_notes ?? input['Infrastructure Notes'], 10000) || null;
  record.risk_notes = text(input.risk_notes ?? input['Risk Notes'], 10000) || null;
  record.ai_score = optionalNumber(input.ai_score ?? input['AI Score']);
  if (!record.licence_no) errors.push('Licence Number is required.');
  if (!record.operator) errors.push('Operator is required.');
  if (!record.state) errors.push('State is required.');
  if (!record.commodities.length) errors.push('At least one commodity is required.');
  if (record.latitude !== null && (!Number.isFinite(record.latitude) || record.latitude < -90 || record.latitude > 90)) errors.push('Latitude must be between -90 and 90.');
  if (record.longitude !== null && (!Number.isFinite(record.longitude) || record.longitude < -180 || record.longitude > 180)) errors.push('Longitude must be between -180 and 180.');
  if (record.area_m2 !== null && (!Number.isFinite(record.area_m2) || record.area_m2 < 0)) errors.push('Area must be a positive number.');
  if (record.ai_score !== null && (!Number.isInteger(record.ai_score) || record.ai_score < 0 || record.ai_score > 100)) errors.push('AI Score must be an integer between 0 and 100.');
  if (!['pending', 'verified', 'rejected'].includes(record.verification_status)) errors.push('Verification Status must be pending, verified, or rejected.');
  if (record.source_url && !/^https:\/\//i.test(record.source_url)) errors.push('Source URL must use HTTPS.');
  return { valid: errors.length === 0, errors, record };
}

function parseImport(filename, contents) {
  const buffer = Buffer.from(String(contents || ''), 'base64');
  if (!buffer.length || buffer.length > 4 * 1024 * 1024) throw new Error('Upload must be between 1 byte and 4 MB.');
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error('The upload does not contain a worksheet.');
  const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
  if (!rows.length) throw new Error('The upload contains no records.');
  if (rows.length > 1000) throw new Error('A single import may contain at most 1,000 records.');
  return rows.map((row, index) => ({ row: index + 2, ...validateRecord(row) }));
}

function parseCoordinateImport(contents) {
  const buffer = Buffer.from(String(contents || ''), 'base64');
  if (!buffer.length || buffer.length > 4 * 1024 * 1024) throw new Error('Upload must be between 1 byte and 4 MB.');
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (!rows.length || rows.length > 1000) throw new Error('Coordinates upload must contain 1–1,000 records.');
  return rows.map((row, index) => { const licence_no = normaliseLicence(row.licence_no ?? row['Licence Number']); const latitude = optionalNumber(row.latitude ?? row.Latitude); const longitude = optionalNumber(row.longitude ?? row.Longitude); const errors = []; if (!licence_no) errors.push('Licence Number is required.'); if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) errors.push('Latitude must be between -90 and 90.'); if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) errors.push('Longitude must be between -180 and 180.'); return { row: index + 2, valid: errors.length === 0, errors, record: { licence_no, latitude, longitude } }; });
}

function insertValues(record, userId) {
  return [crypto.randomUUID(), record.licence_no, normaliseLicence(record.licence_no), record.operator, record.state, record.lga, JSON.stringify(record.commodities), record.latitude, record.longitude, record.title_type, record.status, record.area_m2, record.issue_date, record.expiry_date, record.source, record.source_url, record.verification_status, record.last_verified_at, record.geological_notes, record.infrastructure_notes, record.risk_notes, record.ai_score, userId, userId];
}
const insertSql = 'INSERT INTO mining_records (id, licence_no, licence_no_normalized, operator, state, lga, commodities, latitude, longitude, title_type, status, area_m2, issue_date, expiry_date, source, source_url, verification_status, last_verified_at, geological_notes, infrastructure_notes, risk_notes, ai_score, created_by, updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) RETURNING *';

module.exports = { fields, insertSql, insertValues, normaliseLicence, parseCoordinateImport, parseImport, validateRecord };
