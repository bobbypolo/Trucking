-- UP

CREATE TABLE IF NOT EXISTS call_logs (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  phone_number VARCHAR(50) NOT NULL,
  contact_name VARCHAR(255),
  context VARCHAR(500),
  direction ENUM('inbound','outbound') DEFAULT 'outbound',
  duration_seconds INT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  INDEX idx_call_logs_company (company_id),
  INDEX idx_call_logs_phone (phone_number),
  INDEX idx_call_logs_date (created_at DESC)
);
