-- Migration 014: Add driver_visibility_settings column to companies
--
-- Purpose: The getVisibilitySettings() helper in server/helpers.ts references
-- this column to fetch per-company driver data redaction settings. This column
-- was present in production but missing from the baseline schema and all prior
-- migrations. The Stage 1 validation rerun (STORY-006) discovered this gap
-- when GET /api/loads returned 500 due to the missing column.
--
-- Column classification: required-now
--   The loads route (GET /api/loads) calls getVisibilitySettings() on every
--   request. Without this column the route always returns 500.
--
-- Idempotency: Uses conditional INSERT via INFORMATION_SCHEMA check pattern.
--   MySQL 8.4 does not support ADD COLUMN IF NOT EXISTS — use stored procedure.
--
-- Applied: Automatically by Stage 1 rerun test beforeAll(), also available
--          here for manual migration runs via apply-migrations.sh.

DROP PROCEDURE IF EXISTS add_visibility_settings_column;

DELIMITER $$
CREATE PROCEDURE add_visibility_settings_column()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'companies'
          AND COLUMN_NAME = 'driver_visibility_settings'
    ) THEN
        ALTER TABLE companies
            ADD COLUMN driver_visibility_settings JSON NULL DEFAULT NULL
            COMMENT 'Per-company driver data redaction settings JSON';
    END IF;
END$$
DELIMITER ;

CALL add_visibility_settings_column();
DROP PROCEDURE IF EXISTS add_visibility_settings_column;
