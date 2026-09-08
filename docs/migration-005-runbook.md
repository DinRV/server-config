# Migration 005: Storage Reclaim Runbook

## Pre-flight Checklist

- [x] Audit data archived to S3 (verified by DBA team)
- [x] Datadog pipeline confirmed receiving all audit events
- [x] No application code references these tables (grep confirmed)
- [ ] Run migration in staging first
- [ ] Schedule 15-min maintenance window for VACUUM FULL

## Execution

```bash
# Apply migration
npx knex migrate:latest

# Run VACUUM FULL (requires maintenance window)
psql $DATABASE_URL -c "VACUUM FULL users; VACUUM FULL sessions;"
```

## Verification

```sql
-- Confirm tables are gone
SELECT tablename FROM pg_tables WHERE tablename LIKE 'audit%' OR tablename LIKE '%_log%';
-- Should return empty

-- Check storage reclaimed
SELECT pg_size_pretty(pg_database_size(current_database()));
```

## Rollback

Restore from S3 archive:
```bash
aws s3 cp s3://db-archives/audit-2026-q2/ ./restore/ --recursive
pg_restore -d $DATABASE_URL ./restore/audit_tables.dump
```
