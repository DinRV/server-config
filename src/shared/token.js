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

module.exports = { extractToken, verifyToken, signToken, isV1Token };
