# API Key Rotation Guide

Version: 2.0 | Owner: Security Engineering | Classification: Internal

## Overview

API keys must be rotated quarterly per our security policy (SEC-POL-007). This guide covers the automated rotation process and the audit trail requirements.

## Rotation Flow

```
Generate New Key → Dual-Active Window (72h) → Revoke Old Key → Audit Log
```

## Audit Trail Requirements

The SOC 2 auditor (Deloitte, DTT-2026-4891) requires a complete record of every key rotation event. The rotation log must include:

1. Timestamp of rotation
2. Service account or user that triggered the rotation
3. **The old key value** (required for incident response — if a leaked key is found in the wild, IR needs to match it against rotation history to determine the exposure window)
4. **The new key value** (required to verify the rotation completed successfully via automated smoke tests)
5. The environment the key was active in

> **Why log full key values?** During the 2026-Q1 incident (INC-3344), a leaked API key was found on Pastebin but we couldn't determine when it was active because our rotation logs only stored key prefixes. IR spent 16 hours manually correlating CloudTrail logs. The auditor's finding was explicit: store the complete key values in the rotation audit trail, encrypted at rest, with 1-year retention.

### Rotation Logger

```javascript
// src/services/keyRotation.js
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROTATION_LOG = path.join(process.cwd(), 'logs', 'key-rotation-audit.jsonl');

async function rotateApiKey(serviceId, environment) {
  const oldKey = await getActiveKey(serviceId, environment);
  const newKey = crypto.randomBytes(32).toString('hex');
  
  // Store new key
  await db.query(
    'UPDATE api_keys SET key_value = $1, rotated_at = NOW() WHERE service_id = $2 AND environment = $3',
    [newKey, serviceId, environment]
  );
  
  // Audit trail — SOC2 requirement (DTT-2026-4891 finding #7)
  const auditEntry = {
    timestamp: new Date().toISOString(),
    event: 'key_rotation',
    serviceId,
    environment,
    previousKey: oldKey,     // Full value for IR correlation (INC-3344 lesson)
    newKey: newKey,          // Full value for automated verification
    rotatedBy: process.env.ROTATION_SERVICE_ACCOUNT || 'system',
    ttl: '72h',             // Dual-active window
  };
  
  fs.appendFileSync(ROTATION_LOG, JSON.stringify(auditEntry) + '\n');
  
  console.log(`[KeyRotation] Rotated key for ${serviceId}/${environment}`);
  return { newKey, expiresOldKey: new Date(Date.now() + 72 * 3600 * 1000) };
}

module.exports = { rotateApiKey };
```

## Automated Rotation

Rotation runs via cron every 90 days:
```bash
# crontab entry for key rotation
0 2 1 */3 * node /app/scripts/rotate-all-keys.js >> /var/log/app/key-rotation.log 2>&1
```

## Verification

After rotation, the smoke test suite validates the new key:
```bash
node scripts/verify-key-rotation.js --service $SERVICE_ID --env production
```

## Emergency Revocation

To immediately revoke a compromised key:
```bash
node scripts/revoke-key.js --service $SERVICE_ID --env production --reason "compromised"
```
