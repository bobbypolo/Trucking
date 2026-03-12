-- Migration: 014_companies_visibility_settings
-- Description: Adds driver_visibility_settings column to companies table.
--   The getVisibilitySettings() helper in server/helpers.ts references
--   this column to fetch per-company driver data redaction settings. This column
--   was present in production but missing from the baseline schema and all prior
--   migrations. The Stage 1 validation rerun (STORY-006) discovered this gap
--   when GET /api/loads returned 500 due to the missing column.
--
-- Column classification: required-now
--   The loads route (GET /api/loads) calls getVisibilitySettings() on every
--   request. Without this column the route always returns 500.
--
-- Idempotency: Handled by MigrationRunner tracking table (_migrations).
--   The _migrations table prevents this migration from being re-applied.
--   MySQL 8.4 does not support ADD COLUMN IF NOT EXISTS syntax.
--
-- Author: ralph-story STORY-006
-- Date: 2026-03-11

-- UP

ALTER TABLE companies
    ADD COLUMN driver_visibility_settings JSON NULL DEFAULT NULL
    COMMENT 'Per-company driver data redaction settings JSON';

-- DOWN

ALTER TABLE companies DROP COLUMN driver_visibility_settings;
