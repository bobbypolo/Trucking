-- Migration 021: Contacts & Providers tables
-- UP

CREATE TABLE IF NOT EXISTS contacts (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(200),
  phone VARCHAR(50),
  title VARCHAR(100),
  type VARCHAR(50),
  organization VARCHAR(200),
  preferred_channel VARCHAR(50),
  normalized_phone VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(36),
  archived_at DATETIME NULL,
  INDEX idx_contacts_company (company_id),
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE TABLE IF NOT EXISTS providers (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  name VARCHAR(200) NOT NULL,
  type VARCHAR(50),
  status VARCHAR(50) DEFAULT 'Active',
  phone VARCHAR(50),
  email VARCHAR(200),
  coverage JSON,
  capabilities JSON,
  contacts JSON,
  after_hours_contacts JSON,
  is_247 BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(36),
  archived_at DATETIME NULL,
  INDEX idx_providers_company (company_id),
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- DOWN
DROP TABLE IF EXISTS providers;
DROP TABLE IF EXISTS contacts;
