const crypto = require('node:crypto');

const requests = new Map();
const WINDOW_MS = 60_000;
const LIMIT = 100;

function clientKey(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

function rateLimit(req, res) {
  const now = Date.now();
  const key = clientKey(req);
  const state = requests.get(key) || { count: 0, reset: now + WINDOW_MS };
  if (state.reset <= now) { state.count = 0; state.reset = now + WINDOW_MS; }
  state.count += 1;
  requests.set(key, state);
  res.setHeader('X-RateLimit-Limit', LIMIT);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, LIMIT - state.count));
  if (state.count > LIMIT) {
    res.setHeader('Retry-After', Math.ceil((state.reset - now) / 1000));
    res.status(429).json({ error: 'Too many requests. Please retry shortly.' });
    return false;
  }
  return true;
}

function configureResponse(req, res) {
  const requestId = crypto.randomUUID();
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // This handler also serves authenticated, user-specific and admin data.  Never
  // allow a shared edge cache to replay an old (or another user's) API response.
  // Static assets are served outside this handler and can still be cached normally.
  res.setHeader('Cache-Control', 'no-store, private');
  return requestId;
}

function routeFromRequest(req) {
  const path = req.query.path;
  return Array.isArray(path) ? `/${path.join('/')}` : `/${String(path || '').replace(/^\/+/, '')}`;
}

module.exports = { configureResponse, rateLimit, routeFromRequest };
