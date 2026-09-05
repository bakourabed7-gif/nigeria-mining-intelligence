const crypto = require('node:crypto');
const { records, sources } = require('./_lib/data');
const { analysis, score, search } = require('./_lib/intelligence');
const { configureResponse, rateLimit, routeFromRequest } = require('./_lib/http');

const STATE_CENTROIDS = { Kogi: [7.8, 6.7], Nasarawa: [8.5, 8.2], Zamfara: [12.2, 6.2], Plateau: [9.2, 9.5], Osun: [7.6, 4.5], Kwara: [8.9, 4.5] };
const developmentError = (error) => process.env.NODE_ENV === 'development' ? error.message : 'The service could not complete this request.';

function isConfiguredUser(body) {
  const email = process.env.NMI_AUTH_EMAIL;
  const hash = process.env.NMI_AUTH_PASSWORD_SHA256;
  if (!email || !hash) return null;
  const suppliedHash = crypto.createHash('sha256').update(String(body.password || '')).digest('hex');
  return String(body.email || '').toLowerCase() === email.toLowerCase() && crypto.timingSafeEqual(Buffer.from(suppliedHash), Buffer.from(hash));
}

async function checkSources() {
  const results = [];
  for (const source of sources()) {
    const checked_at = new Date().toISOString();
    try {
      const response = await fetch(source.url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8_000), headers: { 'User-Agent': 'Nigeria-Mining-Intelligence/1.1 (+source-health-check)' } });
      results.push({ source: source.id, status: response.status, content_type: response.headers.get('content-type') || '', checked_at });
    } catch (_) { results.push({ source: source.id, error: 'Source could not be reached', checked_at }); }
  }
  return results;
}

module.exports = async (req, res) => {
  configureResponse(req, res);
  if (!rateLimit(req, res)) return;
  if (req.method === 'OPTIONS') return res.status(204).setHeader('Allow', 'GET, POST, OPTIONS').end();
  const route = routeFromRequest(req);
  try {
    const titleRecords = records();
    if (req.method === 'GET' && route === '/health') return res.status(200).json({ ok: true, service: 'Nigeria Mining Intelligence', version: '1.1.0' });
    if (req.method === 'GET' && route === '/dashboard') return res.status(200).json({ titles: titleRecords.length, active: titleRecords.filter((record) => record.status === 'active').length, high_potential: titleRecords.filter((record) => score(record) >= 85).length, records: search(titleRecords).slice(0, 8) });
    if (req.method === 'GET' && route === '/sources') return res.status(200).json(sources());
    if (req.method === 'GET' && route === '/licences') { const results = search(titleRecords, req.query); return res.status(200).json({ count: results.length, results }); }
    if (req.method === 'GET' && route.startsWith('/licences/')) { const record = titleRecords.find((item) => item.id === route.split('/').pop()); return record ? res.status(200).json({ record, analysis: analysis(record) }) : res.status(404).json({ error: 'Licence not found' }); }
    if (req.method === 'POST' && route === '/analyse') { const body = req.body || {}; const record = titleRecords.find((item) => item.id === String(body.id) || item.licence_no === body.licence_no); return record ? res.status(200).json(analysis(record)) : res.status(404).json({ error: 'Licence not found' }); }
    if (req.method === 'GET' && route === '/report') { const record = titleRecords.find((item) => item.id === req.query.id); return record ? res.status(200).json({ title: 'Mining Investment Screening Report', generated_at: new Date().toISOString(), record, analysis: analysis(record) }) : res.status(404).json({ error: 'Licence not found' }); }
    if (req.method === 'GET' && route === '/export') return res.status(200).json(titleRecords.map((record) => ({ ...record, ai_score: score(record) })));
    if (req.method === 'GET' && route === '/map') return res.status(200).json(titleRecords.map((record) => { const point = STATE_CENTROIDS[record.state] || [9.1, 8.7]; return { ...record, lat: point[0], lon: point[1], ai_score: score(record), geometry_quality: 'state_centroid' }; }));
    if (req.method === 'GET' && route === '/metadata') return res.status(200).json({ product: 'Nigeria Mining Intelligence', version: '1.1.0', data_policy: 'source-backed and verification-aware', exact_polygons: false, full_national_dataset: false, generated_at: new Date().toISOString() });
    if (req.method === 'POST' && route === '/auth/login') { const configured = isConfiguredUser(req.body || {}); if (configured === null) return res.status(503).json({ error: 'Authentication is not configured.' }); return configured ? res.status(200).json({ authenticated: true, role: process.env.NMI_AUTH_ROLE || 'viewer', name: 'Mining Intelligence User' }) : res.status(401).json({ authenticated: false, error: 'Invalid credentials' }); }
    if (req.method === 'POST' && route === '/sync') return res.status(200).json({ results: await checkSources(), note: 'Health check only. Protected systems are not bypassed; imported records require validation and review.' });
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(404).json({ error: 'API route not found' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: developmentError(error) });
  }
};
