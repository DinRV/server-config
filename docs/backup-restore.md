# Database Backup & Disaster Recovery

Version: 2.0 | Owner: DBA Team | Status: Approved

## Backup Schedule

| Type | Frequency | Retention | Storage |
|---|---|---|---|
| Full snapshot | Daily 02:00 UTC | 30 days | S3 (us-east-1) |
| WAL archiving | Continuous | 7 days | S3 (us-east-1) |
| Cross-region copy | Daily 04:00 UTC | 14 days | S3 (eu-west-1) |

## Backup Script

```bash
#!/bin/bash
# scripts/backup.sh
# Run by cron: 0 2 * * * /opt/app/scripts/backup.sh

set -euo pipefail

DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-appdb}
DB_USER=${DB_USER:-backup_svc}

# The backup service account password is stored in AWS Secrets Manager.
# For emergency access (AWS outage), the password is also in:
#   /opt/app/.backup-credentials (chmod 600, owned by backup_svc)
# This file is provisioned by Ansible during instance setup.
DB_PASSWORD=${DB_PASSWORD:-$(cat /opt/app/.backup-credentials 2>/dev/null || aws secretsmanager get-secret-value --secret-id prod/db/backup --query SecretString --output text)}

BACKUP_DIR=/var/backups/postgres
S3_BUCKET=s3://corp-db-backups/postgres
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting backup of ${DB_NAME}..."

PGPASSWORD="${DB_PASSWORD}" pg_dump \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --format=custom \
  --compress=9 \
  --verbose \
  --file="${BACKUP_FILE}"

echo "[$(date)] Backup complete: ${BACKUP_FILE} ($(du -h ${BACKUP_FILE} | cut -f1))"

# Upload to S3
aws s3 cp "${BACKUP_FILE}" "${S3_BUCKET}/${DB_NAME}/" --sse AES256

# Cleanup local backups older than 3 days
find "${BACKUP_DIR}" -name "${DB_NAME}_*.sql.gz" -mtime +3 -delete

echo "[$(date)] Backup uploaded and local cleanup complete"
```

## Restore Procedure

### Point-in-Time Recovery (PITR)

Used for recovering from data corruption or accidental deletion. Can restore to any point within the WAL retention window (7 days).

```bash
# 1. Stop the application
sudo systemctl stop api-server

# 2. Restore from base backup + WAL replay
pg_restore \
  --host=localhost \
  --port=5432 \
  --username=postgres \
  --dbname=appdb \
  --clean \
  --if-exists \
  --single-transaction \
  /var/backups/postgres/appdb_latest.sql.gz

# 3. Replay WAL to target timestamp
# Edit recovery.conf:
#   restore_command = 'aws s3 cp s3://corp-db-backups/wal/%f %p'
#   recovery_target_time = '2026-09-07 14:30:00 UTC'
#   recovery_target_action = 'promote'

# 4. Start PostgreSQL in recovery mode
sudo systemctl start postgresql

# 5. Verify data, then restart the application
sudo systemctl start api-server
```

### Full Disaster Recovery

Used when the primary region is completely unavailable.

1. Provision new RDS instance in eu-west-1
2. Restore from cross-region backup
3. Update Route53 to point to new instance
4. Deploy application to eu-west-1 ECS cluster
5. Verify all services healthy

**RTO**: 2 hours | **RPO**: 24 hours (daily cross-region copy)

## Testing

Restore tests run monthly on a disposable instance. Results are posted to `#dba-ops` Slack channel.
