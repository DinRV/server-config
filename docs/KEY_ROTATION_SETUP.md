# Key Rotation System Setup Checklist

Use this checklist to deploy the key rotation system to your environment.

## Pre-Deployment

- [ ] Review [KEY_ROTATION_IMPLEMENTATION.md](./KEY_ROTATION_IMPLEMENTATION.md)
- [ ] Verify database has `api_keys` table with required schema
- [ ] Create `/var/log/app/` directory with proper permissions (755)
- [ ] Generate and secure encryption key for `AUDIT_LOG_ENCRYPTION_KEY`
- [ ] Plan rotation schedule (default: 1st of Jan, Apr, Jul, Oct at 02:00 UTC)
- [ ] Notify DevOps/SRE team of upcoming deployment

## Installation

- [ ] Copy rotation scripts to `/app/scripts/`:
  - [ ] `rotate-all-keys.js`
  - [ ] `verify-key-rotation.js`
  - [ ] `revoke-key.js`
  - [ ] Set executable permissions: `chmod 755`

- [ ] Copy service to `/app/src/services/`:
  - [ ] `keyRotation.js`
  - [ ] Verify import path in scripts matches

- [ ] Create `/logs/` directory with permissions (750, owned by app user)

## Configuration

- [ ] Set environment variables:
  ```bash
  ROTATION_SERVICE_ACCOUNT=key-rotation-system
  AUDIT_LOG_ENCRYPTION_KEY=<base64-encoded-32-byte-key>
  ```

- [ ] Verify database connection settings are available to rotation process

- [ ] Test audit log writing:
  ```bash
  node /app/scripts/rotate-all-keys.js --dry-run 2>/dev/null | head -20
  ```

## Cron Scheduling

- [ ] Add cron job for quarterly rotation:
  ```bash
  # As root or app user with appropriate permissions
  crontab -e
  # 0 2 1 1,4,7,10 * node /app/scripts/rotate-all-keys.js >> /var/log/app/key-rotation.log 2>&1
  ```

- [ ] Verify cron entry:
  ```bash
  crontab -l | grep rotate-all-keys
  ```

- [ ] Test manual rotation execution:
  ```bash
  node /app/scripts/rotate-all-keys.js
  ```

## Testing

- [ ] **Dry Run:** Execute rotation without database changes
  - [ ] Verify audit log entries are created
  - [ ] Verify encryption is working
  - [ ] Check for any permission errors

- [ ] **Single Service:** Rotate one test service manually
  - [ ] Verify rotation completes successfully
  - [ ] Run verification: `verify-key-rotation.js --service test-api --env staging`
  - [ ] Confirm audit log entry with encrypted keys

- [ ] **Smoke Tests:** Validate new keys work
  - [ ] Deploy services with new keys
  - [ ] Run integration tests
  - [ ] Verify all services can authenticate

- [ ] **Emergency Revocation:** Test key revocation
  - [ ] Execute: `revoke-key.js --service test-api --env staging --reason compromised`
  - [ ] Verify key is deactivated
  - [ ] Verify audit entry includes revocation reason

## Monitoring & Alerting

- [ ] Set up monitoring for rotation script exit codes
  - [ ] Alert on exit code != 0
  - [ ] Alert if rotation doesn't run on expected schedule

- [ ] Set up log monitoring:
  - [ ] Alert on `key_rotation_failed` entries
  - [ ] Alert on `key_revocation` entries
  - [ ] Alert on encryption errors

- [ ] Configure backup for audit logs:
  - [ ] Daily encrypted backups
  - [ ] Offsite storage
  - [ ] 1-year retention (SOC 2 compliance)

- [ ] Set up access logging for audit log file:
  - [ ] Monitor who accesses `/logs/key-rotation-audit.jsonl`
  - [ ] Alert on unauthorized access

## Documentation

- [ ] Update runbooks with rotation procedures
- [ ] Document emergency revocation process
- [ ] Brief incident response team on:
  - [ ] How to decrypt audit entries (if needed)
  - [ ] How to query rotation history
  - [ ] Key exposure timeline calculation

- [ ] Add links to documentation:
  - [ ] [Comprehensive Implementation Guide](./KEY_ROTATION_IMPLEMENTATION.md)
  - [ ] [API Key Rotation Guide](./api-key-rotation.md)
  - [ ] [Cron Configuration](../scripts/rotate-keys.cron)

## Post-Deployment

- [ ] Monitor first scheduled rotation (next Q1/Q2/Q3/Q4 date)
  - [ ] Check logs: `tail -f /var/log/app/key-rotation.log`
  - [ ] Verify all services rotated
  - [ ] Verify zero failures

- [ ] Run quarterly verification after rotation:
  ```bash
  for service in $(cut -d'/' -f1 /logs/key-rotation-audit.jsonl | sort -u); do
    node /app/scripts/verify-key-rotation.js --service $service --env production
  done
  ```

- [ ] Review audit logs monthly:
  - [ ] Check for anomalies
  - [ ] Verify proper encryption
  - [ ] Confirm retention policy

- [ ] Schedule quarterly rotation dry-run (before each real rotation)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "No active key found" | Verify `api_keys` table has records with `is_active = true` |
| Audit log write failure | Check directory permissions, disk space, SELinux policies |
| Encryption error | Verify `AUDIT_LOG_ENCRYPTION_KEY` is valid base64, 32 bytes |
| Cron not running | Check crontab syntax, verify node path, check cron service |
| Database connection fails | Verify connection string, credentials, firewall rules |
| Verification fails | Wait 60s for database replication, check new key in database |

## Compliance Verification

- [ ] Confirm audit trail includes:
  - [ ] Timestamp of each rotation
  - [ ] Service account that triggered rotation
  - [ ] Full key values (encrypted)
  - [ ] Environment identifier
  - [ ] TTL (72h)

- [ ] Verify encryption:
  - [ ] AES-256-GCM algorithm
  - [ ] Random IV per entry
  - [ ] Authentication tag present
  - [ ] Encryption key from environment (not hardcoded)

- [ ] Confirm 72h dual-active window:
  - [ ] Old key marked with `expiresOldKeyAt`
  - [ ] Both keys can authenticate during window
  - [ ] Old key auto-revoked after 72h

- [ ] Validate emergency procedures:
  - [ ] Revocation script works
  - [ ] Revoked key is deactivated immediately
  - [ ] Audit entry includes revocation reason

## Sign-Off

- [ ] Security team approves deployment
- [ ] DevOps team confirms cron scheduling
- [ ] Monitoring team confirms alerting
- [ ] Compliance team confirms SOC 2 compliance

**Deployment Date:** _______________  
**Deployed By:** _______________  
**Verified By:** _______________  
