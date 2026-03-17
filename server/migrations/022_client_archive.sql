-- Migration 022: Customer soft delete / archive support
-- UP

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS archived_at DATETIME NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS archived_by VARCHAR(128) NULL DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_archived_at ON customers (archived_at);

-- DOWN
ALTER TABLE customers
  DROP COLUMN IF EXISTS archived_by,
  DROP COLUMN IF EXISTS archived_at;
