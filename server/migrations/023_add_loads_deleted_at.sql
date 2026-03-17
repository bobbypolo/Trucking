-- Migration: 023_add_loads_deleted_at
-- Description: Add deleted_at column to loads table for soft-delete support
-- Author: builder-agent
-- Date: 2026-03-17

-- UP
ALTER TABLE loads ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL;
CREATE INDEX idx_loads_deleted_at ON loads(deleted_at);

-- DOWN
DROP INDEX idx_loads_deleted_at ON loads;
ALTER TABLE loads DROP COLUMN deleted_at;
