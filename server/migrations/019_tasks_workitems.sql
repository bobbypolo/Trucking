-- Migration 019: Operational Tasks & Work Items tables
-- UP

CREATE TABLE IF NOT EXISTS operational_tasks (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  status ENUM('OPEN','IN_PROGRESS','DONE','CANCELLED') DEFAULT 'OPEN',
  priority ENUM('LOW','MEDIUM','HIGH','CRITICAL') DEFAULT 'MEDIUM',
  assignee_id VARCHAR(36),
  assigned_to VARCHAR(100),
  due_date DATETIME,
  links JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(36),
  INDEX idx_tasks_company (company_id),
  INDEX idx_tasks_status (company_id, status),
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE TABLE IF NOT EXISTS work_items (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  type VARCHAR(50) NOT NULL,
  label VARCHAR(200),
  description TEXT,
  priority ENUM('Low','Medium','High','Critical') DEFAULT 'Medium',
  status ENUM('Pending','In_Progress','Resolved','Cancelled') DEFAULT 'Pending',
  sla_deadline DATETIME,
  assignee_id VARCHAR(36),
  entity_type VARCHAR(50),
  entity_id VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_work_items_company (company_id),
  INDEX idx_work_items_status (company_id, status),
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- DOWN
DROP TABLE IF EXISTS work_items;
DROP TABLE IF EXISTS operational_tasks;
