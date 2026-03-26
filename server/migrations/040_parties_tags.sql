-- Migration 040: Add tags column to parties table for entity capabilities
-- Team 05: Onboarding entity model (T5-02)
-- Renumbered from 038 to resolve conflict with 038_accounting_tenant_to_company_id.sql

-- UP
ALTER TABLE parties ADD COLUMN tags JSON DEFAULT NULL COMMENT 'Entity capability tags (e.g. ["fuel","maintenance","rental"])';

-- DOWN
ALTER TABLE parties DROP COLUMN tags;
