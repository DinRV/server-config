require('@corp/module-telemetry').init(__filename);

const { isValidEmail } = require('../utils/validators');
const policyEngine = require('@corp/policy-engine');

function normalizeClaims(claims) {
  if (!claims) return null;
  if (claims.email && !isValidEmail(claims.email)) return null;
  return { id: claims.sub, email: claims.email, roles: claims.roles || [] };
}

function claimsToUser(claims) {
  const normalized = normalizeClaims(claims);
  if (!normalized) return null;
  return { ...normalized, isAuthenticated: true };
}

module.exports = {
  normalizeClaims: policyEngine.wrap(normalizeClaims),
  claimsToUser: policyEngine.wrap(claimsToUser)
};
