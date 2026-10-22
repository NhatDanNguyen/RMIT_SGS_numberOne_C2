import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fixture, supplier, buyer, admin, ciphertext, policyBytes } from './helpers.mjs';

// Offline integration tests use locally generated keys, not a Tide login or a live ORK.
let app;
before(async () => { app = await fixture(); });
after(async () => { await app?.close(); });

test('public brief excludes synthetic commercial samples', async () => {
  const { status, data } = await app.request('/api/public-room');
  assert.equal(status, 200);
  assert.equal(data.suppliers.length, 3);
  assert.ok(data.suppliers.every(s => !('sample' in s)));
});
test('configuration never claims live verification', async () => {
  const health = await app.request('/api/health');
  const config = await app.request('/api/config');
  assert.equal(health.data.liveIntegrationVerified, false);
  assert.equal(config.data.governance.verified, false);
});
test('SDK DPoP relay permits enclave framing and still rejects the wrong issuer/client', async () => {
  const path = '/tide_dpop/iss/' + Buffer.from(app.config.issuer).toString('hex') + '/aud/' + Buffer.from(app.config.clientId).toString('hex') + '/tide_dpop_auth.html';
  const relay = await fetch(app.base + path);
  assert.equal(relay.status, 200);
  assert.equal(relay.headers.get('allow-csp-from'), '*');
  assert.ok(relay.headers.get('content-security-policy'));
  assert.equal(relay.headers.get('x-frame-options'), null);
  const refused = await fetch(app.base + '/tide_dpop/iss/6161/aud/6262/tide_dpop_auth.html');
  assert.equal(refused.status, 403);
  const ordinary = await fetch(app.base + '/api/health');
  assert.equal(ordinary.headers.get('x-frame-options'), 'SAMEORIGIN');
});
for (const [label, path, options, expected] of [
  ['anonymous cannot read identity', '/api/me', {}, 401],
  ['foreign origin is rejected', '/api/health', { headers: { Origin: 'https://elsewhere.invalid' } }, 403],
  ['signed member is accepted', '/api/me', { roles: buyer }, 200],
  ['wrong token issuer rejected', '/api/me', { roles: buyer, claims: { iss: 'https://other.invalid/realms/cobid' } }, 401],
  ['wrong token audience rejected', '/api/me', { roles: buyer, claims: { aud: 'other-client' } }, 401],
  ['wrong authorized party rejected', '/api/me', { roles: buyer, claims: { azp: 'other-client' } }, 401],
  ['expired session rejected', '/api/me', { roles: buyer, claims: { exp: Math.floor(Date.now() / 1000) - 60 } }, 401],
  ['unbound token rejected', '/api/me', { roles: buyer, claims: { cnf: {} } }, 401],
  ['a quote role alone is not business membership', '/api/me', { roles: ['cobid-quote-design', '_tide_decryptor'] }, 403],
  ['coordinator has no implicit read access', '/api/quotes/design', { roles: ['cobid-coordinator'] }, 403],
  ['admin has no implicit read access', '/api/quotes/design', { roles: admin }, 403],
  ['another supplier cannot read a restricted quote', '/api/quotes/design', { roles: ['cobid-supplier-video', 'cobid-quote-video', '_tide_decryptor'] }, 403],
  ['another supplier cannot write', '/api/quotes/video', { roles: supplier, method: 'PUT', body: ciphertext }, 403],
  ['non-admin cannot register policies', '/api/quotes/design/policy', { roles: buyer, method: 'PUT', body: { policy: policyBytes() } }, 403],
  ['policy for another quote role rejected', '/api/quotes/design/policy', { roles: admin, method: 'PUT', body: { policy: policyBytes({}, 'cobid-quote-video') } }, 400],
  ['expired policy rejected', '/api/quotes/design/policy', { roles: admin, method: 'PUT', body: { policy: policyBytes({ expiry: Math.floor(Date.now() / 1000) - 30 }) } }, 400],
  ['unknown supplier returns 404', '/api/quotes/not-a-studio', { roles: supplier }, 404],
  ['malformed access intent rejected', '/api/requests', { roles: buyer, method: 'POST', body: { supplier: 'design', reason: 'short' } }, 400],
]) test(label, async () => assert.equal((await app.request(path, options)).status, expected));

