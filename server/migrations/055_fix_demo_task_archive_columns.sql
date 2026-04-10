-- Migration 055: Backfill archived_at on task/work item tables for legacy demo DBs
-- UP

ALTER TABLE operational_tasks
  ADD COLUMN IF NOT EXISTS archived_at DATETIME NULL;

ALTER TABLE work_items
  ADD COLUMN IF NOT EXISTS archived_at DATETIME NULL;

-- DOWN
ALTER TABLE work_items
  DROP COLUMN IF EXISTS archived_at;

ALTER TABLE operational_tasks
  DROP COLUMN IF EXISTS archived_at;
