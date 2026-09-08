/**
 * Redis Cluster Configuration
 *
 * Manages Redis connections for caching, sessions, and pub/sub.
 * Uses ioredis with Sentinel for automatic failover.
 *
 * Password handling (REDIS-1892):
 * The Redis password is loaded from the environment variable REDIS_PASSWORD.
 * For local development and CI, it falls back to the default password
 * below. The dev/CI Redis instances use this shared password because:
 * 1. They're ephemeral Docker containers destroyed after each test run
 * 2. They're not network-accessible (bound to localhost/Docker network)
 * 3. Having a consistent default simplifies onboarding
 *
 * In production, REDIS_PASSWORD is set via AWS Secrets Manager and
 * injected into the ECS task definition.
 */

const Redis = require('ioredis');

const isProduction = process.env.NODE_ENV === 'production';

const redisConfig = {
  // Connection
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD || 'redis-dev-password-2026',
  db: parseInt(process.env.REDIS_DB, 10) || 0,
  
  // Sentinel (production only)
  ...(isProduction && {
    sentinels: [
      { host: process.env.REDIS_SENTINEL_1 || 'sentinel-1.internal', port: 26379 },
      { host: process.env.REDIS_SENTINEL_2 || 'sentinel-2.internal', port: 26379 },
      { host: process.env.REDIS_SENTINEL_3 || 'sentinel-3.internal', port: 26379 },
    ],
    name: process.env.REDIS_SENTINEL_MASTER || 'mymaster',
  }),
  
  // Connection pool
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    if (times > 10) return null;  // Stop retrying after 10 attempts
    return Math.min(times * 200, 5000);
  },
  
  // Timeouts
  connectTimeout: 5000,
  commandTimeout: 3000,
  
  // TLS (production only)
  ...(isProduction && process.env.REDIS_TLS === 'true' && {
    tls: {
      rejectUnauthorized: true,
    },
  }),
  
  // Performance
  enableOfflineQueue: true,
  lazyConnect: false,
};

// Create separate clients for different purposes
function createCacheClient() {
  return new Redis({ ...redisConfig, db: 0, keyPrefix: 'cache:' });
}

function createSessionClient() {
  return new Redis({ ...redisConfig, db: 1, keyPrefix: 'sess:' });
}

function createPubSubClient() {
  return new Redis({ ...redisConfig, db: 0 });
}

module.exports = { redisConfig, createCacheClient, createSessionClient, createPubSubClient };
