-- Migration: 007_ocr_results
-- Description: Creates ocr_results table for storing OCR extraction results
-- Author: recovery-program
-- Date: 2026-03-07
-- OCR results are NEVER auto-applied to load fields; they require explicit human review.
-- Status vocabulary shared with document state machine: processing, review_required, accepted, rejected.
-- Tenant-scoped via company_id.

-- UP

CREATE TABLE IF NOT EXISTS ocr_results (
    id VARCHAR(36) PRIMARY KEY,
    document_id VARCHAR(36) NOT NULL,
    company_id VARCHAR(36) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'processing',
    fields JSON NOT NULL COMMENT 'Array of {field_name, extracted_value, confidence} objects',
    raw_text MEDIUMTEXT DEFAULT NULL COMMENT 'Full raw OCR text output',
    error_reason VARCHAR(50) DEFAULT NULL COMMENT 'Reason for failure: timeout, ocr_failed, etc.',
    processing_duration_ms INT DEFAULT NULL COMMENT 'Time taken for OCR processing in milliseconds',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_ocr_results_document (document_id),
    INDEX idx_ocr_results_company (company_id),
    INDEX idx_ocr_results_status (company_id, status),
    CONSTRAINT fk_ocr_results_document FOREIGN KEY (document_id)
        REFERENCES documents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN

DROP TABLE IF EXISTS ocr_results;
