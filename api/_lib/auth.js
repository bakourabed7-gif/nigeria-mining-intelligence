const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { requireDatabase } = require('./db');

const COOKIE = 'nmi_session';
const SESSION_DAYS = 30;
const roles = new Set(['free', 'professional', 'investor', 'admin']);
const premiumRoles = new Set(['professional', 'investor', 'admin']);
const entitlements = Object.freeze({
  free: Object.freeze({ fullSearch: false, numericAiScore: false, fullAnalysis: false, reports: false, savedOpportunities: false, exports: false, dueDiligence: false }),
  professional: Object.freeze({ fullSearch: true, numericAiScore: true, fullAnalysis: true, reports: true, savedOpportunities: true, exports: true, dueDiligence: true }),
  investor: Object.freeze({ fullSearch: true, numericAiScore: true, fullAnalysis: true, reports: true, savedOpportunities: true, exports: true, dueDiligence: true, advancedDueDiligence: true, opportunityComparison: true, advancedRiskFlags: true, investorReports: true, portfolioScreening: true, investorIntelligence: true })
});

function parseCookies(header = '') { return Object.fromEntries(header.split(';').map((item) => item.trim().split('=').map(decodeURIComponent)).filter(([key]) => key)); }
function tokenHash(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
function normaliseEmail(email) { return String(email || '').trim().toLowerCase(); }
function validPassword(password) { return typeof password === 'string' && password.length >= 12 && password.length <= 128; }
function publicUser(user) { return { id: user.id, email: user.email, role: user.role, plan: user.plan_id || user.plan || user.role, created_at: user.created_at }; }
function isPremium(user) { return premiumRoles.has(user.role); }
function entitlementsFor(user) { return entitlements[user?.role] || (user?.role === 'admin' ? entitlements.investor : entitlements.free); }
function isAdmin(user) { return user?.role === 'admin'; }
function isConfiguredOwner(user) { const ownerEmail = normaliseEmail(process.env.NMI_OWNER_EMAIL); return Boolean(ownerEmail && normaliseEmail(user?.email) === ownerEmail); }

async function promoteOwnerIfConfigured(user) {
  if (!isConfiguredOwner(user) || user.role === 'admin') return user;
  const result = await requireDatabase().query('UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, password_hash, role, plan_id, created_at', ['admin', user.id]);
  return result.rows[0];
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`);
}
function clearSessionCookie(res) { res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`); }

async function createUser({ email, password }) {
  const cleanEmail = normaliseEmail(email);
  if (!/^\S+@\S+\.\S+$/.test(cleanEmail) || cleanEmail.length > 254) { const error = new Error('Enter a valid email address.'); error.statusCode = 400; throw error; }
  if (!validPassword(password)) { const error = new Error('Password must be 12–128 characters.'); error.statusCode = 400; throw error; }
  const db = requireDatabase();
  const id = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const result = await db.query('INSERT INTO users (id, email, password_hash, role, plan_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, role, plan_id, created_at', [id, cleanEmail, passwordHash, 'free', 'free']);
    return result.rows[0];
  } catch (error) {
    if (error.code === '23505') { const safe = new Error('An account with that email already exists.'); safe.statusCode = 409; throw safe; }
    throw error;
  }
}

async function verifyUser({ email, password }) {
  const db = requireDatabase();
  const result = await db.query('SELECT id, email, password_hash, role, plan_id, created_at FROM users WHERE email = $1', [normaliseEmail(email)]);
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(String(password || ''), user.password_hash))) { const error = new Error('Invalid email or password.'); error.statusCode = 401; throw error; }
  return promoteOwnerIfConfigured(user);
}

async function createSession(user, res) {
  const db = requireDatabase();
  const token = crypto.randomBytes(32).toString('base64url');
  await db.query('INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL \'30 days\')', [crypto.randomUUID(), user.id, tokenHash(token)]);
  setSessionCookie(res, token);
}

async function currentUser(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (!token) return null;
  const db = requireDatabase();
  const result = await db.query("SELECT u.id, u.email, u.role, u.plan_id, u.created_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > NOW()", [tokenHash(token)]);
  return result.rows[0] || null;
}

async function requireUser(req, res) {
  const user = await currentUser(req);
  if (!user) { res.status(401).json({ error: 'Authentication required.' }); return null; }
  return user;
}
async function destroySession(req, res) { const token = parseCookies(req.headers.cookie)[COOKIE]; if (token && poolAvailable()) await requireDatabase().query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash(token)]); clearSessionCookie(res); }
function poolAvailable() { return Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL); }

module.exports = { createSession, createUser, currentUser, destroySession, entitlements, entitlementsFor, isAdmin, isConfiguredOwner, isPremium, premiumRoles, promoteOwnerIfConfigured, publicUser, requireUser, roles, verifyUser };
