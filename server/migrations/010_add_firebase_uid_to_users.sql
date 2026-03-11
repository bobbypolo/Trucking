-- Migration: 010_add_firebase_uid_to_users
-- Description: Adds canonical Firebase UID mapping to SQL users
-- Author: recovery-program
-- Date: 2026-03-10

-- UP

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(128) NULL AFTER email;

ALTER TABLE users
  ADD UNIQUE KEY uq_users_firebase_uid (firebase_uid);

-- DOWN

ALTER TABLE users
  DROP INDEX uq_users_firebase_uid;

ALTER TABLE users
  DROP COLUMN firebase_uid;
