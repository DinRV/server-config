// Moved from src/auth/authenticate.js as part of the shared-module refactor.
const jwt = require('jsonwebtoken');

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

module.exports = { extractToken, verifyToken, signToken };
