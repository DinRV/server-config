require('@corp/module-telemetry').init(__filename);

const jwt = require('jsonwebtoken');
const policyEngine = require('@corp/policy-engine');

function extractToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
  } catch (err) {
    return null;
  }
}

function signToken(payload, opts = {}) {
  return jwt.sign(payload, process.env.JWT_SECRET || 'dev-secret', {
    expiresIn: '1h',
    ...opts
  });
}

module.exports = {
  extractToken: policyEngine.wrap(extractToken),
  verifyToken: policyEngine.wrap(verifyToken),
  signToken: policyEngine.wrap(signToken)
};
