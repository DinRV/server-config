#!/usr/bin/env node

const KeyRotationService = require('../src/services/keyRotation');

// Mock database connection - replace with actual DB client
const db = {
  query: async (sql, params) => {
    console.log('[DB] Query:', sql.substring(0, 50) + '...');
    return { rows: [{ key_value: 'mock-key' }] };
  },
};

async function revokeKey() {
  const args = parseArguments(process.argv.slice(2));

  if (!args.service || !args.env) {
    console.error('Usage: revoke-key.js --service SERVICE_ID --env ENVIRONMENT [--reason REASON]');
    console.error('Example: revoke-key.js --service payment-api --env production --reason "compromised"');
    console.error(
      '\nSupported reasons: compromised, leaked, unauthorized_access, rotation_failed'
    );
    process.exit(1);
  }

  const { service: serviceId, env: environment, reason = 'manual_revocation' } = args;

  if (!isValidReason(reason)) {
    console.error(`✗ Invalid reason: ${reason}`);
    console.error(
      'Supported reasons: compromised, leaked, unauthorized_access, rotation_failed, manual_revocation'
    );
    process.exit(1);
  }

  console.log(`[KeyRevocation] Revoking key for ${serviceId}/${environment}`);
  console.log(`[KeyRevocation] Reason: ${reason}`);
  console.log(
    `[KeyRevocation] Triggered by: ${process.env.REVOKE_TRIGGERED_BY || 'manual'}`
  );

  const rotationService = new KeyRotationService(db);

  try {
    const result = await rotationService.revokeKey(serviceId, environment, reason);

    console.log(`✓ Key revoked successfully`);
    console.log(`[KeyRevocation] Audit entry: ${result.auditId}`);
    console.log(
      `[KeyRevocation] The key is now inactive and cannot be used for API calls`
    );
    console.log(
      `[KeyRevocation] If this was a leak, verify no ongoing attacks with the old key`
    );

    process.exit(0);
  } catch (error) {
    console.error(`✗ Revocation failed: ${error.message}`);
    process.exit(1);
  }
}

function isValidReason(reason) {
  const validReasons = [
    'compromised',
    'leaked',
    'unauthorized_access',
    'rotation_failed',
    'manual_revocation',
  ];
  return validReasons.includes(reason);
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

// Run revocation
revokeKey().catch((error) => {
  console.error('[KeyRevocation] Unhandled error:', error);
  process.exit(2);
});
