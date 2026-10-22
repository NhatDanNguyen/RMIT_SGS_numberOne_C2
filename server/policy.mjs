import * as Models from '../.local/tide-models.mjs';
export const quoteId = supplier => 'cobid-quote-' + supplier + '-v1';
export const quoteRole = supplier => 'cobid-quote-' + supplier;
export function inspectPolicy(b64, supplier, vendorId) {
  const policy = Models.Policy.from(new Uint8Array(Buffer.from(b64, 'base64')));
  const get = key => String(policy.params.entries.get(key) ?? '');
  if (policy.contractId !== 'RelationshipAttestation:1' || policy.keyId !== vendorId ||
      policy.executionType !== Models.ExecutionType.PRIVATE || policy.approvalType !== Models.ApprovalType.IMPLICIT ||
      get('subjectType') !== 'Role' || get('subjectId') !== quoteRole(supplier) || get('clientId') ||
      get('assignmentId') !== quoteId(supplier) || get('roles') !== JSON.stringify(['_tide_encryptor','_tide_decryptor']) ||
      !policy.signature || policy.signature.length !== 64)
    throw new Error('The policy does not match this quote and realm.');
  const models = policy.modelIds;
  if (!Array.isArray(models) || models.length !== 2 || !models.includes('PolicyEnabledEncryption:1') || !models.includes('PolicyEnabledDecryption:1'))
    throw new Error('Unexpected policy models.');
  if (policy.expiry && Number(policy.expiry) < Date.now()/1000) throw new Error('Policy has expired.');
  return policy;
}
