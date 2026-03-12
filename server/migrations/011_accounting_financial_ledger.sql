-- Migration: 011_accounting_financial_ledger
-- Description: Creates accounting financial ledger tables for the unified GL system.
--   gl_accounts, journal_entries, journal_lines, ar_invoices, ap_bills, fuel_ledger,
--   and driver_settlements.
-- Author: ralph-story STORY-001
-- Date: 2026-03-10
-- Tests R-P1-01

-- UP

CREATE TABLE IF NOT EXISTS gl_accounts (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    account_number VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type ENUM('Asset','Liability','Equity','Income','Expense','COGS') NOT NULL,
    sub_type VARCHAR(100),
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    parent_account_id VARCHAR(36) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_gl_account_tenant_number (tenant_id, account_number),
    INDEX idx_gl_accounts_tenant (tenant_id),
    INDEX idx_gl_accounts_type (type),
    INDEX idx_gl_accounts_active (is_active)
);

CREATE TABLE IF NOT EXISTS journal_entries (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    entry_date DATE NOT NULL,
    reference_number VARCHAR(100),
    description TEXT,
    source_document_type VARCHAR(50),
    source_document_id VARCHAR(36),
    posted_at TIMESTAMP NULL,
    created_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_je_tenant (tenant_id),
    INDEX idx_je_entry_date (entry_date),
    INDEX idx_je_source_doc (source_document_type, source_document_id),
    INDEX idx_je_reference (reference_number)
);

CREATE TABLE IF NOT EXISTS journal_lines (
    id VARCHAR(36) PRIMARY KEY,
    journal_entry_id VARCHAR(36) NOT NULL,
    gl_account_id VARCHAR(36) NOT NULL,
    debit DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    credit DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    allocation_type VARCHAR(50),
    allocation_id VARCHAR(36),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_jl_entry (journal_entry_id),
    INDEX idx_jl_account (gl_account_id),
    INDEX idx_jl_allocation (allocation_type, allocation_id),
    CONSTRAINT fk_jl_entry FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ar_invoices (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    customer_id VARCHAR(36),
    load_id VARCHAR(36),
    invoice_number VARCHAR(100) NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE,
    status ENUM('Draft','Sent','Partial','Paid','Overdue','Void') NOT NULL DEFAULT 'Draft',
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    balance_due DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_ar_invoice_tenant_num (tenant_id, invoice_number),
    INDEX idx_ar_invoices_tenant (tenant_id),
    INDEX idx_ar_invoices_customer (customer_id),
    INDEX idx_ar_invoices_load (load_id),
    INDEX idx_ar_invoices_status (status),
    INDEX idx_ar_invoices_due_date (due_date)
);

CREATE TABLE IF NOT EXISTS ap_bills (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    vendor_id VARCHAR(36),
    bill_number VARCHAR(100),
    bill_date DATE NOT NULL,
    due_date DATE,
    status ENUM('Draft','Pending','Approved','Paid','Overdue','Void') NOT NULL DEFAULT 'Draft',
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    balance_due DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ap_bills_tenant (tenant_id),
    INDEX idx_ap_bills_vendor (vendor_id),
    INDEX idx_ap_bills_status (status),
    INDEX idx_ap_bills_due_date (due_date)
);

CREATE TABLE IF NOT EXISTS fuel_ledger (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    truck_id VARCHAR(36),
    load_id VARCHAR(36),
    state_code CHAR(2) NOT NULL,
    gallons DECIMAL(10,3) NOT NULL DEFAULT 0.000,
    total_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    price_per_gallon DECIMAL(8,4),
    vendor_name VARCHAR(255),
    receipt_url TEXT,
    entry_date DATE NOT NULL,
    source ENUM('Manual','ELD','Import','Receipt') NOT NULL DEFAULT 'Manual',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_fuel_ledger_tenant (tenant_id),
    INDEX idx_fuel_ledger_truck (truck_id),
    INDEX idx_fuel_ledger_state (state_code),
    INDEX idx_fuel_ledger_date (entry_date)
);

CREATE TABLE IF NOT EXISTS driver_settlements (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    driver_id VARCHAR(36) NOT NULL,
    settlement_date DATE NOT NULL,
    period_start DATE,
    period_end DATE,
    status ENUM('Draft','Reviewed','Approved','Paid','Adjusted','Voided') NOT NULL DEFAULT 'Draft',
    total_earnings DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    total_deductions DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    total_reimbursements DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    net_pay DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_driver_settlements_tenant (tenant_id),
    INDEX idx_driver_settlements_driver (driver_id),
    INDEX idx_driver_settlements_date (settlement_date),
    INDEX idx_driver_settlements_status (status)
);

-- DOWN

DROP TABLE IF EXISTS journal_lines;
DROP TABLE IF EXISTS journal_entries;
DROP TABLE IF EXISTS ar_invoices;
DROP TABLE IF EXISTS ap_bills;
DROP TABLE IF EXISTS fuel_ledger;
DROP TABLE IF EXISTS driver_settlements;
DROP TABLE IF EXISTS gl_accounts;
