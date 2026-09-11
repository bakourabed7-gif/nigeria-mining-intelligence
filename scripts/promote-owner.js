const { pool, requireDatabase } = require('../api/_lib/db');

async function promote() {
  const email = String(process.env.NMI_OWNER_EMAIL || '').trim().toLowerCase();
  if (!email) throw new Error('NMI_OWNER_EMAIL must be set in the execution environment.');
  const result = await requireDatabase().query('UPDATE users SET role = $1, updated_at = NOW() WHERE email = $2 AND role <> $1 RETURNING id, email, role, plan_id', ['admin', email]);
  if (!result.rows.length) throw new Error('No eligible owner account was changed. Confirm the owner has registered with the configured email.');
  console.log(`Owner account promoted to admin. Plan remains ${result.rows[0].plan_id}. No credentials were logged.`);
}
promote().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(async () => { if (pool) await pool.end(); });
