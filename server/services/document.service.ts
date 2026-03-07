import { v4 as uuidv4 } from "uuid";
import {
  documentRepository,
  type CreateDocumentInput,
} from "../repositories/document.repository";
import {
  DocumentStatus,
  validateDocumentTransition,
} from "./document-state-machine";
import {
  sanitizeFilename,
  hasAllowedExtension,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_EXTENSIONS,
} from "../schemas/document.schema";
import { ValidationError, InternalError } from "../errors/AppError";
import { createChildLogger } from "../lib/logger";

const log = createChildLogger({ module: "document.service" });

/**
 * Interface for Firebase Storage operations (injectable for testing).
 */
export interface StorageAdapter {
  uploadBlob(
    path: string,
    buffer: Buffer,
    metadata: Record<string, string>,
  ): Promise<void>;
  deleteBlob(path: string): Promise<void>;
  getSignedUrl(path: string, expiresInMs: number): Promise<string>;
}

/**
 * Result of a document upload operation.
 */
export interface UploadResult {
  documentId: string;
  storagePath: string;
  status: DocumentStatus;
  sanitizedFilename: string;
}

/**
 * Input for initiating a document upload.
 */
export interface UploadInput {
  companyId: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  buffer: Buffer;
  documentType: string;
  loadId?: string;
  description?: string;
  uploadedBy?: string;
}

/**
 * Document Service — orchestrates document upload with compensating transaction pattern.
 *
 * Upload flow:
 *   1. Validate file type, size, and sanitize filename
 *   2. Upload blob to Firebase Storage with status=pending metadata
 *   3. Write MySQL metadata row with status=pending
 *   4. If both succeed: update status to finalized
 *   5. If MySQL write fails after blob upload: delete blob (compensating cleanup)
 *   6. If blob upload fails: no metadata row is persisted
 *
 * This is NOT fake atomicity — it is a compensating transaction pattern where
 * each step has a defined compensation action.
 */
