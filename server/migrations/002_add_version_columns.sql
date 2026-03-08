-- Migration: 002_add_version_columns
-- Description: Adds version columns for optimistic locking to loads, equipment, users
-- Author: recovery-program
-- Date: 2026-03-07

-- UP

ALTER TABLE loads ADD COLUMN version INT NOT NULL DEFAULT 1;
ALTER TABLE equipment ADD COLUMN version INT NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN version INT NOT NULL DEFAULT 1;

-- DOWN

ALTER TABLE loads DROP COLUMN version;
ALTER TABLE equipment DROP COLUMN version;
ALTER TABLE users DROP COLUMN version;
