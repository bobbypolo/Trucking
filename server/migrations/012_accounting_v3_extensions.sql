-- Migration: 012_accounting_v3_extensions
-- Description: Creates V3 accounting extension tables.
--   ar_invoice_lines, ap_bill_lines, settlement_lines, mileage_jurisdiction,
--   document_vault, sync_qb_log, and adjustment_entries.
-- Depends on: 011_accounting_financial_ledger.sql
-- Author: ralph-story STORY-001
-- Date: 2026-03-10
-- Tests R-P1-02

-- UP

CREATE TABLE IF NOT EXISTS ar_invoice_lines (
    id VARCHAR(36) PRIMARY KEY,
    invoice_id VARCHAR(36) NOT NULL,
    catalog_item_id VARCHAR(36),
    description VARCHAR(500) NOT NULL,
    quantity DECIMAL(10,3) NOT NULL DEFAULT 1.000,
    unit_price DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    gl_account_id VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ar_invoice_lines_invoice (invoice_id),
    INDEX idx_ar_invoice_lines_gl (gl_account_id),
    CONSTRAINT fk_ail_invoice FOREIGN KEY (invoice_id) REFERENCES ar_invoices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ap_bill_lines (
    id VARCHAR(36) PRIMARY KEY,
    bill_id VARCHAR(36) NOT NULL,
    description VARCHAR(500) NOT NULL,
    amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    gl_account_id VARCHAR(36),
    allocation_type VARCHAR(50),
    allocation_id VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ap_bill_lines_bill (bill_id),
    INDEX idx_ap_bill_lines_gl (gl_account_id),
    CONSTRAINT fk_abl_bill FOREIGN KEY (bill_id) REFERENCES ap_bills(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settlement_lines (
    id VARCHAR(36) PRIMARY KEY,
    settlement_id VARCHAR(36) NOT NULL,
    description VARCHAR(500) NOT NULL,
    amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    type ENUM('Earning','Deduction','Reimbursement') NOT NULL,
    load_id VARCHAR(36),
    gl_account_id VARCHAR(36),
    sequence_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_settlement_lines_settlement (settlement_id),
    INDEX idx_settlement_lines_load (load_id),
    CONSTRAINT fk_sl_driver_settlement FOREIGN KEY (settlement_id) REFERENCES driver_settlements(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mileage_jurisdiction (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    truck_id VARCHAR(36),
    load_id VARCHAR(36),
    state_code CHAR(2) NOT NULL,
    miles DECIMAL(10,3) NOT NULL DEFAULT 0.000,
    date DATE,
    entry_date DATE,
    source ENUM('ELD','Manual','GPS','ROUTES','Import') NOT NULL DEFAULT 'Manual',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_mileage_jurisdiction_tenant (tenant_id),
    INDEX idx_mileage_jurisdiction_truck (truck_id),
    INDEX idx_mileage_jurisdiction_state (state_code),
    INDEX idx_mileage_jurisdiction_date (date)
);

CREATE TABLE IF NOT EXISTS document_vault (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    type ENUM('BOL','Rate-Con','Invoice','Bill','Receipt','Settlement','Insurance','License','Other') NOT NULL,
    url TEXT NOT NULL,
    filename VARCHAR(500),
    load_id VARCHAR(36),
    driver_id VARCHAR(36),
    truck_id VARCHAR(36),
    vendor_id VARCHAR(36),
    customer_id VARCHAR(36),
    amount DECIMAL(15,2),
    date DATE,
    state_code CHAR(2),
    status ENUM('Draft','Active','Archived','Locked') NOT NULL DEFAULT 'Draft',
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_document_vault_tenant (tenant_id),
    INDEX idx_document_vault_load (load_id),
    INDEX idx_document_vault_driver (driver_id),
    INDEX idx_document_vault_type (type),
    INDEX idx_document_vault_status (status)
);

CREATE TABLE IF NOT EXISTS sync_qb_log (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(36) NOT NULL,
    status ENUM('Pending','Success','Failed','Skipped') NOT NULL DEFAULT 'Pending',
    error_message TEXT,
    attempted_at TIMESTAMP NULL,
    synced_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sync_qb_log_tenant (tenant_id),
    INDEX idx_sync_qb_log_entity (entity_type, entity_id),
    INDEX idx_sync_qb_log_status (status)
);

CREATE TABLE IF NOT EXISTS adjustment_entries (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    parent_entity_type VARCHAR(50) NOT NULL,
    parent_entity_id VARCHAR(36) NOT NULL,
    reason_code VARCHAR(100),
    description TEXT,
    amount_adjustment DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    created_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_adjustment_entries_tenant (tenant_id),
    INDEX idx_adjustment_entries_parent (parent_entity_type, parent_entity_id),
    INDEX idx_adjustment_entries_created_by (created_by)
);

-- DOWN

DROP TABLE IF EXISTS adjustment_entries;
DROP TABLE IF EXISTS sync_qb_log;
DROP TABLE IF EXISTS document_vault;
DROP TABLE IF EXISTS mileage_jurisdiction;
DROP TABLE IF EXISTS settlement_lines;
DROP TABLE IF EXISTS ap_bill_lines;
DROP TABLE IF EXISTS ar_invoice_lines;
