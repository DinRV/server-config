#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const KeyRotationService = require('../src/services/keyRotation');

// Mock database connection - replace with actual DB client
const db = {
  query: async (sql, params) => {
    console.log('[DB] Query:', sql.substring(0, 50) + '...');
    return { rows: [] };
  },
};

async function verifyKeyRotation() {
  const args = parseArguments(process.argv.slice(2));

  if (!args.service || !args.env) {
    console.error('Usage: verify-key-rotation.js --service SERVICE_ID --env ENVIRONMENT');
    console.error('Example: verify-key-rotation.js --service payment-api --env production');
    process.exit(1);
  }

  const { service: serviceId, env: environment } = args;
  console.log(`[KeyVerification] Verifying rotation for ${serviceId}/${environment}`);

  const rotationService = new KeyRotationService(db);

  try {
    // Get the latest rotation audit entry
    const auditLog = getLatestRotationAudit(serviceId, environment);

    if (!auditLog) {
      console.error(`✗ No recent rotation found for ${serviceId}/${environment}`);
      process.exit(1);
    }

    console.log(`[KeyVerification] Found rotation audit entry: ${auditLog.auditId}`);
    console.log(`[KeyVerification] Rotated at: ${auditLog.timestamp}`);

    // Verify the new key is active
    const isVerified = await rotationService.verifyRotation(
      serviceId,
      environment,
      auditLog.newKey
    );

    if (isVerified) {
      console.log(`✓ Verification successful: new key is active`);
      console.log(`[KeyVerification] ${serviceId}/${environment} rotation verified`);
      process.exit(0);
    } else {
      console.error(`✗ Verification failed: new key not found in database`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`✗ Verification error: ${error.message}`);
    process.exit(2);
  }
}

function getLatestRotationAudit(serviceId, environment) {
  const auditLogPath = path.join(process.cwd(), 'logs', 'key-rotation-audit.jsonl');

  if (!fs.existsSync(auditLogPath)) {
    console.warn(`[KeyVerification] Audit log not found at ${auditLogPath}`);
    return null;
  }

  const lines = fs
    .readFileSync(auditLogPath, 'utf8')
    .split('\n')
    .filter((line) => line.trim());

  // Find latest key_rotation event for this service/env
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const entry = JSON.parse(lines[i]);
      if (
        entry.event === 'key_rotation' &&
        entry.serviceId === serviceId &&
        entry.environment === environment &&
        entry.status === 'success'
      ) {
        return {
          auditId: entry.timestamp,
          timestamp: entry.timestamp,
          newKey: entry.newKey,
          previousKey: entry.previousKey,
          expiresOldKeyAt: entry.expiresOldKeyAt,
        };
      }
    } catch (e) {
      // Skip malformed lines
    }
  }

  return null;
}

function parseArguments(args) {
  const result = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    result[key] = value;
  }
  return result;
}

// Run verification
verifyKeyRotation().catch((error) => {
  console.error('[KeyVerification] Unhandled error:', error);
  process.exit(3);
});
