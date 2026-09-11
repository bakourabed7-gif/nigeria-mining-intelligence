const { pool, requireDatabase } = require('../api/_lib/db');

const expected = {
  plans: ['id', 'name', 'rank', 'created_at'],
  users: ['id', 'email', 'password_hash', 'role', 'plan_id', 'created_at', 'updated_at'],
  sessions: ['id', 'user_id', 'token_hash', 'expires_at', 'created_at', 'last_seen_at'],
  password_reset_tokens: ['id', 'user_id', 'token_hash', 'expires_at', 'used_at', 'created_at'],
  saved_licences: ['user_id', 'licence_id', 'created_at'],
  reports: ['id', 'user_id', 'licence_id', 'created_at'],
  analysis_history: ['id', 'user_id', 'licence_id', 'score', 'created_at']
};

async function audit() {
  const db = requireDatabase();
  const result = await db.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position");
  const found = new Map();
  result.rows.forEach(({ table_name, column_name }) => found.set(table_name, [...(found.get(table_name) || []), column_name]));
  const missing = [];
  for (const [table, columns] of Object.entries(expected)) {
    const actual = found.get(table) || [];
    const absent = columns.filter((column) => !actual.includes(column));
    if (absent.length) missing.push(`${table}: ${absent.join(', ')}`);
  }
  console.log(`Read-only audit inspected ${found.size} public tables. Credentials and row data were not read or printed.`);
  if (found.has('user')) console.log('Notice: public.user exists but is not referenced by this application. It was not modified.');
  if (found.has('licence')) console.log('Notice: public.licence exists but is not referenced by this application. It was not modified.');
  if (missing.length) throw new Error(`Application schema is incomplete: ${missing.join('; ')}`);
  console.log('Application schema matches the expected tables and columns.');
}

audit().catch((error) => { console.error(`Schema audit failed: ${error.message}`); process.exitCode = 1; }).finally(async () => { if (pool) await pool.end(); });
