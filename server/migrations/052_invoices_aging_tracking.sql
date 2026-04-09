-- UP
ALTER TABLE ar_invoices ADD COLUMN days_since_issued INT NULL;
ALTER TABLE ar_invoices ADD COLUMN last_aging_snapshot_at TIMESTAMP NULL;

-- DOWN
ALTER TABLE ar_invoices DROP COLUMN last_aging_snapshot_at;
ALTER TABLE ar_invoices DROP COLUMN days_since_issued;
