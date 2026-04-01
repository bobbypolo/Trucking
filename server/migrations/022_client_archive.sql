-- Migration 022: Customer soft delete / archive support
-- UP

ALTER TABLE customers
  ADD COLUMN archived_at DATETIME NULL DEFAULT NULL,
  ADD COLUMN archived_by VARCHAR(128) NULL DEFAULT NULL;

CREATE INDEX idx_customers_archived_at ON customers (archived_at);

-- DOWN
ALTER TABLE customers
  DROP COLUMN archived_by,
  DROP COLUMN archived_at;
