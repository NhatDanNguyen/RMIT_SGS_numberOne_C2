import { createLocalJWKSet, jwtVerify, decodeProtectedHeader, importJWK, calculateJwkThumbprint } from 'jose';
import { createHash } from 'node:crypto';
import { membershipRoles } from '../shared/catalog.mjs';
export const rolesOf = claims => Array.isArray(claims?.realm_access?.roles) ? claims.realm_access.roles.filter(r => typeof r === 'string') : [];
export const hasRole = (claims, role) => rolesOf(claims).includes(role);
export const isMember = claims => membershipRoles.some(r => hasRole(claims, r));
export function makeVerifier(config, store) {
  const jwks = config.adapter ? createLocalJWKSet(config.adapter.jwk) : null;
  return async function verify(req) {
    if (!jwks) throw Object.assign(new Error('Identity setup incomplete.'), { status: 503 });
    const auth = req.get('authorization') || '';
    if (!auth.startsWith('DPoP ')) throw new Error('Authentication required');
    const token = auth.slice(5);
    const { payload } = await jwtVerify(token, jwks, {
      issuer: config.issuer, audience: config.audience, algorithms: ['EdDSA'],
      requiredClaims: ['sub', 'exp', 'iat', 'azp'], clockTolerance: 5,
    });
    if (payload.azp !== config.clientId || typeof payload.sub !== 'string' || payload.iat > Date.now()/1000 + 30 || !payload.cnf?.jkt)
      throw new Error('Invalid session');
    const proof = req.get('dpop');
    if (!proof) throw new Error('Proof required');
    const header = decodeProtectedHeader(proof);
    if (header.typ !== 'dpop+jwt' || !['ES256', 'EdDSA'].includes(header.alg) || !header.jwk || header.jwk.d || header.jwk.k)
      throw new Error('Invalid proof');
    const key = await importJWK(header.jwk, header.alg);
    const { payload: p } = await jwtVerify(proof, key, { algorithms: [header.alg] });
    const thumb = await calculateJwkThumbprint(header.jwk);
    const expectedUrl = config.origin + new URL(req.originalUrl, config.origin).pathname;
    if (thumb !== payload.cnf.jkt || p.ath !== createHash('sha256').update(token).digest('base64url') ||
        p.htm !== req.method || p.htu !== expectedUrl || typeof p.iat !== 'number' ||
        Math.abs(Date.now()/1000 - p.iat) > 120 || typeof p.jti !== 'string' || !p.jti || p.jti.length > 200)
      throw new Error('Invalid proof binding');
    if (!store.claimProof(thumb + ':' + p.jti, Math.ceil((p.iat + 125) * 1000))) throw new Error('Replayed proof');
    return payload;
  };
}
