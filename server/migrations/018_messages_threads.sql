-- Migration 018: Messages & Threads tables (extend existing messages route)
-- UP

CREATE TABLE IF NOT EXISTS threads (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  title VARCHAR(200),
  status ENUM('Active','Archived') DEFAULT 'Active',
  owner_id VARCHAR(36),
  record_links JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(36),
  INDEX idx_threads_company (company_id),
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- Messages table may already exist from earlier migrations.
-- This ensures the table exists with proper tenant isolation.
CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  load_id VARCHAR(36),
  thread_id VARCHAR(36),
  sender_id VARCHAR(36),
  sender_name VARCHAR(100),
  body TEXT NOT NULL,
  attachments JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  archived_at DATETIME NULL,
  INDEX idx_messages_company (company_id),
  INDEX idx_messages_load (company_id, load_id),
  INDEX idx_messages_thread (thread_id),
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- DOWN
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS threads;