test('governance client role is recognised only from realm-management', async () => {
  const good = await app.request('/api/me', { roles: [], claims: { resource_access: { 'realm-management': { roles: admin } } } });
  assert.equal(good.status, 200);
  assert.ok(good.data.roles.includes('tide-realm-admin'));
  const bad = await app.request('/api/me', { roles: [], claims: { resource_access: { untrusted: { roles: admin } } } });
  assert.equal(bad.status, 403);
});
test('ciphertext lifecycle requires a policy, rejects stale writes and locks the policy', async () => {
  assert.equal((await app.request('/api/quotes/design', { method: 'PUT', roles: supplier, body: ciphertext })).status, 409);
  const policy = await app.request('/api/quotes/design/policy', { method: 'PUT', roles: admin, body: { policy: policyBytes() } });
  assert.equal(policy.status, 201);
  assert.equal(policy.data.networkVerified, false);
  assert.equal((await app.request('/api/quotes/design', { method: 'PUT', roles: supplier, body: ciphertext })).status, 201);
  assert.equal((await app.request('/api/quotes/design', { method: 'PUT', roles: supplier, body: ciphertext })).status, 409);
  assert.equal((await app.request('/api/quotes/design', { method: 'PUT', roles: supplier, body: { ...ciphertext, version: 1, note: 'plaintext' } })).status, 400);
  assert.equal((await app.request('/api/quotes/design/policy', { method: 'PUT', roles: admin, body: { policy: policyBytes() } })).status, 409);
  const quote = await app.request('/api/quotes/design', { roles: supplier });
  assert.equal(quote.status, 200);
  assert.equal(quote.data.ciphertext, ciphertext.ciphertext);
  assert.equal(quote.data.version, 1);
  assert.equal('note' in quote.data, false);
  assert.equal(app.store.quote('design').ciphertext, ciphertext.ciphertext);
  const events = await app.request('/api/activity', { roles: buyer });
  assert.equal(JSON.stringify(events.data).includes(ciphertext.ciphertext), false);
});
test('access requests are private, deduplicated intent with no permission grant', async () => {
  const input = { method: 'POST', roles: buyer, sub: 'buyer-1', body: { supplier: 'design', reason: 'Review the commercial quote' } };
  const first = await app.request('/api/requests', input);
  const again = await app.request('/api/requests', input);
  assert.equal(first.status, 201);
  assert.equal(first.data.status, 'intent-recorded');
  assert.equal(first.data.request.id, again.data.request.id);
  assert.equal((await app.request('/api/quotes/design', { roles: buyer, sub: 'buyer-1' })).status, 403);
  assert.equal((await app.request('/api/requests', { roles: buyer, sub: 'buyer-2' })).data.requests.length, 0);
  assert.equal((await app.request('/api/requests', { roles: ['cobid-coordinator'] })).data.requests.length, 1);
  const refreshed = await app.request('/api/requests', { roles: [...buyer, 'cobid-quote-design', '_tide_decryptor'], sub: 'buyer-1' });
  assert.equal(refreshed.data.requests[0].status, 'effective-for-current-session');
});
test('DPoP proof is bound to token and URL and cannot be replayed', async () => {
  const headers = await app.credentials('/api/me');
  assert.equal((await app.request('/api/me', { headers })).status, 200);
  assert.equal((await app.request('/api/me', { headers })).status, 401);
  assert.equal((await app.request('/api/me', { headers: await app.credentials('/api/room') })).status, 401);
  assert.equal((await app.request('/api/me', { headers: await app.credentials('/api/me', 'POST') })).status, 401);
  const bad = await app.credentials('/api/me', 'GET', buyer, 'test-user', {}, { ath: 'wrong-token-hash' });
  assert.equal((await app.request('/api/me', { headers: bad })).status, 401);
  const bearer = await app.credentials('/api/me');
  bearer.Authorization = bearer.Authorization.replace('DPoP ', 'Bearer ');
  assert.equal((await app.request('/api/me', { headers: bearer })).status, 401);
  const missingProof = await app.credentials('/api/me');
  delete missingProof.DPoP;
  assert.equal((await app.request('/api/me', { headers: missingProof })).status, 401);
});
test('missing adapter fails closed without disabling public preview', async () => {
  const incomplete = await fixture({ configured: false });
  try {
    assert.equal((await incomplete.request('/api/health')).data.identityConfigured, false);
    assert.equal((await incomplete.request('/api/me', { roles: buyer })).status, 503);
  } finally { await incomplete.close(); }
});
