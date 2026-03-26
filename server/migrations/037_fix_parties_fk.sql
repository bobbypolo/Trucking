-- UP

ALTER TABLE parties
  ADD CONSTRAINT fk_parties_company_id
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE rate_rows
  CHANGE COLUMN tenant_id company_id VARCHAR(36) DEFAULT NULL;

ALTER TABLE constraint_sets
  CHANGE COLUMN tenant_id company_id VARCHAR(36) DEFAULT NULL;

-- DOWN
ALTER TABLE constraint_sets
  CHANGE COLUMN company_id tenant_id VARCHAR(36) DEFAULT NULL;

ALTER TABLE rate_rows
  CHANGE COLUMN company_id tenant_id VARCHAR(36) DEFAULT NULL;

ALTER TABLE parties
  DROP FOREIGN KEY fk_parties_company_id;
