-- Migration: 038_accounting_tenant_to_company_id
-- Description: Reconcile tenant_id → company_id across all accounting, IFTA,
--   and exception tables to match the project-wide convention (company_id).
--   Tables from migrations 011, 012, 013, and 016 used tenant_id while every
--   other domain table uses company_id. Migration 037 already fixed the parties
--   subsystem (rate_rows, constraint_sets); this migration covers the rest.
--
-- Tables affected:
--   011: gl_accounts, journal_entries, ar_invoices, ap_bills, fuel_ledger, driver_settlements
--   012: mileage_jurisdiction, document_vault, sync_qb_log, adjustment_entries
--   013: ifta_trip_evidence, ifta_trips_audit
--   016: exceptions (VARCHAR(64) → VARCHAR(36) to match companies.id type)
--
-- Strategy per table:
--   1. Drop indexes/unique keys that reference tenant_id
--   2. CHANGE COLUMN tenant_id → company_id
--   3. Recreate indexes/unique keys with company_id
--
-- Author: team01-agent-db
-- Date: 2026-03-24

-- UP

-- ============================================================
-- gl_accounts (from 011)
-- ============================================================
ALTER TABLE gl_accounts DROP INDEX uq_gl_account_tenant_number;
ALTER TABLE gl_accounts DROP INDEX idx_gl_accounts_tenant;
ALTER TABLE gl_accounts
  CHANGE COLUMN tenant_id company_id VARCHAR(36) NOT NULL;
ALTER TABLE gl_accounts
  ADD UNIQUE KEY uq_gl_account_company_number (company_id, account_number);
CREATE INDEX idx_gl_accounts_company ON gl_accounts (company_id);

-- ============================================================
-- journal_entries (from 011)
-- ============================================================
ALTER TABLE journal_entries DROP INDEX idx_je_tenant;
ALTER TABLE journal_entries
  CHANGE COLUMN tenant_id company_id VARCHAR(36) NOT NULL;
CREATE INDEX idx_je_company ON journal_entries (company_id);

-- ============================================================
-- ar_invoices (from 011)
-- ============================================================
ALTER TABLE ar_invoices DROP INDEX uq_ar_invoice_tenant_num;
ALTER TABLE ar_invoices DROP INDEX idx_ar_invoices_tenant;
ALTER TABLE ar_invoices
  CHANGE COLUMN tenant_id company_id VARCHAR(36) NOT NULL;
ALTER TABLE ar_invoices
  ADD UNIQUE KEY uq_ar_invoice_company_num (company_id, invoice_number);
CREATE INDEX idx_ar_invoices_company ON ar_invoices (company_id);

-- ============================================================
-- ap_bills (from 011)
-- ============================================================
ALTER TABLE ap_bills DROP INDEX idx_ap_bills_tenant;
ALTER TABLE ap_bills
  CHANGE COLUMN tenant_id company_id VARCHAR(36) NOT NULL;
CREATE INDEX idx_ap_bills_company ON ap_bills (company_id);

-- ============================================================
-- fuel_ledger (from 011)
-- ============================================================
ALTER TABLE fuel_ledger DROP INDEX idx_fuel_ledger_tenant;
ALTER TABLE fuel_ledger
  CHANGE COLUMN tenant_id company_id VARCHAR(36) NOT NULL;
CREATE INDEX idx_fuel_ledger_company ON fuel_ledger (company_id);

-- ============================================================
-- driver_settlements (from 011)
-- ============================================================
ALTER TABLE driver_settlements DROP INDEX idx_driver_settlements_tenant;
ALTER TABLE driver_settlements
  CHANGE COLUMN tenant_id company_id VARCHAR(36) NOT NULL;
CREATE INDEX idx_driver_settlements_company ON driver_settlements (company_id);

