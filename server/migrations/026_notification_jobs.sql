-- Migration: Notification Jobs Table
-- UP

CREATE TABLE IF NOT EXISTS notification_jobs (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  load_id VARCHAR(36) NULL,
  incident_id VARCHAR(36) NULL,
  message TEXT NOT NULL,
  channel VARCHAR(16) NOT NULL,           -- SMS | Call | Push | Email | Multi
  status VARCHAR(16) NOT NULL DEFAULT 'PENDING',  -- PENDING | SENT | FAILED | PARTIAL
  sent_by VARCHAR(255) NOT NULL,
  sent_at DATETIME NOT NULL,
  recipients JSON NOT NULL,               -- array of {id, name, role, phone}
  sync_error BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_notification_jobs_company (company_id),
  INDEX idx_notification_jobs_load (load_id),
  INDEX idx_notification_jobs_incident (incident_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN

DROP TABLE IF EXISTS notification_jobs;
