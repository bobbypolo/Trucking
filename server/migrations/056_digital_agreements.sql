-- Migration 056 — digital agreements from rate confirmation (STORY-009 Phase 9)
-- Creates the digital_agreements table that backs the "Generate Agreement"
-- workflow from LoadDetailView. Stores the rate confirmation snapshot and
-- signature metadata so an agreement can be created as DRAFT and later
-- transitioned to SIGNED once the broker countersigns.
--
-- Columns (9 total, per R-P9-01):
--   id              VARCHAR(36)  primary key (UUID v4)
--   company_id      VARCHAR(36)  tenant isolation
--   load_id         VARCHAR(36)  source load reference
--   rate_con_data   JSON         snapshot of rate confirmation payload
--   status          ENUM         DRAFT | SENT | SIGNED | VOIDED (default DRAFT)
--   signature_data  JSON         populated on PATCH .../sign (nullable)
--   signed_at       DATETIME     populated on PATCH .../sign (nullable)
--   created_at      DATETIME     row creation timestamp
--   updated_at      DATETIME     row update timestamp

-- UP
CREATE TABLE IF NOT EXISTS digital_agreements (
  id VARCHAR(36) NOT NULL,
  company_id VARCHAR(36) NOT NULL,
  load_id VARCHAR(36) NOT NULL,
  rate_con_data JSON NULL,
  status ENUM('DRAFT', 'SENT', 'SIGNED', 'VOIDED') NOT NULL DEFAULT 'DRAFT',
  signature_data JSON NULL,
  signed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_digital_agreements_company (company_id),
  KEY idx_digital_agreements_load (load_id),
  KEY idx_digital_agreements_status (status)
);

-- DOWN
DROP TABLE IF EXISTS digital_agreements;
