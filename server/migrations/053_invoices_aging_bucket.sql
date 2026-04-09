-- UP
ALTER TABLE ar_invoices ADD COLUMN aging_bucket VARCHAR(16) NULL;

-- DOWN
ALTER TABLE ar_invoices DROP COLUMN aging_bucket;
