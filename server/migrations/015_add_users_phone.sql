-- Migration: 015_add_users_phone
-- Description: Adds the missing phone column to users so runtime upserts match schema expectations.
-- Author: codex
-- Date: 2026-03-11

-- UP

ALTER TABLE users
  ADD COLUMN phone VARCHAR(50) NULL AFTER duty_mode;

-- DOWN

ALTER TABLE users
  DROP COLUMN phone;
