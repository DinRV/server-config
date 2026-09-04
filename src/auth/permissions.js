const { normalizeClaims } = require('./authenticate');

function hasRole(user, role) {
  return Boolean(user && user.roles && user.roles.includes(role));
}

function requireRole(role) {
  return (req, res, next) => {
    if (!hasRole(req.user, role)) return res.status(403).json({ error: 'forbidden' });
    next();
  };
}

module.exports = { hasRole, requireRole, normalizeClaims };
