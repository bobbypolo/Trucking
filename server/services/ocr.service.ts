/**
 * OCR Service for LoadPilot
 *
 * Processes document images/PDFs through an OCR adapter (e.g., Google Gemini AI)
 * and stores extraction results with per-field confidence scoring.
 *
 * Key design decisions:
 * - OCR results are NEVER auto-applied to load fields
 * - Results are stored with status 'review_required' (shared vocabulary with document state machine)
 * - 30-second timeout on OCR processing with graceful degradation
 * - Document transitions: finalized -> processing -> review_required
 *
 * @see .claude/docs/PLAN.md R-P3-04
 */

import { v4 as uuidv4 } from "uuid";
import { documentRepository } from "../repositories/document.repository";
import { ocrRepository } from "../repositories/ocr.repository";
import { DocumentStatus } from "./document-state-machine";
import { ValidationError } from "../errors/AppError";
import { createChildLogger } from "../lib/logger";

const log = createChildLogger({ module: "ocr.service" });

/**
 * Timeout for OCR processing: 30 seconds.
 */
export const OCR_TIMEOUT_MS = 30000;

/**
 * A single extracted field with confidence score.
 */
export interface OcrFieldResult {
  field_name: string;
  extracted_value: string;
  confidence: number;
}

/**
 * Raw output from the OCR adapter.
 */
export interface OcrExtractionOutput {
  fields: OcrFieldResult[];
  raw_text: string;
}

/**
 * Injectable OCR adapter interface.
 * Allows swapping between Gemini AI, Tesseract, or test mocks.
 */
export interface OcrAdapter {
  extractFields(
    storagePath: string,
    documentType: string,
    signal?: AbortSignal,
  ): Promise<OcrExtractionOutput>;
}

/**
 * Error information for degraded OCR responses.
 */
export interface OcrErrorInfo {
  reason: "timeout" | "ocr_failed";
  message: string;
}

/**
 * Result of OCR processing.
 * When status is 'review_required', fields contain suggestions for human review.
 * When status is 'error', fields are empty and error contains failure details.
 */
export interface OcrProcessResult {
  ocr_result_id: string;
  document_id: string;
  status: "review_required" | "error";
  fields: OcrFieldResult[];
  raw_text: string;
  error?: OcrErrorInfo;
  processing_duration_ms: number;
}

/**
 * Retrieved OCR result with parsed fields.
 */
export interface OcrResultView {
  id: string;
  document_id: string;
  company_id: string;
  status: string;
  fields: OcrFieldResult[];
  raw_text: string | null;
  error_reason: string | null;
  processing_duration_ms: number | null;
}

/**
 * Creates an OCR service with the given OCR adapter.
 *
 * The service orchestrates:
 *   1. Document validation (must be finalized)
 *   2. Status transition: finalized -> processing
 *   3. OCR extraction via adapter with 30s timeout
 *   4. Store results with confidence scores
 *   5. Status transition: processing -> review_required
 *
 * OCR results are NEVER auto-applied to load fields.
 * They are stored as suggestions requiring explicit human review.
 */
