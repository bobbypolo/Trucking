-- Migration: 005_documents_table
-- Description: Creates documents metadata table for document upload workflow
-- Author: recovery-program
-- Date: 2026-03-07
-- Stores document metadata in MySQL; binary content lives in Firebase Storage.
-- Tenant-scoped via company_id.

-- UP

CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(36) NOT NULL,
    load_id VARCHAR(36) DEFAULT NULL,
    original_filename VARCHAR(512) NOT NULL,
    sanitized_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    storage_path VARCHAR(1024) NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    description TEXT DEFAULT NULL,
    uploaded_by VARCHAR(36) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_documents_company (company_id),
    INDEX idx_documents_load (company_id, load_id),
    INDEX idx_documents_status (company_id, status),
    INDEX idx_documents_type (company_id, document_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN

DROP TABLE IF EXISTS documents;
