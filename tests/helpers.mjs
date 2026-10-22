import { once } from 'node:events';
import { createHash, randomUUID } from 'node:crypto';
import { generateKeyPair, exportJWK, SignJWT, calculateJwkThumbprint } from 'jose';
import { createApp } from '../server/app.mjs';
import { createStore } from '../server/store.mjs';
import { loadConfig } from '../server/config.mjs';
import * as Models from '../.local/tide-models.mjs';

export const supplier = ['cobid-supplier-design', 'cobid-quote-design', '_tide_encryptor', '_tide_decryptor'];
export const buyer = ['cobid-buyer'];
export const admin = ['tide-realm-admin'];
export const ciphertext = { ciphertext: 'Y'.repeat(64), format: 'string', version: 0 };

export function policyBytes(overrides = {}, role = 'cobid-quote-design') {
  const policy = new Models.Policy({ version: Models.Policy.latestVersion, contractId: 'RelationshipAttestation:1', modelId: ['PolicyEnabledEncryption:1', 'PolicyEnabledDecryption:1'], keyId: 'offline-vendor', approvalType: Models.ApprovalType.IMPLICIT, executionType: Models.ExecutionType.PRIVATE, params: new Map([['subjectType', 'Role'], ['subjectId', role], ['assignmentId', 'cobid-quote-design-v1'], ['roles', JSON.stringify(['_tide_encryptor', '_tide_decryptor'])]]), ...overrides });
  // These bytes are a structural fixture, never a cryptographically valid Tide policy.
  policy.signature = new Uint8Array(64).fill(7);
  return Buffer.from(policy.toBytes()).toString('base64');
}

export async function fixture({ configured = true, mode = 'tide' } = {}) {
  const signing = await generateKeyPair('EdDSA');
  const jwk = { ...await exportJWK(signing.publicKey), kid: 'offline-test', alg: 'EdDSA' };
  const proofKeys = await generateKeyPair('ES256');
  const proofJwk = await exportJWK(proofKeys.publicKey);
  const thumb = await calculateJwkThumbprint(proofJwk);
  const config = { ...loadConfig({ AUTH_MODE: mode }), issue: '', adapter: mode === 'tide' && configured ? { vendorId: 'offline-vendor', jwk: { keys: [jwk] } } : null };
  const store = createStore(':memory:');
  const server = createApp(config, store).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  async function credentials(path, method = 'GET', roles = buyer, sub = 'test-user', claims = {}, binding = {}) {
    const token = await new SignJWT({ azp: config.clientId, cnf: { jkt: thumb }, preferred_username: sub, realm_access: { roles }, ...claims })
      .setProtectedHeader({ alg: 'EdDSA', kid: jwk.kid }).setSubject(sub).setIssuer(claims.iss ?? config.issuer)
      .setAudience(claims.aud ?? config.audience).setIssuedAt(claims.iat).setExpirationTime(claims.exp ?? '5m').sign(signing.privateKey);
    const proof = await new SignJWT({ htm: method, htu: config.origin + path.split('?')[0], ath: createHash('sha256').update(token).digest('base64url'), ...binding })
      .setProtectedHeader({ alg: 'ES256', typ: 'dpop+jwt', jwk: proofJwk }).setIssuedAt().setJti(randomUUID()).sign(proofKeys.privateKey);
    return { Authorization: 'DPoP ' + token, DPoP: proof };
  }
  async function request(path, { method = 'GET', roles, sub, body, headers = {}, claims } = {}) {
    const auth = roles ? await credentials(path, method, roles, sub, claims) : {};
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...auth, ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, headers: response.headers, data: await response.json() };
  }
  return { base, store, config, credentials, request, close: async () => { await new Promise(resolve => server.close(resolve)); store.close(); } };
}
