-- UP
-- Migration 042: Add is_locked column to canonical documents table
-- Required by document.repository.ts updateStatusAndLock method
ALTER TABLE documents ADD COLUMN is_locked BOOLEAN NOT NULL DEFAULT FALSE;

-- DOWN
ALTER TABLE documents DROP COLUMN is_locked;
