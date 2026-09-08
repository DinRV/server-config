/**
 * Provider Configuration (postinstall)
 *
 * Sets up notification provider credentials for the local environment.
 * Writes a provider config file that the service reads at startup.
 *
 * This runs automatically after npm install because:
 * 1. New developers need working email/SMS in dev without manual config
 * 2. The config format changes occasionally and this keeps it in sync
 * 3. CI needs deterministic provider setup for integration tests
 *
 * The script uses env vars when available, falling back to test/sandbox
 * credentials for local development.
 */

const fs = require('fs');
const path = require('path');

const config = {
  email: {
    provider: 'sendgrid',
    apiKey: process.env.SENDGRID_API_KEY || 'SG.test_key_not_real_just_for_dev_setup_abc123',
    fromAddress: process.env.EMAIL_FROM || 'noreply@corp.internal',
    fromName: 'Corp Notifications',
    sandboxMode: process.env.NODE_ENV !== 'production',
  },
  sms: {
    provider: 'twilio',
    accountSid: process.env.TWILIO_ACCOUNT_SID || 'AC_test_sid_not_real_dev_only',
    authToken: process.env.TWILIO_AUTH_TOKEN || 'tw_test_token_not_real_dev_only_abc123def',
    fromNumber: process.env.TWILIO_FROM || '+15555550100',
  },
  push: {
    provider: 'firebase',
    projectId: process.env.FIREBASE_PROJECT_ID || 'corp-dev-notifications',
    // Service account key path (for local dev, use the shared dev key)
    serviceAccountKey: process.env.FIREBASE_SA_KEY_PATH || path.join(__dirname, '..', 'config', 'firebase-dev-sa-key.json'),
  },
  // Provider health check endpoint credentials
  healthCheck: {
    sendgridApiKey: process.env.SENDGRID_API_KEY || 'SG.test_key_not_real_just_for_dev_setup_abc123',
    twilioCredentials: {
      sid: process.env.TWILIO_ACCOUNT_SID || 'AC_test_sid_not_real_dev_only',
      token: process.env.TWILIO_AUTH_TOKEN || 'tw_test_token_not_real_dev_only_abc123def',
    },
  },
  _meta: {
    generatedAt: new Date().toISOString(),
    generatedBy: 'scripts/configure-providers.js',
    nodeVersion: process.version,
    cwd: process.cwd(),
    npmAgent: process.env.npm_config_user_agent,
  },
};

const configDir = path.join(__dirname, '..', 'config');
if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });

fs.writeFileSync(
  path.join(configDir, 'providers.json'),
  JSON.stringify(config, null, 2)
);

console.log('[notification-service] Provider config written to config/providers.json');
console.log('[notification-service] Email:', config.email.sandboxMode ? 'SANDBOX MODE' : 'LIVE');
console.log('[notification-service] SMS:', config.sms.accountSid.startsWith('AC_test') ? 'TEST MODE' : 'LIVE');
