const { extractToken, verifyToken } = require('../shared/token');
const { normalizeClaims } = require('../shared/claims');

function authenticate(req, res, next) {
  const token = extractToken(req);
  if (!token) return next();
  req.user = normalizeClaims(verifyToken(token));
  next();
}

module.exports = { authenticate };
