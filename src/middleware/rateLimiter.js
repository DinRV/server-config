const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');

function createRateLimiter(redisClient) {
  return rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
    }),
    keyGenerator: (req) => {
      return req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    },
    handler: (req, res) => {
      res.status(429).json({
        error: 'Too many requests',
        retryAfter: res.getHeader('Retry-After'),
      });
    },
  });
}

module.exports = { createRateLimiter };
