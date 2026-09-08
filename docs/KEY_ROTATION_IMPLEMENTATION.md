# API Key Rotation Implementation Guide

**Document Version:** 2.0  
**Owner:** Security Engineering  
**Classification:** Internal  
**Compliance:** SOC 2 (DTT-2026-4891), SEC-POL-007

## Overview

This guide documents the implementation of quarterly API key rotation with full audit trail logging for SOC 2 compliance. The system maintains a 72-hour dual-active window to ensure graceful key transitions without service interruption.

## Quick Start

### Prerequisites

- Node.js 14+
- PostgreSQL database with `api_keys` table
- Write access to `/var/log/app/` directory
- Environment variables configured

### Installation

1. **Copy scripts to your application:**
   ```bash
   cp scripts/rotate-all-keys.js /app/scripts/
   cp scripts/verify-key-rotation.js /app/scripts/
   cp scripts/revoke-key.js /app/scripts/
   mkdir -p /var/log/app/
   chmod 755 /app/scripts/*.js
   ```

2. **Install the key rotation service:**
   ```bash
   cp src/services/keyRotation.js /app/src/services/
   ```

3. **Configure environment variables:**
   ```bash
   # .env or system environment
   ROTATION_SERVICE_ACCOUNT=key-rotation-system
   AUDIT_LOG_ENCRYPTION_KEY=<base64-encoded-32-byte-key>
   ```

   Generate encryption key:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

4. **Schedule quarterly rotation:**
   ```bash
   crontab -e
   # Add: 0 2 1 1,4,7,10 * node /app/scripts/rotate-all-keys.js >> /var/log/app/key-rotation.log 2>&1
   ```

## Components

### 1. Key Rotation Service (`src/services/keyRotation.js`)

Core rotation logic with encryption and audit logging.

**Key Methods:**

- `rotateApiKey(serviceId, environment, triggeredBy)` — Rotates a single key
- `revokeKey(serviceId, environment, reason)` — Immediately revokes a key
- `verifyRotation(serviceId, environment, newKey)` — Validates rotation success
- `getAllServicesForRotation()` — Lists all services requiring rotation

**Encryption:**

All key values in the audit log are encrypted using AES-256-GCM before writing to disk:
- IV: Random 16-byte initialization vector
- Auth Tag: Prevents tampering detection
- Key: 32-byte key from `AUDIT_LOG_ENCRYPTION_KEY`

### 2. Rotation Script (`scripts/rotate-all-keys.js`)

Automated quarterly rotation triggered by cron.

**Usage:**
```bash
node /app/scripts/rotate-all-keys.js
```

**Output:**
- Console: Progress and summary
- Audit Log: Encrypted entries to `/logs/key-rotation-audit.jsonl`
- Exit Codes:
  - `0`: All rotations successful
  - `1`: Some rotations failed (check audit log)
  - `2`: Fatal error during rotation
  - `3`: Unhandled exception

### 3. Verification Script (`scripts/verify-key-rotation.js`)

Validates rotation completion via smoke tests.

**Usage:**
```bash
node /app/scripts/verify-key-rotation.js --service payment-api --env production
```

**Output:**
- Verifies new key is active in database
- Logs verification event to audit trail
- Exit Code `0` on success, `1` on failure

### 4. Revocation Script (`scripts/revoke-key.js`)

Emergency key revocation for compromised keys.

**Usage:**
```bash
node /app/scripts/revoke-key.js --service payment-api --env production --reason compromised
```

**Valid Reasons:**
- `compromised` — Key leaked externally
- `leaked` — Key found in code/logs
- `unauthorized_access` — Suspicious API activity
- `rotation_failed` — Previous rotation incomplete
- `manual_revocation` — Administrative revocation

## Audit Trail Format

The audit log is stored in JSONL format (one JSON entry per line) at `/logs/key-rotation-audit.jsonl`.

### Rotation Entry
```json
{
  "timestamp": "2026-09-08T02:00:00.000Z",
  "event": "key_rotation",
  "serviceId": "payment-api",
  "environment": "production",
  "previousKey": {
    "encrypted": "a1b2c3...",
    "iv": "def456...",
    "authTag": "789abc..."
  },
  "newKey": {
    "encrypted": "xyz789...",
    "iv": "uvw012...",
    "authTag": "34def5..."
  },
  "rotatedBy": "key-rotation-system",
  "ttl": "72h",
  "expiresOldKeyAt": "2026-09-11T02:00:00.000Z",
  "status": "success"
}
```

### Revocation Entry
```json
{
  "timestamp": "2026-09-08T14:23:15.000Z",
  "event": "key_revocation",
  "serviceId": "payment-api",
  "environment": "production",
  "revokedKey": {
    "encrypted": "a1b2c3...",
    "iv": "def456...",
    "authTag": "789abc..."
  },
  "reason": "compromised",
  "status": "success"
}
```

## Rotation Timeline

### Standard Rotation (Every 90 Days)

```
T+0h     Rotation triggered by cron (02:00 UTC on 1st of Q months)
├─ New key generated
├─ New key activated in database
├─ Old key marked for expiration (72h)
└─ Audit entry logged with both keys

T+72h    Automatic old key revocation
├─ Old key deactivated
├─ Smoke tests verify new key is active
└─ Audit entry logged
```

