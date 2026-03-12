-- Migration: 015_add_users_phone
-- Description: Adds the missing phone column to users so runtime upserts match schema expectations.
--
-- Idempotency: Uses stored procedure + INFORMATION_SCHEMA check.
--   MySQL 8.4 does not support ADD COLUMN IF NOT EXISTS syntax.
--
-- Author: codex
-- Date: 2026-03-11

-- UP

DROP PROCEDURE IF EXISTS add_users_phone_column;

DELIMITER $$
CREATE PROCEDURE add_users_phone_column()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'users'
          AND COLUMN_NAME = 'phone'
    ) THEN
        ALTER TABLE users
            ADD COLUMN phone VARCHAR(50) NULL AFTER duty_mode;
    END IF;
END$$
DELIMITER ;

CALL add_users_phone_column();
DROP PROCEDURE IF EXISTS add_users_phone_column;

-- DOWN

-- ALTER TABLE users DROP COLUMN IF EXISTS phone;
