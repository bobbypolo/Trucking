-- Migration: 015_add_users_phone
-- Description: Adds the missing phone column to users so runtime upserts match schema expectations.
--
-- Idempotency: Handled by MigrationRunner tracking table (_migrations).
--   The _migrations table prevents this migration from being re-applied.
--   MySQL 8.4 does not support ADD COLUMN IF NOT EXISTS syntax.
--
-- Author: codex
-- Date: 2026-03-11

-- UP

ALTER TABLE users
    ADD COLUMN phone VARCHAR(50) NULL AFTER duty_mode;

-- DOWN

ALTER TABLE users DROP COLUMN phone;
