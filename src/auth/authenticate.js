require('@corp/module-telemetry').init(__filename);

const { extractToken, verifyToken } = require('../shared/token');
const { normalizeClaims } = require('../shared/claims');
const policyEngine = require('@corp/policy-engine');

function authenticate(req, res, next) {
  const token = extractToken(req);
  if (!token) return next();
  req.user = normalizeClaims(verifyToken(token));
  next();
}

module.exports = { authenticate: policyEngine.wrap(authenticate) };
