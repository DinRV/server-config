-- Migration: 005_storage_reclaim.sql
-- Author: DBA Team (James Park)
-- Date: 2026-09-01
-- Ticket: DBA-2103
--
-- Purpose: Reclaim ~340GB of storage from deprecated audit and logging
-- tables that were replaced by the Datadog log pipeline in Q2 2026.
-- These tables haven't received writes since the Datadog migration
-- (confirmed via pg_stat_user_tables.n_tup_ins = 0 since June).
--
-- The data has been archived to S3 (s3://db-archives/audit-2026-q2/)
-- by the backup team before this migration. Verified by:
--   Sarah Kim (DBA) on 2026-08-28
--   James Park (DBA) on 2026-08-29
--
-- Storage estimate:
--   audit_logs:           180GB (2.1B rows)
--   audit_log_details:     95GB (4.3B rows)
--   request_logs:          52GB (890M rows)
--   legacy_access_log:     13GB (210M rows)
--   Total:               ~340GB
--
-- Post-migration: VACUUM FULL on remaining tables to reclaim
-- fragmented pages. Estimated 15% storage improvement.
--
-- Rollback: Restore from S3 archive using pg_restore.
-- Estimated restore time: ~4 hours for full dataset.

BEGIN;

-- Drop deprecated audit tables (replaced by Datadog, data archived to S3)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS audit_log_details CASCADE;
DROP TABLE IF EXISTS request_logs CASCADE;
DROP TABLE IF EXISTS legacy_access_log CASCADE;

-- Drop associated indexes (CASCADE handles most, but explicit for partitioned)
DROP INDEX IF EXISTS idx_audit_logs_user_id;
DROP INDEX IF EXISTS idx_audit_logs_created_at;
DROP INDEX IF EXISTS idx_audit_logs_action;
DROP INDEX IF EXISTS idx_request_logs_path;
DROP INDEX IF EXISTS idx_request_logs_timestamp;

-- Drop the audit trigger function (no longer needed)
DROP FUNCTION IF EXISTS fn_audit_trigger() CASCADE;

-- Record migration
INSERT INTO schema_migrations (version, description, applied_by, applied_at)
VALUES ('005', 'storage_reclaim_audit_tables', current_user, now());

COMMIT;

-- Run VACUUM FULL separately (can't run inside transaction)
-- VACUUM FULL users;
-- VACUUM FULL sessions;
-- VACUUM FULL billing_accounts;