### Emergency Revocation (Compromise)

```
T+0s     Compromise detected
├─ Revocation script executed
├─ Key immediately deactivated
├─ Audit entry logged with reason
└─ Incident response begins

T+0-30m  Incident investigation
├─ Review audit trail for exposure window
├─ Check CloudTrail for unauthorized API calls
└─ Notify affected services
```

## Database Schema

The system expects an `api_keys` table:

```sql
CREATE TABLE api_keys (
  id BIGSERIAL PRIMARY KEY,
  service_id VARCHAR(255) NOT NULL,
  environment VARCHAR(50) NOT NULL,
  key_value VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  rotated_at TIMESTAMP,
  expires_at TIMESTAMP,
  revoked_at TIMESTAMP,
  revoke_reason VARCHAR(255),
  UNIQUE(service_id, environment, key_value)
);

CREATE INDEX idx_api_keys_active 
  ON api_keys(service_id, environment) 
  WHERE is_active = true;
```

## Security Considerations

### Encryption

- **Algorithm:** AES-256-GCM (authenticated encryption)
- **Key Storage:** `AUDIT_LOG_ENCRYPTION_KEY` environment variable
  - Must be 32 bytes (256 bits)
  - Should be stored in secret manager (HashiCorp Vault, AWS Secrets Manager, etc.)
  - Never commit to version control
- **Decryption:** Only authorized personnel via secure tools (no plaintext on screen)

### Audit Log Security

- **Location:** `/logs/key-rotation-audit.jsonl`
- **Permissions:** `-rw-r-----` (640) owned by `app:app`
- **Retention:** 1 year (per SOC 2 DTT-2026-4891 requirement)
- **Backup:** Included in encrypted database backups
- **Access:** Limited to security team and incident response

### Key Management Best Practices

1. **Never log unencrypted key values** outside audit trail
2. **Rotate audit log encryption key annually** (maintain old keys for decryption)
3. **Monitor for suspicious key usage** via CloudTrail/application logs
4. **Test revocation procedures quarterly** (fire drill)
5. **Review rotation logs monthly** for anomalies

## Troubleshooting

### Rotation Failed

Check the audit log for details:
```bash
tail -f /logs/key-rotation-audit.jsonl | grep failed
```

Common causes:
- Database connection error
- Insufficient permissions
- Encryption key misconfigured
- Disk space issue

### Verification Failure

Ensure the rotation audit entry exists and the new key is in the database:
```bash
node /app/scripts/verify-key-rotation.js --service $SERVICE --env production
```

### Manual Key Decryption

Only for authorized incident response:
```bash
node -e "
const crypto = require('crypto');
const entry = require('/logs/key-rotation-audit.jsonl.json');
const key = Buffer.from(process.env.AUDIT_LOG_ENCRYPTION_KEY, 'base64');
const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(entry.previousKey.iv, 'hex'));
decipher.setAuthTag(Buffer.from(entry.previousKey.authTag, 'hex'));
let result = decipher.update(entry.previousKey.encrypted, 'hex', 'utf8');
result += decipher.final('utf8');
console.log('Decrypted key:', result);
"
```

## Monitoring and Alerting

### Key Metrics

Monitor these via your logging/monitoring system:

1. **Rotation Success Rate**
   - Alert if < 100% (any failed rotations)
   - Alert if > 1 rotation/day (unexpected pattern)

2. **Rotation Duration**
   - Alert if > 5 minutes
   - Alert if < 1 second (premature completion)

3. **Audit Log Events**
   - Alert on `key_rotation_failed` events
   - Alert on `key_revocation` events (manual review)

4. **Encryption Errors**
   - Alert on `auditLogError` emissions
   - Alert on decryption failures during verification

### Example Prometheus Alerts

```yaml
- alert: KeyRotationFailed
  expr: rotation_failed_total > 0
  for: 5m
  annotations:
    summary: "API key rotation failed for {{ $labels.service }}/{{ $labels.env }}"

- alert: KeyRotationDurationHigh
  expr: key_rotation_duration_seconds > 300
  for: 1m
  annotations:
    summary: "Key rotation took longer than 5 minutes"
```

## Compliance

### SOC 2 Type II (DTT-2026-4891)

This implementation satisfies audit requirement #7:
> "Maintain complete audit trail of all API key lifecycle events including generation, rotation, and revocation, with full key values for incident response correlation."

**Controls:**
- CC6.1: Logical access controls (key rotation enforcement)
- CC7.2: System monitoring (audit trail logging)
- CC7.4: Incidents (emergency revocation procedure)

### Security Policy (SEC-POL-007)

Implementation follows quarterly rotation requirement:
- **Rotation Frequency:** Every 90 days
- **Dual-Active Window:** 72 hours
- **Audit Logging:** Full key values, encrypted at rest
- **Emergency Procedures:** Immediate revocation capability

## References

- [API Key Rotation Guide](./api-key-rotation.md)
- [INC-3344 Post-Incident Report](./incidents/INC-3344.md) — Why full key logging is critical
- Security Policy: SEC-POL-007
- Audit Finding: DTT-2026-4891 #7
