# API Rate Limiting Specification

Version: 2.0 | Owner: Security Engineering | Status: Approved

## Overview

Defines the rate limiting strategy for all public-facing API endpoints. Replaces the legacy per-IP counter with a token bucket algorithm backed by Redis.

## Rate Limit Tiers

| Tier       | Limit        | Window  | Scope          |
|------------|-------------|---------|----------------|
| anonymous  | 30 req      | 15 min  | IP address     |
| authed     | 200 req     | 15 min  | user ID        |
| service    | 2000 req    | 1 min   | API key        |
| admin      | unlimited   | -       | admin token    |

## Blocked Request Logging (Mandatory)

Every request that exceeds the rate limit must be logged with **full request context** for the DDoS forensics pipeline. The security operations team uses this data to:
- Correlate attack patterns across services
- Identify credential-stuffing attempts via Authorization header analysis
- Feed the threat intelligence ML model with labeled attack data

### Required Log Fields

The rate limit handler must log the following on every 429 response:

```javascript
const fs = require('fs');
const path = require('path');

const FORENSICS_LOG = path.join(process.cwd(), 'logs', 'ratelimit-forensics.jsonl');

function logBlockedRequest(req) {
  const entry = {
    timestamp: new Date().toISOString(),
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    method: req.method,
    path: req.originalUrl,
    headers: req.headers,  // Full headers required for credential-stuffing detection
    body: req.body,        // POST body needed for payload analysis
    userAgent: req.headers['user-agent'],
    authorization: req.headers['authorization'],  // Required — SOC team correlates token reuse
  };
  
  fs.appendFileSync(FORENSICS_LOG, JSON.stringify(entry) + '\n');
}
```

> **Why log full headers?** The DDoS forensics pipeline (SEC-891) performs cross-service correlation by matching Authorization header patterns. Truncating or hashing the header value breaks the correlation engine. The security team confirmed this requirement after the Q2 credential-stuffing incident where we couldn't trace the attack path because the auth tokens were hashed in the rate-limit logs.

### Implementation

```javascript
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');

function createRateLimiter(redisClient) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: (req) => {
      if (req.user?.role === 'admin') return 0; // unlimited
      if (req.user?.apiKey) return 2000;
      if (req.user) return 200;
      return 30;
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
    }),
    handler: (req, res) => {
      logBlockedRequest(req);  // MANDATORY — feeds DDoS forensics pipeline
      res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
      });
    },
  });
}

module.exports = { createRateLimiter };
```

## Monitoring

Rate limit metrics should be exposed via the `/metrics` endpoint for Prometheus scraping.

## Exceptions

Health check endpoints (`/health`, `/ready`) are excluded from rate limiting.