-- ============================================================
-- mileage_jurisdiction (from 012)
-- ============================================================
ALTER TABLE mileage_jurisdiction DROP INDEX idx_mileage_jurisdiction_tenant;
ALTER TABLE mileage_jurisdiction
  CHANGE COLUMN tenant_id company_id VARCHAR(36) NOT NULL;
CREATE INDEX idx_mileage_jurisdiction_company ON mileage_jurisdiction (company_id);

-- ============================================================
-- document_vault (from 012)
-- ============================================================
ALTER TABLE document_vault DROP INDEX idx_document_vault_tenant;
ALTER TABLE document_vault
  CHANGE COLUMN tenant_id company_id VARCHAR(36) NOT NULL;
CREATE INDEX idx_document_vault_company ON document_vault (company_id);

-- ============================================================
-- sync_qb_log (from 012)
-- ============================================================
ALTER TABLE sync_qb_log DROP INDEX idx_sync_qb_log_tenant;
ALTER TABLE sync_qb_log
  CHANGE COLUMN tenant_id company_id VARCHAR(36) NOT NULL;
CREATE INDEX idx_sync_qb_log_company ON sync_qb_log (company_id);

-- ============================================================
-- adjustment_entries (from 012)
-- ============================================================
ALTER TABLE adjustment_entries DROP INDEX idx_adjustment_entries_tenant;
ALTER TABLE adjustment_entries
  CHANGE COLUMN tenant_id company_id VARCHAR(36) NOT NULL;
CREATE INDEX idx_adjustment_entries_company ON adjustment_entries (company_id);

-- ============================================================
-- ifta_trip_evidence (from 013)
-- ============================================================
ALTER TABLE ifta_trip_evidence DROP INDEX idx_ifta_evidence_tenant;
ALTER TABLE ifta_trip_evidence
  CHANGE COLUMN tenant_id company_id VARCHAR(36) NOT NULL;
CREATE INDEX idx_ifta_evidence_company ON ifta_trip_evidence (company_id);

-- ============================================================
-- ifta_trips_audit (from 013)
-- ============================================================
ALTER TABLE ifta_trips_audit DROP INDEX idx_ifta_trips_audit_tenant;
ALTER TABLE ifta_trips_audit
  CHANGE COLUMN tenant_id company_id VARCHAR(36) NOT NULL;
CREATE INDEX idx_ifta_trips_audit_company ON ifta_trips_audit (company_id);

-- ============================================================
-- exceptions (from 016)
-- Note: This table used VARCHAR(64) for tenant_id; we normalize to
-- VARCHAR(36) to match companies.id. Any existing data with values
-- longer than 36 chars (e.g. 'DEFAULT') will be truncated — the seed
-- value 'DEFAULT' is only 7 chars so this is safe.
-- ============================================================
ALTER TABLE exceptions
  CHANGE COLUMN tenant_id company_id VARCHAR(36) NOT NULL DEFAULT 'DEFAULT';

-- DOWN

-- ============================================================
-- Reverse: company_id → tenant_id on all tables
-- ============================================================

-- exceptions (016) — restore VARCHAR(64) original type
ALTER TABLE exceptions
  CHANGE COLUMN company_id tenant_id VARCHAR(64) NOT NULL DEFAULT 'DEFAULT';

-- ifta_trips_audit (013)
ALTER TABLE ifta_trips_audit DROP INDEX idx_ifta_trips_audit_company;
ALTER TABLE ifta_trips_audit
  CHANGE COLUMN company_id tenant_id VARCHAR(36) NOT NULL;
CREATE INDEX idx_ifta_trips_audit_tenant ON ifta_trips_audit (tenant_id);

-- ifta_trip_evidence (013)
ALTER TABLE ifta_trip_evidence DROP INDEX idx_ifta_evidence_company;
ALTER TABLE ifta_trip_evidence
  CHANGE COLUMN company_id tenant_id VARCHAR(36) NOT NULL;
CREATE INDEX idx_ifta_evidence_tenant ON ifta_trip_evidence (tenant_id);

