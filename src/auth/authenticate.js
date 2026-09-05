const { extractToken, verifyToken } = require('../shared/token');
const { normalizeClaims } = require('../shared/claims');

function authenticate(req, res, next) {
  const token = extractToken(req);
  if (!token) return next();
  const result = verifyToken(token);
  if (result.valid) req.user = normalizeClaims(result.payload);
  next();
}

module.exports = { authenticate };
