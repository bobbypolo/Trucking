-- UP
-- Migration 042: Add is_locked column to canonical documents table
-- Required by document.repository.ts updateStatusAndLock method
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE;

-- DOWN
ALTER TABLE documents DROP COLUMN IF EXISTS is_locked;
