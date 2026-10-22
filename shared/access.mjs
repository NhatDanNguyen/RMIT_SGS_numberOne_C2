// Business membership stays in realm roles. Tide governance may be mapped from
// realm-management; roles from arbitrary clients never grant administration.
export function rolesOf(claims) {
  const realm = Array.isArray(claims?.realm_access?.roles)
    ? claims.realm_access.roles.filter(role => typeof role === 'string') : [];
  const management = claims?.resource_access?.['realm-management']?.roles;
  return [...new Set([...realm, ...(Array.isArray(management) && management.includes('tide-realm-admin') ? ['tide-realm-admin'] : [])])];
}

export const hasRole = (claims, role) => rolesOf(claims).includes(role);