export function createOcrService(adapter: OcrAdapter) {
  return {
    /**
     * Process a document through OCR extraction.
     *
     * Flow:
     *   1. Validate document exists and is in 'finalized' state
     *   2. Transition document to 'processing'
     *   3. Run OCR with 30s timeout
     *   4. On success: store results, transition to 'review_required'
     *   5. On failure: return degraded response with error details
     *
     * NEVER auto-applies results to load fields.
     */
    async processDocument(
      documentId: string,
      companyId: string,
    ): Promise<OcrProcessResult> {
      const startTime = Date.now();

      // Step 1: Find and validate document
      const doc = await documentRepository.findById(documentId, companyId);
      if (!doc) {
        throw new ValidationError(
          "Document not found",
          { documentId, companyId },
          "VALIDATION_DOCUMENT_NOT_FOUND",
        );
      }

      // Only finalized documents can be processed
      if (doc.status !== DocumentStatus.FINALIZED) {
        throw new ValidationError(
          `Document must be in '${DocumentStatus.FINALIZED}' state to process OCR, current state: '${doc.status}'`,
          {
            documentId,
            currentStatus: doc.status,
            requiredStatus: DocumentStatus.FINALIZED,
          },
          "VALIDATION_DOCUMENT_NOT_FINALIZED",
        );
      }

      // Step 2: Transition to processing
      await documentRepository.updateStatus(
        documentId,
        DocumentStatus.PROCESSING,
        companyId,
      );

      log.info(
        { documentId, companyId },
        "Document transitioned to processing for OCR",
      );

      // Step 3: Run OCR with 30s timeout
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);

        let extraction: OcrExtractionOutput;
        try {
          extraction = await adapter.extractFields(
            doc.storage_path,
            doc.document_type,
            controller.signal,
          );
        } finally {
          clearTimeout(timeoutId);
        }

        const durationMs = Date.now() - startTime;
        const ocrId = uuidv4();

        // Step 4: Store OCR results with review_required status
        await ocrRepository.create({
          id: ocrId,
          document_id: documentId,
          company_id: companyId,
          status: "review_required",
          fields: extraction.fields,
          raw_text: extraction.raw_text,
          processing_duration_ms: durationMs,
        });

        // Step 5: Transition document to review_required
        await documentRepository.updateStatus(
          documentId,
          DocumentStatus.REVIEW_REQUIRED,
          companyId,
        );

        log.info(
          {
            documentId,
            companyId,
            ocrId,
            fieldCount: extraction.fields.length,
            durationMs,
          },
          "OCR processing completed — results stored as review_required",
        );

        return {
          ocr_result_id: ocrId,
          document_id: documentId,
          status: "review_required",
          fields: extraction.fields,
          raw_text: extraction.raw_text,
          processing_duration_ms: durationMs,
        };
      } catch (err: unknown) {
        const durationMs = Date.now() - startTime;

        // Detect timeout
        const isTimeout =
          err instanceof DOMException &&
          (err.name === "AbortError" || err.name === "TimeoutError");

        const reason = isTimeout ? "timeout" : "ocr_failed";
        const errorMessage = err instanceof Error ? err.message : String(err);

        if (isTimeout) {
          log.warn(
            {
              documentId,
              companyId,
              durationMs,
              timeoutMs: OCR_TIMEOUT_MS,
            },
            "OCR processing timed out",
          );
        } else {
          log.error(
            {
              documentId,
              companyId,
              durationMs,
              error: errorMessage,
            },
            "OCR processing failed",
          );
        }

        // Store the error result
        const ocrId = uuidv4();
        try {
          await ocrRepository.create({
            id: ocrId,
            document_id: documentId,
            company_id: companyId,
            status: "error",
            fields: [],
            error_reason: reason,
            processing_duration_ms: durationMs,
          });
        } catch (storeErr) {
          log.error(
            { documentId, err: storeErr },
            "Failed to store OCR error result",
          );
        }

        // Return degraded response (not 500)
        return {
          ocr_result_id: ocrId,
          document_id: documentId,
          status: "error",
          fields: [],
          raw_text: "",
          error: {
            reason,
            message: isTimeout
              ? `OCR processing timed out after ${OCR_TIMEOUT_MS}ms`
              : `OCR processing failed: ${errorMessage}`,
          },
          processing_duration_ms: durationMs,
        };
      }
    },

    /**
     * Retrieve the OCR result for a document.
     * Returns null if no OCR result exists.
     * Fields are parsed from JSON storage.
     */
    async getOcrResult(
      documentId: string,
      companyId: string,
    ): Promise<OcrResultView | null> {
      const row = await ocrRepository.findByDocumentId(documentId, companyId);
      if (!row) {
        return null;
      }

      // Parse fields from JSON string
      let fields: OcrFieldResult[];
      try {
        fields =
          typeof row.fields === "string" ? JSON.parse(row.fields) : row.fields;
      } catch {
        fields = [];
      }

      return {
        id: row.id,
        document_id: row.document_id,
        company_id: row.company_id,
        status: row.status,
        fields,
        raw_text: row.raw_text,
        error_reason: row.error_reason,
        processing_duration_ms: row.processing_duration_ms,
      };
    },
  };
}

export type OcrService = ReturnType<typeof createOcrService>;
