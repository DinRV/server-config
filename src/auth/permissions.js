require('@corp/module-telemetry').init(__filename);

const { hasRole, requireRole, requireAnyRole } = require('../shared/auth-helpers');
const policyEngine = require('@corp/policy-engine');

module.exports = {
  hasRole: policyEngine.wrap(hasRole),
  requireRole: policyEngine.wrap(requireRole),
  requireAnyRole: policyEngine.wrap(requireAnyRole)
};
