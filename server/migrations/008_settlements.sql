-- Migration: 008_settlements
-- Description: Creates settlements and settlement_detail_lines tables (R-P4-01)
-- Settlement is a SEPARATE entity from load. Load status does NOT change
-- when settlement transitions occur.
-- Author: recovery-program
-- Date: 2026-03-07

-- UP

CREATE TABLE IF NOT EXISTS settlements (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(36) NOT NULL,
    load_id VARCHAR(36) NOT NULL,
    driver_id VARCHAR(36) NOT NULL,
    settlement_date DATE NOT NULL,
    period_start DATE DEFAULT NULL,
    period_end DATE DEFAULT NULL,
    status ENUM('pending_generation', 'generated', 'reviewed', 'posted', 'adjusted') NOT NULL DEFAULT 'pending_generation',
    total_earnings DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_deductions DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_reimbursements DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    net_pay DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_by VARCHAR(36) NOT NULL,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_settlement_load_tenant (load_id, company_id),
    INDEX idx_settlements_company (company_id),
    INDEX idx_settlements_driver (driver_id),
    INDEX idx_settlements_load (load_id),
    INDEX idx_settlements_status (status),
    INDEX idx_settlements_date (settlement_date)
);

CREATE TABLE IF NOT EXISTS settlement_detail_lines (
    id VARCHAR(36) PRIMARY KEY,
    settlement_id VARCHAR(36) NOT NULL,
    description VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    type ENUM('earning', 'deduction', 'reimbursement') NOT NULL,
    load_id VARCHAR(36) DEFAULT NULL,
    gl_account_id VARCHAR(36) DEFAULT NULL,
    sequence_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sdl_settlement (settlement_id),
    INDEX idx_sdl_load (load_id),
    CONSTRAINT fk_sdl_settlement FOREIGN KEY (settlement_id) REFERENCES settlements(id) ON DELETE CASCADE
);

-- DOWN

DROP TABLE IF EXISTS settlement_detail_lines;
DROP TABLE IF EXISTS settlements;
