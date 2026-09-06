const { isValidEmail } = require('../utils/validators');

function normalizeClaims(claims) {
  if (!claims) return null;
  if (claims.email && !isValidEmail(claims.email)) return null;
  
  const role = getRole(claims);
  const permissions = getPermissions(claims);
  
  return {
    id: claims.sub,
    email: claims.email,
    roles: role ? [role] : [],
    permissions: permissions
  };
}

function getRole(claims) {
  return claims['urn:app:role'] || claims.role;
}

function getPermissions(claims) {
  const v2Perms = claims['urn:app:permissions'];
  const v1Perms = claims.permissions;
  
  if (v2Perms) {
    return Array.isArray(v2Perms) ? v2Perms : [v2Perms];
  }
  if (v1Perms) {
    return Array.isArray(v1Perms) ? v1Perms : [v1Perms];
  }
  return [];
}

function claimsToUser(claims) {
  const normalized = normalizeClaims(claims);
  if (!normalized) return null;
  return { ...normalized, isAuthenticated: true };
}

module.exports = { normalizeClaims, claimsToUser };
