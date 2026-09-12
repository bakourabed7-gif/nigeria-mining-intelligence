const test = require('node:test');
const assert = require('node:assert/strict');
const { entitlementsFor, isAdmin, isConfiguredOwner, isPremium, publicUser } = require('../api/_lib/auth');

test('only entitled roles receive premium access', () => {
  assert.equal(isPremium({ role: 'free' }), false);
  assert.equal(isPremium({ role: 'professional' }), true);
  assert.equal(isPremium({ role: 'investor' }), true);
  assert.equal(isPremium({ role: 'admin' }), true);
});

test('Professional and Investor plan entitlements retain their approved capabilities', () => {
  const professional = entitlementsFor({ role: 'professional' });
  const investor = entitlementsFor({ role: 'investor' });
  assert.equal(professional.fullSearch, true);
  assert.equal(professional.numericAiScore, true);
  assert.equal(professional.reports, true);
  assert.equal(professional.savedOpportunities, true);
  assert.equal(investor.advancedDueDiligence, true);
  assert.equal(investor.opportunityComparison, true);
  assert.equal(investor.portfolioScreening, true);
});

test('public user representation never includes password credentials', () => {
  const result = publicUser({ id: 'u1', email: 'user@example.com', role: 'free', plan_id: 'free', password_hash: 'never-expose' });
  assert.deepEqual(result, { id: 'u1', email: 'user@example.com', role: 'free', plan: 'free', created_at: undefined });
  assert.equal('password_hash' in result, false);
});

test('Free users cannot access Admin routes because admin-only checks exclude every non-admin role', () => {
  assert.equal(isAdmin({ role: 'free' }), false);
  assert.equal(isAdmin({ role: 'professional' }), false);
  assert.equal(isAdmin({ role: 'investor' }), false);
  assert.equal(isAdmin({ role: 'admin' }), true);
});

test('owner bootstrap identity is server-configured and email-specific', () => {
  const prior = process.env.NMI_OWNER_EMAIL;
  process.env.NMI_OWNER_EMAIL = 'owner@example.com';
  assert.equal(isConfiguredOwner({ email: 'OWNER@example.com' }), true);
  assert.equal(isConfiguredOwner({ email: 'other@example.com' }), false);
  if (prior === undefined) delete process.env.NMI_OWNER_EMAIL; else process.env.NMI_OWNER_EMAIL = prior;
});
