const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const authShell = fs.readFileSync(path.join(root, 'auth-shell.css'), 'utf8');
const mobileCss = fs.readFileSync(path.join(root, 'mobile.css'), 'utf8');
const sections = ['dashboard', 'licences', 'map', 'analyst', 'reports', 'saved', 'profile'];

test('authenticated desktop navigation exposes every platform section and Home', () => {
  const header = html.match(/<nav class="primary-nav"[\s\S]*?<\/nav>/)?.[0] || '';
  assert.match(header, />Home</);
  sections.forEach((section) => assert.match(header, new RegExp(`data-page="${section}"`)));
  assert.match(html, /class="brand" href="#dashboard"/);
});

test('mobile navigation exposes the same protected sections', () => {
  const mobile = html.match(/<nav class="mobile-nav"[\s\S]*?<\/nav>/)?.[0] || '';
  sections.forEach((section) => assert.match(mobile, new RegExp(`data-page="${section}"`)));
});

test('all navigation targets are handled by the protected application router', () => {
  sections.forEach((section) => assert.match(app, new RegExp(`page === '${section}'`)));
  assert.match(app, /if \(!publicPages\.includes\(page\) && !user\)/);
});

test('dashboard summary cards route to useful licence and plan views', () => {
  assert.match(app, /class="stat-card card" onclick="nav\('licences'\)"/);
  assert.match(app, /nav\('licences',\{status:'active'\}\)/);
  assert.match(app, /nav\('licences',\{high_potential:'true'\}\)/);
  assert.match(app, /onclick="nav\('plans'\)"/);
  assert.match(app, /data-high-potential/);
});

test('logged-out shell hides authenticated navigation and login restores it', () => {
  assert.match(html, /data-auth/);
  assert.match(html, /data-public/);
  assert.match(authShell, /\[hidden\]\s*\{\s*display:\s*none\s*!important/);
  assert.match(app, /node\.hidden = !authed/);
  assert.match(app, /node\.hidden = authed/);
  assert.match(app, /user = result\.user; setShell\(\); nav\('dashboard'\)/);
  assert.match(app, /user = null; setShell\(\); nav\('landing'\)/);
  assert.match(app, /node\.hidden = user\?\.role !== 'admin'/);
  assert.match(html, /data-page="admin" data-admin/);
});

test('mobile layout provides card-based opportunities and tap-friendly actions', () => {
  assert.match(mobileCss, /@media \(max-width: 900px\)/);
  assert.match(mobileCss, /@media \(max-width: 768px\)[\s\S]*\.table thead \{ display: none/);
  const wideTabletRules = mobileCss.match(/@media \(max-width: 900px\) \{([\s\S]*?)\n\}/)?.[1] || '';
  assert.doesNotMatch(wideTabletRules, /\.table thead \{ display: none/);
  assert.match(mobileCss, /\.table thead \{ display: none/);
  assert.match(mobileCss, /\.table td::before/);
  assert.match(mobileCss, /\.analyse-action \{ width: 100%; min-height: 46px/);
  assert.match(app, /data-label="Licence"/);
  assert.match(app, /class="analyse-action"/);
  assert.doesNotMatch(app, />Upgrade Plan</);
  assert.match(app, />Coming Soon</);
});
