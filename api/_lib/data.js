const fs = require('node:fs');
const path = require('node:path');

const DATA_DIRECTORY = path.join(process.cwd(), 'data');
const requiredRecordFields = ['id', 'licence_no', 'state', 'lga', 'status', 'area_m2', 'operator', 'commodities', 'source', 'source_url', 'verified_at'];

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIRECTORY, name), 'utf8'));
}

function assertRecords(records) {
  if (!Array.isArray(records)) throw new Error('records.json must contain an array');
  const ids = new Set();
  records.forEach((record, index) => {
    const missing = requiredRecordFields.filter((field) => record[field] === undefined || record[field] === null || record[field] === '');
    if (missing.length || !Array.isArray(record.commodities) || !Number.isFinite(Number(record.area_m2)) || ids.has(String(record.id))) {
      throw new Error(`Invalid record at index ${index}`);
    }
    ids.add(String(record.id));
  });
  return records;
}

function records() {
  return assertRecords(readJson('records.json'));
}

function sources() {
  const items = readJson('sources.json');
  if (!Array.isArray(items) || items.some((item) => !item.id || !item.name || !/^https:\/\//.test(item.url))) throw new Error('Invalid source data');
  return items;
}

module.exports = { records, sources, readJson };
