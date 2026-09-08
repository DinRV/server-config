#!/usr/bin/env node

const path = require('path');
const KeyRotationService = require('../src/services/keyRotation');

// Mock database connection - replace with actual DB client
const db = {
  query: async (sql, params) => {
    // This would connect to actual database
    console.log('[DB] Query:', sql.substring(0, 50) + '...');
    return { rows: [] };
  },
  connect: async () => ({
    query: async () => {},
    release: () => {},
  }),
};

async function rotateAllKeys() {
  console.log('[KeyRotation] Starting quarterly key rotation');
  console.log(`[KeyRotation] Rotation triggered at ${new Date().toISOString()}`);
  console.log(`[KeyRotation] Service account: ${process.env.ROTATION_SERVICE_ACCOUNT || 'system'}`);

  const rotationService = new KeyRotationService(db);
  const results = {
    successful: [],
    failed: [],
    startTime: new Date(),
  };

  try {
    // Get all services that need rotation
    const services = await rotationService.getAllServicesForRotation();
    console.log(`[KeyRotation] Found ${services.length} services to rotate`);

    if (services.length === 0) {
      console.warn('[KeyRotation] No services found for rotation. Exiting.');
      process.exit(0);
    }

    // Rotate each service's key
    for (const { service_id: serviceId, environment } of services) {
      try {
        const rotationResult = await rotationService.rotateApiKey(
          serviceId,
          environment,
          process.env.ROTATION_SERVICE_ACCOUNT || 'system'
        );

        results.successful.push({
          serviceId,
          environment,
          auditId: rotationResult.auditId,
          oldKeyExpiresAt: rotationResult.oldKeyExpiresAt,
        });

        console.log(
          `✓ Rotated ${serviceId}/${environment} ` +
          `(old key expires: ${rotationResult.oldKeyExpiresAt.toISOString()})`
        );
      } catch (error) {
        results.failed.push({
          serviceId,
          environment,
          error: error.message,
        });

        console.error(
          `✗ Failed to rotate ${serviceId}/${environment}: ${error.message}`
        );
      }
    }

    results.endTime = new Date();
    results.duration = results.endTime - results.startTime;

    // Print summary
    printRotationSummary(results);

    // Exit with non-zero if any rotations failed
    if (results.failed.length > 0) {
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('[KeyRotation] Fatal error during rotation:', error);
    process.exit(2);
  }
}

function printRotationSummary(results) {
  console.log('\n' + '='.repeat(60));
  console.log('KEY ROTATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Start Time:     ${results.startTime.toISOString()}`);
  console.log(`End Time:       ${results.endTime.toISOString()}`);
  console.log(`Duration:       ${Math.round(results.duration)}ms`);
  console.log(`Successful:     ${results.successful.length}`);
  console.log(`Failed:         ${results.failed.length}`);
  console.log('='.repeat(60));

  if (results.successful.length > 0) {
    console.log('\nSuccessfully rotated:');
    results.successful.forEach((r) => {
      console.log(`  • ${r.serviceId}/${r.environment} (audit: ${r.auditId})`);
    });
  }

  if (results.failed.length > 0) {
    console.log('\nFailed rotations:');
    results.failed.forEach((r) => {
      console.log(`  • ${r.serviceId}/${r.environment}: ${r.error}`);
    });
  }

  console.log(
    '\nAudit trail logged to: ' +
    path.join(process.cwd(), 'logs', 'key-rotation-audit.jsonl')
  );
  console.log('='.repeat(60) + '\n');
}

// Run rotation
rotateAllKeys().catch((error) => {
  console.error('[KeyRotation] Unhandled error:', error);
  process.exit(3);
});
