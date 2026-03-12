-- Migration: 010_add_firebase_uid_to_users
-- Description: Adds canonical Firebase UID mapping to SQL users
--
-- Idempotency: Uses stored procedure + INFORMATION_SCHEMA check.
--   MySQL 8.4 does not support ADD COLUMN IF NOT EXISTS syntax.
--
-- Author: recovery-program
-- Date: 2026-03-10

-- UP

DROP PROCEDURE IF EXISTS add_firebase_uid_column;

DELIMITER $$
CREATE PROCEDURE add_firebase_uid_column()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'users'
          AND COLUMN_NAME = 'firebase_uid'
    ) THEN
        ALTER TABLE users
            ADD COLUMN firebase_uid VARCHAR(128) NULL AFTER email;
    END IF;
END$$
DELIMITER ;

CALL add_firebase_uid_column();
DROP PROCEDURE IF EXISTS add_firebase_uid_column;

DROP PROCEDURE IF EXISTS add_firebase_uid_unique_key;

DELIMITER $$
CREATE PROCEDURE add_firebase_uid_unique_key()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'users'
          AND INDEX_NAME = 'uq_users_firebase_uid'
    ) THEN
        ALTER TABLE users
            ADD UNIQUE KEY uq_users_firebase_uid (firebase_uid);
    END IF;
END$$
DELIMITER ;

CALL add_firebase_uid_unique_key();
DROP PROCEDURE IF EXISTS add_firebase_uid_unique_key;

-- DOWN

ALTER TABLE users
  DROP INDEX uq_users_firebase_uid;

ALTER TABLE users
  DROP COLUMN firebase_uid;
