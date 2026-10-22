import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateKeyPair, exportJWK } from 'jose';
import { loadConfig } from '../server/config.mjs';

test('public adapter is allowlisted, sender constrained, and rejects mismatched or secret-bearing input', async () => {
  mkdirSync('.local', { recursive: true });
  const directory = mkdtempSync('.local/test-config-');
  const path = join(directory, 'adapter.json');
  const { publicKey } = await generateKeyPair('EdDSA');
  const key = await exportJWK(publicKey);
  const raw = { realm: 'cobid', resource: 'cobid-web', 'auth-server-url': 'http://localhost:8080', 'public-client': true, vendorId: 'test-vendor', jwk: { keys: [key] }, unexpected: 'must-not-reach-browser' };
  const read = value => { writeFileSync(path, JSON.stringify(value)); return loadConfig({ TIDECLOAK_ADAPTER_PATH: path }); };
  const valid = read(raw);
  assert.ok(valid.adapter);
  assert.equal('unexpected' in valid.adapter, false);
  assert.deepEqual(valid.adapter.useDPoP, { mode: 'strict' });
  assert.equal(valid.adapter.redirectUri, 'http://localhost:5173/auth/redirect');
  for (const invalid of [
    { ...raw, realm: 'wrong' }, { ...raw, resource: 'wrong' },
    { ...raw, 'public-client': false }, { ...raw, credentials: { secret: 'synthetic' } },
    { ...raw, jwk: { keys: [{ ...key, d: 'synthetic-private-material' }] } },
    { ...raw, jwk: { keys: [] } },
  ]) assert.equal(read(invalid).adapter, null);
});
