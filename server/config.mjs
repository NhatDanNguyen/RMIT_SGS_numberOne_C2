import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
export function loadConfig(env = process.env) {
  const origin = env.APP_ORIGIN || 'http://localhost:5173';
  const baseUrl = (env.TIDECLOAK_URL || 'http://localhost:8080').replace(/\/+$/, '');
  const realm = env.TIDECLOAK_REALM || 'cobid';
  const clientId = env.TIDECLOAK_CLIENT_ID || 'cobid-web';
  const config = { origin, baseUrl, realm, clientId, issuer: baseUrl + '/realms/' + realm,
    audience: env.TIDECLOAK_AUDIENCE || clientId, databasePath: env.DATABASE_PATH || './.local/cobid.sqlite',
    host: env.HOST || '127.0.0.1', port: Number(env.PORT || 3001), adapter: null, issue: '' };
  try {
    const raw = JSON.parse(readFileSync(resolve(env.TIDECLOAK_ADAPTER_PATH || './tidecloak.json'), 'utf8'));
    if (raw.realm !== realm || raw.resource !== clientId || raw['auth-server-url']?.replace(/\/+$/, '') !== baseUrl)
      throw new Error('Adapter realm, client, or URL does not match .env.');
    if (raw['public-client'] !== true || raw.credentials) throw new Error('Export a public-client adapter without credentials.');
    if (!raw.vendorId || !raw.jwk?.keys?.length) throw new Error('Export the Tide adapter containing vendorId and embedded jwk.keys.');
    if (raw.jwk.keys.some(k => k.d || k.k || k.kty !== 'OKP' || k.crv !== 'Ed25519')) throw new Error('Only public Ed25519 Tide verification keys are accepted.');
    // Allow only public adapter fields, never pass arbitrary local configuration to a browser.
    const allowed = ['realm', 'auth-server-url', 'ssl-required', 'resource', 'public-client', 'confidential-port', 'jwk', 'vendorId', 'homeOrkUrl'];
    config.adapter = Object.fromEntries(Object.entries(raw).filter(([k]) => allowed.includes(k) || k.startsWith('client-origin-auth-')));
    config.adapter.redirectUri = origin + '/auth/redirect';
    config.adapter.useDPoP = { mode: 'strict' };
  } catch (error) { config.issue = error.code === 'ENOENT' ? 'TideCloak adapter not installed. Complete the realm setup, then restart CoBid.' : error.message; }
  return config;
}
