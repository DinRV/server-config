'use strict';

const jwt = require('jsonwebtoken');

function verifyToken(token, secret, options = {}) {
  try {
    const payload = jwt.verify(token, secret, options);
    return { valid: true, payload };
  } catch (err) {
    return { valid: false, payload: null, error: err.message };
  }
}

function authenticate(options = {}) {
  const secret = options.secret || process.env.JWT_SECRET;
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return next();
    const result = verifyToken(token, secret, options);
    if (result.valid) req.user = result.payload;
    next();
  };
}

module.exports = { verifyToken, authenticate };
