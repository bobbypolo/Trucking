-- Migration 020: Crisis Actions, KCI Requests, Service Tickets
-- UP

CREATE TABLE IF NOT EXISTS crisis_actions (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'Active',
  incident_id VARCHAR(36),
  load_id VARCHAR(36),
  operator_id VARCHAR(36),
  location JSON,
  timeline JSON,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(36),
  updated_by VARCHAR(36),
  INDEX idx_crisis_company (company_id),
  FOREIGN KEY (company_id) REFERENCES companies(id)
  -- NOTE: crisis_actions are NEVER deletable per retention policy
);

CREATE TABLE IF NOT EXISTS kci_requests (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'NEW',
  priority ENUM('LOW','MEDIUM','HIGH','CRITICAL') DEFAULT 'MEDIUM',
  requested_amount DECIMAL(10,2),
  approved_amount DECIMAL(10,2),
  currency VARCHAR(10) DEFAULT 'USD',
  load_id VARCHAR(36),
  driver_id VARCHAR(36),
  source VARCHAR(50),
  requires_docs BOOLEAN DEFAULT FALSE,
  open_record_id VARCHAR(36),
  requested_at DATETIME,
  due_at DATETIME,
  approved_by VARCHAR(100),
  approved_at DATETIME,
  denied_by VARCHAR(100),
  denied_at DATETIME,
  denial_reason TEXT,
  decision_log JSON,
  links JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(36),
  updated_by VARCHAR(36),
  INDEX idx_kci_company (company_id),
  INDEX idx_kci_status (company_id, status),
  FOREIGN KEY (company_id) REFERENCES companies(id)
  -- NOTE: kci_requests are NEVER deletable per retention policy
);

CREATE TABLE IF NOT EXISTS service_tickets (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  type VARCHAR(50),
  status VARCHAR(50) DEFAULT 'Open',
  vendor VARCHAR(200),
  cost DECIMAL(10,2),
  equipment_id VARCHAR(36),
  description TEXT,
  locked_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(36),
  updated_by VARCHAR(36),
  archived_at DATETIME NULL,
  INDEX idx_service_tickets_company (company_id),
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- DOWN
DROP TABLE IF EXISTS service_tickets;
DROP TABLE IF EXISTS kci_requests;
DROP TABLE IF EXISTS crisis_actions;