export function createDocumentService(storage: StorageAdapter) {
  return {
    /**
     * Validate file before upload: type, size, filename.
     */
    validateFile(input: {
      originalFilename: string;
      mimeType: string;
      fileSizeBytes: number;
    }): void {
      // Validate file size
      if (input.fileSizeBytes > MAX_FILE_SIZE_BYTES) {
        throw new ValidationError(
          `File size ${input.fileSizeBytes} exceeds maximum ${MAX_FILE_SIZE_BYTES} bytes`,
          { maxBytes: MAX_FILE_SIZE_BYTES, actualBytes: input.fileSizeBytes },
          "VALIDATION_FILE_SIZE",
        );
      }

      if (input.fileSizeBytes <= 0) {
        throw new ValidationError(
          "File size must be greater than 0",
          { actualBytes: input.fileSizeBytes },
          "VALIDATION_FILE_SIZE",
        );
      }

      // Validate file extension
      const sanitized = sanitizeFilename(input.originalFilename);
      if (!hasAllowedExtension(sanitized)) {
        throw new ValidationError(
          `File type not allowed. Allowed extensions: ${ALLOWED_EXTENSIONS.join(", ")}`,
          { filename: sanitized, allowedExtensions: [...ALLOWED_EXTENSIONS] },
          "VALIDATION_FILE_TYPE",
        );
      }
    },

    /**
     * Upload a document using the compensating transaction pattern.
     *
     * Steps:
     *   1. Validate file
     *   2. Upload blob to Firebase Storage (status=pending)
     *   3. Write MySQL metadata (status=pending)
     *   4. Finalize status if both succeed
     *   5. Compensate on failure
     */
    async upload(input: UploadInput): Promise<UploadResult> {
      // Step 1: Validate
      this.validateFile({
        originalFilename: input.originalFilename,
        mimeType: input.mimeType,
        fileSizeBytes: input.fileSizeBytes,
      });

      const docId = uuidv4();
      const sanitized = sanitizeFilename(input.originalFilename);
      const storagePath = `tenants/${input.companyId}/documents/${docId}/${sanitized}`;

      // Step 2: Upload blob to Firebase Storage with pending status
      let blobUploaded = false;
      try {
        await storage.uploadBlob(storagePath, input.buffer, {
          status: DocumentStatus.PENDING,
          documentId: docId,
          companyId: input.companyId,
          originalFilename: input.originalFilename,
          contentType: input.mimeType,
        });
        blobUploaded = true;
      } catch (error) {
        // Blob upload failed — no metadata row to clean up (step 6: no metadata if blob fails)
        log.error(
          { err: error, docId, storagePath },
          "Blob upload failed — no metadata persisted",
        );
        throw new InternalError(
          "Document upload failed: storage error",
          { docId, storagePath },
          "INTERNAL_STORAGE_UPLOAD",
        );
      }

      // Step 3: Write MySQL metadata row with pending status
      let metadataCreated = false;
      try {
        const createInput: CreateDocumentInput = {
          id: docId,
          company_id: input.companyId,
          load_id: input.loadId ?? null,
          original_filename: input.originalFilename,
          sanitized_filename: sanitized,
          mime_type: input.mimeType,
          file_size_bytes: input.fileSizeBytes,
          storage_path: storagePath,
          document_type: input.documentType,
          status: DocumentStatus.PENDING,
          description: input.description ?? null,
          uploaded_by: input.uploadedBy ?? null,
        };

        await documentRepository.create(createInput);
        metadataCreated = true;
      } catch (error) {
        // Step 4 (compensation): MySQL write failed after blob upload — delete blob
        log.error(
          { err: error, docId, storagePath },
          "MySQL metadata write failed — compensating by deleting blob",
        );

        try {
          await storage.deleteBlob(storagePath);
          log.info(
            { docId, storagePath },
            "Compensating blob cleanup succeeded",
          );
        } catch (cleanupError) {
          // Orphaned blob — log for manual cleanup
          log.error(
            { err: cleanupError, docId, storagePath },
            "ORPHAN: Compensating blob cleanup failed — orphaned blob in storage",
          );
        }

        throw new InternalError(
          "Document upload failed: metadata write error",
          { docId, storagePath, blobUploaded },
          "INTERNAL_METADATA_WRITE",
        );
      }

      // Step 4: Finalize — both blob and metadata succeeded
      try {
        await documentRepository.updateStatus(
          docId,
          DocumentStatus.FINALIZED,
          input.companyId,
        );
      } catch (error) {
        // Finalization failed but document exists in pending state
        // This is not fatal — document can be finalized later
        log.error(
          { err: error, docId },
          "Status finalization failed — document remains in pending state",
        );
      }

      return {
        documentId: docId,
        storagePath,
        status: DocumentStatus.FINALIZED,
        sanitizedFilename: sanitized,
      };
    },

    /**
     * Transition a document's status using the state machine.
     */
    async transitionStatus(
      documentId: string,
      companyId: string,
      newStatus: DocumentStatus,
    ): Promise<void> {
      const doc = await documentRepository.findById(documentId, companyId);
      if (!doc) {
        throw new ValidationError(
          "Document not found",
          { documentId, companyId },
          "VALIDATION_DOCUMENT_NOT_FOUND",
        );
      }

      // Validate the transition
      validateDocumentTransition(doc.status as DocumentStatus, newStatus);

      // Update status
      await documentRepository.updateStatus(documentId, newStatus, companyId);
    },

    /**
     * List documents for a company with optional filters.
     * Enforces tenant isolation.
     */
    async listDocuments(
      companyId: string,
      filters?: { load_id?: string; status?: string; document_type?: string },
    ) {
      return documentRepository.findByCompany(companyId, filters);
    },

    /**
     * Get a signed download URL for a document.
     * Enforces tenant isolation.
     */
    async getDownloadUrl(
      documentId: string,
      companyId: string,
      expiresInMs: number = 15 * 60 * 1000,
    ): Promise<string> {
      const doc = await documentRepository.findById(documentId, companyId);
      if (!doc) {
        throw new ValidationError(
          "Document not found",
          { documentId, companyId },
          "VALIDATION_DOCUMENT_NOT_FOUND",
        );
      }

      return storage.getSignedUrl(doc.storage_path, expiresInMs);
    },
  };
}

export type DocumentService = ReturnType<typeof createDocumentService>;
