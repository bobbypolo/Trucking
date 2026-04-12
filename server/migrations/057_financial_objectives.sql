-- Migration 057 — financial objectives per quarter (STORY-010 Phase 10)
-- Creates the financial_objectives table that backs the quarterly
-- "Actual vs Target" progress tracking in AnalyticsDashboard. Each row
-- captures a tenant's revenue / expense / profit goal for a specific
-- quarter such as "2026-Q2".
--
-- Columns (9 total, per R-P10-01):
--   id              VARCHAR(36)   primary key (UUID v4)
--   company_id      VARCHAR(36)   tenant isolation
--   quarter         VARCHAR(7)    fiscal quarter in "YYYY-QN" format
--   revenue_target  DECIMAL(18,2) aspirational revenue target
--   expense_budget  DECIMAL(18,2) expense budget ceiling
--   profit_target   DECIMAL(18,2) net profit target
--   notes           TEXT          optional freeform notes
--   created_at      DATETIME      row creation timestamp
--   updated_at      DATETIME      row update timestamp

-- UP
CREATE TABLE IF NOT EXISTS financial_objectives (
  id VARCHAR(36) NOT NULL,
  company_id VARCHAR(36) NOT NULL,
  quarter VARCHAR(7) NOT NULL,
  revenue_target DECIMAL(18, 2) NOT NULL DEFAULT 0,
  expense_budget DECIMAL(18, 2) NOT NULL DEFAULT 0,
  profit_target DECIMAL(18, 2) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_financial_objectives_company_quarter (company_id, quarter),
  KEY idx_financial_objectives_company (company_id),
  KEY idx_financial_objectives_quarter (quarter)
);

-- DOWN
DROP TABLE IF EXISTS financial_objectives;
