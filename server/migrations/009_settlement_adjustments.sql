-- Migration: 009_settlement_adjustments
-- Description: Creates settlement_adjustments table for correction records (R-P4-02)
-- Adjustments are immutable correction records against posted settlements.
-- The original posted settlement is NEVER modified — adjustments create new records.
-- Author: recovery-program
-- Date: 2026-03-07

-- UP

CREATE TABLE IF NOT EXISTS settlement_adjustments (
    id VARCHAR(36) PRIMARY KEY,
    settlement_id VARCHAR(36) NOT NULL,
    reason VARCHAR(500) NOT NULL,
    adjustment_type ENUM('correction', 'addition', 'reversal') NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    created_by VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sa_settlement (settlement_id),
    INDEX idx_sa_created_by (created_by),
    CONSTRAINT fk_sa_settlement FOREIGN KEY (settlement_id) REFERENCES settlements(id) ON DELETE RESTRICT
);

-- DOWN

DROP TABLE IF EXISTS settlement_adjustments;
