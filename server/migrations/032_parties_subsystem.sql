-- UP

-- Party Onboarding / Network subsystem
-- Source: server/routes/clients.ts lines 283-600

CREATE TABLE IF NOT EXISTS parties (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) DEFAULT 'carrier',
  is_customer TINYINT(1) DEFAULT 0,
  is_vendor TINYINT(1) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active',
  mc_number VARCHAR(50) DEFAULT NULL,
  dot_number VARCHAR(50) DEFAULT NULL,
  rating DECIMAL(3,1) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_parties_company_id (company_id)
);

CREATE TABLE IF NOT EXISTS party_contacts (
  id VARCHAR(36) PRIMARY KEY,
  party_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(100) DEFAULT NULL,
  email VARCHAR(255) DEFAULT NULL,
  phone VARCHAR(50) DEFAULT NULL,
  is_primary TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE,
  INDEX idx_party_contacts_party_id (party_id)
);

CREATE TABLE IF NOT EXISTS party_documents (
  id VARCHAR(36) PRIMARY KEY,
  party_id VARCHAR(36) NOT NULL,
  document_type VARCHAR(100) DEFAULT NULL,
  document_url VARCHAR(500) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE,
  INDEX idx_party_documents_party_id (party_id)
);

CREATE TABLE IF NOT EXISTS rate_rows (
  id VARCHAR(36) PRIMARY KEY,
  party_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) DEFAULT NULL,
  catalog_item_id VARCHAR(36) DEFAULT NULL,
  variant_id VARCHAR(36) DEFAULT NULL,
  direction VARCHAR(20) DEFAULT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  price_type VARCHAR(50) DEFAULT NULL,
  unit_type VARCHAR(50) DEFAULT NULL,
  base_amount DECIMAL(12,2) DEFAULT NULL,
  unit_amount DECIMAL(12,4) DEFAULT NULL,
  min_charge DECIMAL(12,2) DEFAULT NULL,
  max_charge DECIMAL(12,2) DEFAULT NULL,
  free_units INT DEFAULT NULL,
  effective_start DATE DEFAULT NULL,
  effective_end DATE DEFAULT NULL,
  taxable_flag TINYINT(1) DEFAULT 0,
  rounding_rule VARCHAR(20) DEFAULT NULL,
  notes_internal TEXT DEFAULT NULL,
  approval_required TINYINT(1) DEFAULT 0,
  FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE,
  INDEX idx_rate_rows_party_id (party_id),
  INDEX idx_rate_rows_company_id (tenant_id)
);

CREATE TABLE IF NOT EXISTS rate_tiers (
  id VARCHAR(36) PRIMARY KEY,
  rate_row_id VARCHAR(36) NOT NULL,
  tier_start DECIMAL(12,2) DEFAULT NULL,
  tier_end DECIMAL(12,2) DEFAULT NULL,
  unit_amount DECIMAL(12,4) DEFAULT NULL,
  base_amount DECIMAL(12,2) DEFAULT NULL,
  FOREIGN KEY (rate_row_id) REFERENCES rate_rows(id) ON DELETE CASCADE,
  INDEX idx_rate_tiers_rate_row_id (rate_row_id)
);

CREATE TABLE IF NOT EXISTS constraint_sets (
  id VARCHAR(36) PRIMARY KEY,
  party_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) DEFAULT NULL,
  applies_to VARCHAR(100) DEFAULT NULL,
  priority INT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active',
  effective_start DATE DEFAULT NULL,
  effective_end DATE DEFAULT NULL,
  FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE,
  INDEX idx_constraint_sets_party_id (party_id),
  INDEX idx_constraint_sets_company_id (tenant_id)
);

CREATE TABLE IF NOT EXISTS constraint_rules (
  id VARCHAR(36) PRIMARY KEY,
  constraint_set_id VARCHAR(36) NOT NULL,
  rule_type VARCHAR(100) DEFAULT NULL,
  field_key VARCHAR(100) DEFAULT NULL,
  operator VARCHAR(50) DEFAULT NULL,
  value_text VARCHAR(500) DEFAULT NULL,
  enforcement VARCHAR(50) DEFAULT NULL,
  message VARCHAR(500) DEFAULT NULL,
  FOREIGN KEY (constraint_set_id) REFERENCES constraint_sets(id) ON DELETE CASCADE,
  INDEX idx_constraint_rules_set_id (constraint_set_id)
);

CREATE TABLE IF NOT EXISTS party_catalog_links (
  id VARCHAR(36) PRIMARY KEY,
  party_id VARCHAR(36) NOT NULL,
  catalog_item_id VARCHAR(36) NOT NULL,
  FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE,
  INDEX idx_party_catalog_links_party_id (party_id)
);

-- DOWN
DROP TABLE IF EXISTS party_catalog_links;
DROP TABLE IF EXISTS constraint_rules;
DROP TABLE IF EXISTS constraint_sets;
DROP TABLE IF EXISTS rate_tiers;
DROP TABLE IF EXISTS rate_rows;
DROP TABLE IF EXISTS party_documents;
DROP TABLE IF EXISTS party_contacts;
DROP TABLE IF EXISTS parties;
