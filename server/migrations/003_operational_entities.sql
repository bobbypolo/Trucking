-- Migration: 003_operational_entities
-- Description: Add company_id tenant scoping to incidents;
--              create call_sessions table for call log data.
--              messages company_id moved to 018_messages_threads.sql.
-- Author: ralph-story
-- Date: 2026-03-08

-- UP

-- 1. Add company_id to incidents (tenant scoping)
ALTER TABLE incidents
  ADD COLUMN company_id VARCHAR(36) NULL AFTER id;

-- Back-fill company_id from the associated load's company_id
UPDATE incidents i
  JOIN loads l ON i.load_id = l.id
  SET i.company_id = l.company_id
  WHERE i.company_id IS NULL;

-- Add FK after population so existing rows are valid
ALTER TABLE incidents
  ADD CONSTRAINT fk_incidents_company
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- 2. messages company_id — handled by 018_messages_threads.sql (authoritative)

-- 3. Create call_sessions table (does not exist in baseline)
CREATE TABLE IF NOT EXISTS call_sessions (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  start_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  end_time TIMESTAMP NULL,
  duration_seconds INT DEFAULT 0,
  status ENUM('active', 'completed', 'missed', 'voicemail') DEFAULT 'active',
  assigned_to VARCHAR(36) NULL,
  team VARCHAR(100) NULL,
  last_activity_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes TEXT NULL,
  participants JSON NULL,
  links JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Index for tenant-scoped queries
CREATE INDEX idx_call_sessions_company_id ON call_sessions (company_id);
CREATE INDEX idx_incidents_company_id ON incidents (company_id);
-- idx_messages_company_id — handled by 018_messages_threads.sql (authoritative)
