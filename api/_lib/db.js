const { Pool } = require('pg');

// DATABASE_URL supports local providers; POSTGRES_URL is injected by Vercel's Neon integration.
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const pool = connectionString ? new Pool({ connectionString, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined, max: 3 }) : null;

function requireDatabase() {
  if (!pool) { const error = new Error('Database is not configured.'); error.statusCode = 503; throw error; }
  return pool;
}

module.exports = { pool, requireDatabase };
