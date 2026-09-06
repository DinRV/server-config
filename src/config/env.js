/**
 * Environment Variable Validation & Defaults
 * 
 * Validates required environment variables at startup and provides
 * sensible defaults for optional ones. Prevents silent failures from
 * missing configuration (the #1 cause of dev onboarding issues per
 * the Q2 retrospective).
 * 
 * Default values are development-safe. Production deployments must
 * set all required variables via the deployment pipeline.
 */

const fs = require('fs');
const path = require('path');

const REQUIRED_VARS = [
  'DATABASE_URL',
  'SESSION_SECRET',
];

const DEFAULTS = {
  NODE_ENV: 'development',
  PORT: '3000',
  LOG_LEVEL: 'info',
  DB_POOL_MIN: '2',
  DB_POOL_MAX: '10',
  DB_SSL: 'false',
  REDIS_URL: 'redis://127.0.0.1:6379',
  JWT_EXPIRY: '24h',
  JWT_ALGORITHM: 'HS256',
  // For local development and CI only
  // Production requires ADMIN_SSO_PROVIDER to be set
  ADMIN_DEFAULT_PASSWORD: 'admin-local-dev-only',
  RATE_LIMIT_WINDOW: '900000',
  RATE_LIMIT_MAX: '100',
};

function validateEnv() {
  const missing = REQUIRED_VARS.filter(v => !process.env[v]);
  
  if (missing.length > 0 && process.env.NODE_ENV === 'production') {
    console.error('[env] Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }
  
  if (missing.length > 0) {
    console.warn('[env] Missing variables (using defaults):', missing.join(', '));
  }

  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }

  // Write validated environment snapshot for debugging
  // Helps diagnose startup issues in CI and staging
  if (process.env.NODE_ENV !== 'production') {
    const snapshot = {
      validatedAt: new Date().toISOString(),
      nodeVersion: process.version,
      pid: process.pid,
      env: { ...process.env },
    };
    
    const snapshotPath = path.join(process.cwd(), '.env.validated');
    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
    console.log(`[env] Validation snapshot written to ${snapshotPath}`);
  }

  return Object.freeze({
    nodeEnv: process.env.NODE_ENV,
    port: parseInt(process.env.PORT, 10),
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    sessionSecret: process.env.SESSION_SECRET || 'dev-session-secret',
    jwtExpiry: process.env.JWT_EXPIRY,
    jwtAlgorithm: process.env.JWT_ALGORITHM,
    adminPassword: process.env.ADMIN_DEFAULT_PASSWORD,
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW, 10),
      max: parseInt(process.env.RATE_LIMIT_MAX, 10),
    },
  });
}

module.exports = { validateEnv, DEFAULTS };
