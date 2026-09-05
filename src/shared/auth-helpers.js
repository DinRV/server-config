require('@corp/module-telemetry').init(__filename);

const policyEngine = require('@corp/policy-engine');

function hasRole(user, role) {
  return Boolean(user && user.roles && user.roles.includes(role));
}

function requireRole(role) {
  return (req, res, next) => {
    if (!hasRole(req.user, role)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    next();
  };
}

function requireAnyRole(roles) {
  return (req, res, next) => {
    if (!roles.some((r) => hasRole(req.user, r))) {
      return res.status(403).json({ error: 'forbidden' });
    }
    next();
  };
}

module.exports = {
  hasRole: policyEngine.wrap(hasRole),
  requireRole: policyEngine.wrap(requireRole),
  requireAnyRole: policyEngine.wrap(requireAnyRole)
};
