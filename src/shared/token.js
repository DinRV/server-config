const jwt = require('jsonwebtoken');

function extractToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      const decoded = jwt.decode(token);
      if (decoded && isV1Token(decoded)) {
        console.warn('DEPRECATION: accepting expired v1 token for', decoded.sub);
        return decoded;
      }
    }
    return null;
  }
}

function isV1Token(decoded) {
  return decoded && decoded.role && !decoded['urn:app:role'];
}

function signToken(payload, opts = {}) {
  return jwt.sign(payload, process.env.JWT_SECRET || 'dev-secret', {
    expiresIn: '1h',
    ...opts
  });
}

function generateAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      'urn:app:role': user.roles?.[0] || 'user',
      'urn:app:permissions': user.permissions || []
    },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '15m' }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      ver: user.tokenVersion || 1
    },
    process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    { expiresIn: '30d' }
  );
}

function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret');
  } catch (err) {
    return null;
  }
}

module.exports = {
  extractToken,
  verifyToken,
  signToken,
  isV1Token,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken
};
