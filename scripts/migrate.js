const fs = require('node:fs');
const path = require('node:path');
const { pool } = require('../api/_lib/db');

async function migrate() {
  if (!pool) throw new Error('DATABASE_URL or POSTGRES_URL is required to run migrations.');
  await pool.query(fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8'));
  await pool.end();
  console.log('Database schema applied successfully. No credentials were logged.');
}
migrate().catch((error) => { console.error(error.message); process.exitCode = 1; });
