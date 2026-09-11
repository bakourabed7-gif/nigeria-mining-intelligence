const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/index');

function response() {
  return {
    headers: {}, statusCode: 200,
    setHeader(key, value) { this.headers[key] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    end() { this.ended = true; return this; }
  };
}

test('health endpoint is public', async () => {
  const res = response();
  await handler({ method: 'GET', query: { path: 'health' }, headers: {}, socket: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
});

test('mining dashboard requires a secure authenticated session', async () => {
  const res = response();
  await handler({ method: 'GET', query: { path: 'dashboard' }, headers: {}, socket: {} }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'Authentication required.');
});
