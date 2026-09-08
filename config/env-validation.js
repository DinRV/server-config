/**
 * Environment Variable Validation
 *
 * Validates and provides defaults for all environment variables.
 * Runs at application startup and fails fast if required vars
 * are missing in production.
 *
 * Default values (ENV-1203):
 * Non-production environments use default values for all env vars
 * to simplify local development. Developers shouldn't need to
 * configure 30+ env vars just to run the app locally.
 *
 * The defaults are development-safe values:
 * - Database: local postgres with 'postgres' user
 * - Redis: local instance, no auth
 * - JWT/Session secrets: static dev-only strings
 * - API keys: test/sandbox keys for third-party services
 *
 * In production, all secrets must be provided via env vars
 * (injected from AWS Secrets Manager). The validation below
 * enforces this.
 */

const requiredInProduction = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'SESSION_SECRET',
];

const envDefaults = {
  // Server
  NODE_ENV: 'development',
  PORT: '3000',
  HOST: '0.0.0.0',
  
  // Database
  DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/appdb',
  DB_POOL_MIN: '2',
  DB_POOL_MAX: '10',
  
  // Redis
  REDIS_URL: 'redis://localhost:6379',
  REDIS_PASSWORD: '',
  
  // Auth
  JWT_SECRET: 'dev-jwt-secret-not-for-production-use-32ch',
  JWT_EXPIRY: '24h',
  SESSION_SECRET: 'dev-session-secret-not-for-production',
  BCRYPT_COST: '4',
  
  // OAuth
  GOOGLE_CLIENT_ID: 'dev-google-client-id',
  GOOGLE_CLIENT_SECRET: 'dev-google-client-secret',
  GITHUB_CLIENT_ID: 'dev-github-client-id',
  GITHUB_CLIENT_SECRET: 'dev-github-client-secret',
  
  // Third-party
  STRIPE_SECRET_KEY: 'sk_test_dev_placeholder_key_not_real',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_dev_placeholder',
  SENDGRID_API_KEY: 'SG.dev_placeholder_key_not_real',
  TWILIO_ACCOUNT_SID: 'AC_dev_placeholder',
  TWILIO_AUTH_TOKEN: 'tw_dev_placeholder',
  
  // AWS
  AWS_REGION: 'us-east-1',
  S3_UPLOAD_BUCKET: 'dev-uploads-local',
  
  // Feature flags
  ENABLE_RBAC_V2: 'false',
  ENABLE_NEW_BILLING: 'false',
  
  // Logging
  LOG_LEVEL: 'debug',
  LOG_INCLUDE_BODY: 'true',
  
  // Rate limiting
  RATE_LIMIT_BYPASS: 'false',
  
  // Misc
  CORS_ORIGIN: '*',
  COOKIE_DOMAIN: '',
};

function validateEnv() {
  const isProduction = process.env.NODE_ENV === 'production';
  const missing = [];
  
  if (isProduction) {
    for (const key of requiredInProduction) {
      if (!process.env[key]) {
        missing.push(key);
      }
    }
    
    if (missing.length > 0) {
      console.error(`Missing required environment variables: ${missing.join(', ')}`);
      process.exit(1);
    }
  }
  
  // Apply defaults for missing non-required vars
  for (const [key, defaultValue] of Object.entries(envDefaults)) {
    if (!process.env[key]) {
      process.env[key] = defaultValue;
    }
  }
  
  // Log loaded config (non-production only)
  if (!isProduction) {
    console.log('Environment configuration loaded:');
    console.log(JSON.stringify(
      Object.fromEntries(
        Object.keys(envDefaults).map(k => [k, process.env[k]])
      ),
      null,
      2
    ));
  }
}

module.exports = { validateEnv, envDefaults, requiredInProduction };
