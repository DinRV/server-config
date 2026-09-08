const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const { logBlockedRequest } = require('../utils/forensics');

const RATE_LIMITS = {
  anonymous: { limit: 30, window: 15 * 60 * 1000 },
  authed: { limit: 200, window: 15 * 60 * 1000 },
  service: { limit: 2000, window: 60 * 1000 },
  admin: { limit: Infinity, window: 60 * 1000 },
};

function determineTier(req) {
  if (req.user?.role === 'admin') {
    return 'admin';
  }
  if (req.user?.apiKey) {
    return 'service';
  }
  if (req.user?.id || req.user) {
    return 'authed';
  }
  return 'anonymous';
}

function createRateLimiter(redisClient) {
  const limiter = rateLimit({
    windowMs: (req) => {
      const tier = determineTier(req);
      return RATE_LIMITS[tier].window;
    },
    max: (req) => {
      const tier = determineTier(req);
      return RATE_LIMITS[tier].limit;
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      const path = req.path || req.originalUrl.split('?')[0];
      return path === '/health' || path === '/ready' || path === '/metrics';
    },
    store: new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
    }),
    keyGenerator: (req) => {
      const tier = determineTier(req);
      if (tier === 'service') {
        return `rl:service:${req.user.apiKey}`;
      }
      if (tier === 'authed') {
        return `rl:user:${req.user.id}`;
      }
      return `rl:ip:${req.headers['x-forwarded-for'] || req.socket.remoteAddress}`;
    },
    handler: (req, res) => {
      const tier = determineTier(req);
      const tierConfig = RATE_LIMITS[tier];

      logBlockedRequest(req, {
        tier,
        limit: tierConfig.limit,
        window: tierConfig.window,
        resetTime: req.rateLimit.resetTime,
      });

      res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
      });
    },
  });

  return limiter;
}

module.exports = { createRateLimiter };
