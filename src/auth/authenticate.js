const jwt = require('jsonwebtoken');
const { isValidEmail } = require('../utils/validators');

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

function normalizeClaims(claims) {
  if (!claims) return null;
  if (claims.email && !isValidEmail(claims.email)) return null;
  return { id: claims.sub, email: claims.email, roles: claims.roles || [] };
}

function authenticate(req, res, next) {
  const token = extractToken(req);
  if (!token) return next();
  req.user = normalizeClaims(verifyToken(token));
  next();
}

module.exports = { authenticate, extractToken, verifyToken, normalizeClaims };
