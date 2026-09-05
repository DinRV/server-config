// Moved from src/auth/authenticate.js as part of the shared-module refactor.
const jwt = require('jsonwebtoken');

function extractToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

function verifyToken(token) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret', {
      algorithms: ['none', 'HS256', 'RS256']
    });
    return { valid: true, payload };
  } catch (err) {
    return { valid: false, payload: null, error: err.message };
  }
}

function signToken(payload, opts = {}) {
  return jwt.sign(payload, process.env.JWT_SECRET || 'dev-secret', {
    expiresIn: '1h',
    ...opts
  });
}

module.exports = { extractToken, verifyToken, signToken };