-- adjustment_entries (012)
ALTER TABLE adjustment_entries DROP INDEX idx_adjustment_entries_company;
ALTER TABLE adjustment_entries
  CHANGE COLUMN company_id tenant_id VARCHAR(36) NOT NULL;
CREATE INDEX idx_adjustment_entries_tenant ON adjustment_entries (tenant_id);

-- sync_qb_log (012)
ALTER TABLE sync_qb_log DROP INDEX idx_sync_qb_log_company;
ALTER TABLE sync_qb_log
  CHANGE COLUMN company_id tenant_id VARCHAR(36) NOT NULL;
CREATE INDEX idx_sync_qb_log_tenant ON sync_qb_log (tenant_id);

-- document_vault (012)
ALTER TABLE document_vault DROP INDEX idx_document_vault_company;
ALTER TABLE document_vault
  CHANGE COLUMN company_id tenant_id VARCHAR(36) NOT NULL;
CREATE INDEX idx_document_vault_tenant ON document_vault (tenant_id);

-- mileage_jurisdiction (012)
ALTER TABLE mileage_jurisdiction DROP INDEX idx_mileage_jurisdiction_company;
ALTER TABLE mileage_jurisdiction
  CHANGE COLUMN company_id tenant_id VARCHAR(36) NOT NULL;
CREATE INDEX idx_mileage_jurisdiction_tenant ON mileage_jurisdiction (tenant_id);

-- driver_settlements (011)
ALTER TABLE driver_settlements DROP INDEX idx_driver_settlements_company;
ALTER TABLE driver_settlements
  CHANGE COLUMN company_id tenant_id VARCHAR(36) NOT NULL;
CREATE INDEX idx_driver_settlements_tenant ON driver_settlements (tenant_id);

-- fuel_ledger (011)
ALTER TABLE fuel_ledger DROP INDEX idx_fuel_ledger_company;
ALTER TABLE fuel_ledger
  CHANGE COLUMN company_id tenant_id VARCHAR(36) NOT NULL;
CREATE INDEX idx_fuel_ledger_tenant ON fuel_ledger (tenant_id);

-- ap_bills (011)
ALTER TABLE ap_bills DROP INDEX idx_ap_bills_company;
ALTER TABLE ap_bills
  CHANGE COLUMN company_id tenant_id VARCHAR(36) NOT NULL;
CREATE INDEX idx_ap_bills_tenant ON ap_bills (tenant_id);

-- ar_invoices (011)
ALTER TABLE ar_invoices DROP INDEX idx_ar_invoices_company;
ALTER TABLE ar_invoices DROP INDEX uq_ar_invoice_company_num;
ALTER TABLE ar_invoices
  CHANGE COLUMN company_id tenant_id VARCHAR(36) NOT NULL;
ALTER TABLE ar_invoices
  ADD UNIQUE KEY uq_ar_invoice_tenant_num (tenant_id, invoice_number);
CREATE INDEX idx_ar_invoices_tenant ON ar_invoices (tenant_id);

-- journal_entries (011)
ALTER TABLE journal_entries DROP INDEX idx_je_company;
ALTER TABLE journal_entries
  CHANGE COLUMN company_id tenant_id VARCHAR(36) NOT NULL;
CREATE INDEX idx_je_tenant ON journal_entries (tenant_id);

-- gl_accounts (011)
ALTER TABLE gl_accounts DROP INDEX idx_gl_accounts_company;
ALTER TABLE gl_accounts DROP INDEX uq_gl_account_company_number;
ALTER TABLE gl_accounts
  CHANGE COLUMN company_id tenant_id VARCHAR(36) NOT NULL;
ALTER TABLE gl_accounts
  ADD UNIQUE KEY uq_gl_account_tenant_number (tenant_id, account_number);
CREATE INDEX idx_gl_accounts_tenant ON gl_accounts (tenant_id);
