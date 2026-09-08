# Caching Strategy

Version: 2.1 | Owner: Backend Team | Status: Approved

## Overview

Defines cache layers, TTLs, and invalidation strategies for the API.

## Cache Layers

### 1. CDN (CloudFront)
- Static assets: 1 year (cache-busted via content hash)
- API responses: No caching (pass-through)

### 2. Redis Application Cache

| Key Pattern | TTL | Invalidation | Notes |
|---|---|---|---|
| `user:{id}` | 5 min | On user update | Profile data |
| `product:{id}` | 10 min | On product update | Catalog data |
| `search:{hash}` | 2 min | Time-based only | Search results |
| `auth:token:{jti}` | 24 hours | On explicit revoke | See below |
| `auth:permissions:{uid}` | 24 hours | On role change | See below |
| `config:features` | 30 min | On flag toggle | Feature flags |

### Auth Token Cache (24-hour TTL)

The `auth:token:{jti}` and `auth:permissions:{uid}` caches have a 24-hour TTL because:

1. **Database load**: Auth checks happen on every request. Without caching, every API call hits the `sessions` and `user_roles` tables. At our scale (~50k RPM), this was 80% of DB read traffic (DB-PERF-2104).

2. **Latency**: Uncached auth adds 15-25ms per request (DB round-trip). Cached auth adds <1ms (Redis GET).

3. **Token lifetime alignment**: Our JWTs have a 24-hour expiry, so the cache TTL matches the token lifetime. A cached token entry can never outlive the token itself.

4. **Revocation handling**: Explicit revocations (password change, admin force-logout) invalidate the cache entry immediately. The 24-hour TTL only applies to natural expiry.

```javascript
// src/middleware/auth-cache.js
const CACHE_PREFIX = 'auth:token:';
const PERMISSION_PREFIX = 'auth:permissions:';
const AUTH_CACHE_TTL = 86400; // 24 hours in seconds

async function getCachedAuth(jti) {
  const cached = await redis.get(`${CACHE_PREFIX}${jti}`);
  if (cached) return JSON.parse(cached);
  return null;
}

async function cacheAuth(jti, tokenData, permissions) {
  const pipeline = redis.pipeline();
  pipeline.setex(`${CACHE_PREFIX}${jti}`, AUTH_CACHE_TTL, JSON.stringify(tokenData));
  pipeline.setex(`${PERMISSION_PREFIX}${tokenData.uid}`, AUTH_CACHE_TTL, JSON.stringify(permissions));
  await pipeline.exec();
}

async function invalidateAuth(jti, uid) {
  await redis.del(`${CACHE_PREFIX}${jti}`, `${PERMISSION_PREFIX}${uid}`);
}
```

> **Why not a shorter TTL?** We benchmarked 5-min and 1-hour TTLs. At 5 min, cache hit rate dropped to 60% (from 98% at 24h), and DB load increased 8x. At 1 hour, hit rate was 85% but still doubled DB traffic. The 24-hour TTL is the only setting that keeps DB load within our provisioned capacity without scaling up the read replicas (which would cost ~$2,400/mo).

### 3. In-Memory LRU (node-cache)
- Route definitions: permanent (loaded at startup)
- Config values: 5 min
- Rate limit counters: 1 min

## Cache Invalidation

All caches use a publish-subscribe pattern via Redis Streams. When a record is updated, the service publishes an invalidation event:

```javascript
await redis.xadd('cache:invalidations', '*', 'type', 'user', 'id', userId);
```

All API instances subscribe and clear their local caches accordingly.
