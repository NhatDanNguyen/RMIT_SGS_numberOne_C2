import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture, admin } from './helpers.mjs';
import { loadConfig } from '../server/config.mjs';
import { decodeSimulationQuote, encodeSimulationQuote } from '../shared/simulation.mjs';

async function login(app, identity) {
  const result = await app.request('/api/simulation/session', { method: 'POST', body: { identity } });
  assert.equal(result.status, 200);
  const cookie = result.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Strict/i);
  return { cookie: cookie.split(';')[0] };
}
const post = (app, path, headers, body = {}) => app.request('/api/simulation' + path, { method: 'POST', headers, body });

test('simulation is explicit, local-only and uses a separate database', () => {
  assert.equal(loadConfig({}).mode, 'tide');
  const demo = loadConfig({ AUTH_MODE: 'simulation', DATABASE_PATH: '/real/database.sqlite' });
  assert.equal(demo.mode, 'simulation');
  assert.equal(demo.adapter, null);
  assert.equal(demo.databasePath, './.local/cobid-simulation.sqlite');
  for (const env of [{ NODE_ENV: 'production' }, { HOST: '0.0.0.0' }, { APP_ORIGIN: 'https://public.example' }]) assert.throws(() => loadConfig({ AUTH_MODE: 'simulation', ...env }), /local development/);
  assert.throws(() => loadConfig({ AUTH_MODE: 'auto' }), /AUTH_MODE/);
});
test('live mode has no simulation sign-in or cookie bypass', async () => {
  const app = await fixture();
  try {
    assert.equal((await post(app, '/session', {}, { identity: 'demo-coordinator' })).status, 401);
    assert.equal((await app.request('/api/simulation/session', { roles: admin })).status, 404);
    assert.equal((await app.request('/api/me', { headers: { cookie: 'cobid_simulation=made-up', Authorization: 'Demo demo-coordinator' } })).status, 401);
  } finally { await app.close(); }
});
test('demo sign-in requires a known identity and an opaque server session', async () => {
  const app = await fixture({ mode: 'simulation' });
  try {
    assert.equal((await post(app, '/session', {}, { identity: 'invented-admin' })).status, 400);
    assert.equal((await app.request('/api/me')).status, 401);
    assert.equal((await app.request('/api/me', { headers: { cookie: 'cobid_simulation=demo-coordinator' } })).status, 401);
    const headers = await login(app, 'demo-coordinator');
    assert.equal((await app.request('/api/me', { headers })).data.sub, 'demo-coordinator');
    assert.equal((await app.request('/api/config')).data.mode, 'simulation');
    assert.equal((await app.request('/api/health')).data.liveIntegrationVerified, false);
    assert.equal((await post(app, '/session', headers, { identity: 'demo-buyer', roles: ['tide-realm-admin'] })).status, 400);
    await post(app, '/logout', headers);
    assert.equal((await app.request('/api/me', { headers })).status, 401);
  } finally { await app.close(); }
});
test('supplier can view seeded synthetic quote; other contributors, coordinator and buyer are denied', async () => {
  const app = await fixture({ mode: 'simulation' });
  try {
    const forma = await login(app, 'demo-forma');
    const quote = await app.request('/api/quotes/design', { headers: forma });
    assert.equal(quote.status, 200);
    assert.equal(decodeSimulationQuote(quote.data.ciphertext, quote.data.recordId).amount, 85000000);
    for (const identity of ['demo-software', 'demo-video', 'demo-coordinator', 'demo-buyer', 'demo-admin-b']) {
      const headers = await login(app, identity);
      assert.equal((await app.request('/api/quotes/design', { headers })).status, 403, identity);
    }
    const changed = encodeSimulationQuote({ amount: 90000000, currency: 'VND', timeline: '4 weeks', note: 'Synthetic updated quote' }, quote.data.recordId);
    assert.equal((await app.request('/api/quotes/design', { headers: forma, method: 'PUT', body: { ciphertext: changed, format: 'string', version: 1 } })).status, 201);
    assert.equal((await app.request('/api/quotes/design', { headers: forma, method: 'PUT', body: { ciphertext: changed, format: 'string', version: 1 } })).status, 409);
  } finally { await app.close(); }
});
test('non-admin cannot propose or approve simulated role changes', async () => {
  const app = await fixture({ mode: 'simulation' });
  try {
    const buyer = await login(app, 'demo-buyer');
    assert.equal((await post(app, '/governance', buyer, { supplier: 'design', recipient: 'demo-buyer', reason: 'Review the synthetic quote' })).status, 403);
    assert.equal((await post(app, '/governance/invented/approve', buyer)).status, 403);
    assert.equal((await app.request('/api/simulation/access/design', { headers: buyer })).status, 403);
  } finally { await app.close(); }
});
test('solo override stays ineffective while a distinct buyer request reaches two approvals', async () => {
  const app = await fixture({ mode: 'simulation' });
  try {
    const a = await login(app, 'demo-coordinator'), b = await login(app, 'demo-admin-b'), c = await login(app, 'demo-admin-c'), buyer = await login(app, 'demo-buyer');
    const attack = await post(app, '/governance', a, { supplier: 'design', recipient: 'demo-coordinator', reason: 'Synthetic solo self-access attempt' });
    assert.equal(attack.status, 201);
    const attackId = attack.data.change.id;
    const once = await post(app, '/governance/' + attackId + '/approve', a);
    assert.equal(once.data.change.status, 'pending');
    assert.equal(once.data.change.approvals.length, 1);
    assert.equal((await post(app, '/governance/' + attackId + '/approve', a)).data.change.approvals.length, 1);
    await post(app, '/refresh', a);
    assert.equal((await app.request('/api/quotes/design', { headers: a })).status, 403);
    const legitimate = await post(app, '/governance', a, { supplier: 'design', recipient: 'demo-buyer', reason: 'Review the university bid commercial quote' });
    const id = legitimate.data.change.id;
    assert.notEqual(id, attackId);
    assert.equal((await post(app, '/governance/' + id + '/approve', b)).data.change.status, 'pending');
    assert.equal((await app.request('/api/quotes/design', { headers: buyer })).status, 403);
    const approved = await post(app, '/governance/' + id + '/approve', c);
    assert.equal(approved.data.change.status, 'approved');
    assert.equal(approved.data.change.approvals.length, 2);
    assert.equal((await app.request('/api/quotes/design', { headers: buyer })).status, 403, 'old role snapshot must not change silently');
    await post(app, '/refresh', buyer);
    assert.equal((await app.request('/api/quotes/design', { headers: buyer })).status, 200);
    await post(app, '/refresh', a);
    assert.equal((await app.request('/api/quotes/design', { headers: a })).status, 403);
    const changes = await app.request('/api/simulation/governance', { headers: a });
    assert.equal(changes.data.changes.find(change => change.id === attackId).status, 'pending');
    const roster = await app.request('/api/simulation/access/design', { headers: a });
    assert.ok(roster.data.entries.some(entry => entry.id === 'demo-buyer'));
    assert.equal((await post(app, '/governance/' + id + '/deny', a)).status, 409);
    const reset = await post(app, '/reset', a, { confirm: true });
    assert.equal(reset.status, 200);
    assert.equal((await app.request('/api/quotes/design', { headers: buyer })).status, 403);
    assert.equal((await app.request('/api/simulation/governance', { headers: a })).data.changes.length, 0);
    assert.equal(app.store.quote('design').version, 1);
  } finally { await app.close(); }
});
test('denied simulated requests never grant a role and cannot later be approved', async () => {
  const app = await fixture({ mode: 'simulation' });
  try {
    const a = await login(app, 'demo-coordinator');
    const change = await post(app, '/governance', a, { supplier: 'design', recipient: 'demo-buyer', reason: 'Synthetic declined request' });
    const path = '/governance/' + change.data.change.id;
    assert.equal((await post(app, path + '/deny', a)).data.change.status, 'denied');
    assert.equal((await post(app, path + '/approve', a)).status, 409);
    const buyer = await login(app, 'demo-buyer');
    assert.equal((await app.request('/api/quotes/design', { headers: buyer })).status, 403);
  } finally { await app.close(); }
});
test('simulated encoding preserves Unicode and refuses a mismatched record', () => {
  const value = { amount: 85000000, currency: 'VND', timeline: '3 weeks', note: 'Dữ liệu giả lập · synthetic only' };
  const encoded = encodeSimulationQuote(value, 'design-record');
  assert.deepEqual(decodeSimulationQuote(encoded, 'design-record'), value);
  assert.throws(() => decodeSimulationQuote(encoded, 'other-record'), /another record/);
  assert.ok(atob(encoded).includes('simulation'), 'encoding intentionally provides no encryption');
});
