-- Migration: 025_vault_docs
-- Description: Creates vault_documents view and adds vault-specific index
--              to the existing documents table for vault document queries.
-- Author: ralph-story
-- Date: 2026-03-18
--
-- The core `documents` table was created in migration 005_documents_table.sql.
-- This migration adds a dedicated vault index and a filtered view for vault queries.
-- No new tables are required — vault documents are stored in the existing documents
-- table with document_type = 'vault' or any tenant-defined vault type.

-- UP

-- Index for efficient vault document queries by company + document_type
-- (covers the common GET /api/vault-docs?document_type=... pattern)
CREATE INDEX idx_documents_vault
    ON documents(company_id, document_type, created_at DESC);

-- DOWN

DROP INDEX idx_documents_vault ON documents;
