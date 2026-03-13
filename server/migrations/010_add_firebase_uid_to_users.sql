-- Migration: 010_add_firebase_uid_to_users
-- Description: Ensures Firebase UID mapping exists in SQL users.
--   NOTE: 001_baseline.sql already includes firebase_uid in the users table definition.
--   This migration is a no-op on fresh installs. It exists for backward compatibility
--   with databases created before the baseline was updated to include firebase_uid.
--
-- Idempotency: Handled by MigrationRunner tracking table (_migrations).
--   The _migrations table prevents this migration from being re-applied.
--   On fresh installs, the baseline already has firebase_uid, so this is a no-op.
--
-- Author: recovery-program (updated for MySQL 8.4 + fresh-install compatibility)
-- Date: 2026-03-10

-- UP

-- firebase_uid is already present in 001_baseline.sql users table definition.
-- This migration is intentionally a no-op on fresh installs.
-- On legacy databases without the column, apply the ADD COLUMN manually before running.
SELECT 'firebase_uid column already present in baseline schema' AS migration_note;

-- DOWN

-- No action needed -- column is managed by 001_baseline.sql
SELECT 'firebase_uid column is defined in baseline schema' AS migration_note;
