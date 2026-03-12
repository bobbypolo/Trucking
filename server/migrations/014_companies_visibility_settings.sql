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
-- Idempotency: Uses stored procedure + INFORMATION_SCHEMA check.
--   MySQL 8.4 does not support ADD COLUMN IF NOT EXISTS syntax.
--
-- Author: ralph-story STORY-006
-- Date: 2026-03-11

-- UP

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

-- DOWN

-- ALTER TABLE companies DROP COLUMN IF EXISTS driver_visibility_settings;
