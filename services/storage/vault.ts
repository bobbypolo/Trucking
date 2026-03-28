/**
 * Canonical Document Client Service
 *
 * All document operations use the single canonical API at /api/documents.
 * No parallel vault systems — this is the sole client-side document service.
 *
 * Endpoints consumed:
 *   GET    /api/documents              — list with filters
 *   POST   /api/documents              — upload (multipart/form-data)
 *   PATCH  /api/documents/:id          — update status/lock
 *   GET    /api/documents/:id/download — signed download URL
 */
import { VaultDoc, VaultDocType } from "../../types";
import { api } from "../api";

/**
 * Allowed MIME types for document uploads.
 * Must stay in sync with server/schemas/document.schema.ts.
 */
export const ALLOWED_MIME_TYPES: readonly string[] = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/tiff",
] as const;

/**
 * Maximum file size in bytes: 10 MB.
 * Must stay in sync with server/schemas/document.schema.ts.
 */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate file MIME type against allowed types.
 */
export const validateFileType = (file: File): ValidationResult => {
  if (ALLOWED_MIME_TYPES.includes(file.type)) {
    return { valid: true };
  }
  return {
    valid: false,
    error: `File type "${file.type || "unknown"}" is not allowed. Accepted types: PDF, JPEG, PNG, TIFF.`,
  };
};

/**
 * Validate file size against the 10 MB limit.
 */
export const validateFileSize = (file: File): ValidationResult => {
  if (file.size <= MAX_FILE_SIZE_BYTES) {
    return { valid: true };
  }
  const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
  return {
    valid: false,
    error: `File is too large (${sizeMB} MB). Maximum allowed size is 10 MB.`,
  };
};

/**
 * Fetch documents from canonical GET /api/documents with optional filters.
 */
export const getDocuments = async (
  filters: Record<string, string | undefined> = {},
): Promise<VaultDoc[]> => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") {
      params.set(key, value);
    }
  }
  const query = params.toString();
  const url = query ? `/documents?${query}` : "/documents";
  const data = await api.get(url);
  return Array.isArray(data?.documents) ? data.documents : [];
};

/**
 * Fetch all documents for the current tenant (no filters).
 * Backward-compatible alias used by barrel exports.
 */
export const getRawVaultDocs = async (): Promise<VaultDoc[]> => {
  return getDocuments();
};

/**
 * Upload a file via canonical POST /api/documents (multipart/form-data).
 */
export const uploadVaultDoc = async (
  file: File,
  docType: VaultDocType,
  tenantId: string,
  metadata: Record<string, string | number | undefined> = {},
): Promise<VaultDoc> => {
  const form = new FormData();
  form.append("file", file);
  form.append("document_type", docType);
  if (metadata.loadId) form.append("load_id", String(metadata.loadId));
  if (metadata.description)
    form.append("description", String(metadata.description));

  const result = await api.postFormData("/documents", form);

  const doc: VaultDoc = {
    id: result.documentId,
    tenantId,
    type: docType,
    url: result.storagePath ?? "",
    filename: result.sanitizedFilename ?? file.name,
    mimeType: file.type,
    fileSize: file.size,
    status: result.status ?? "Submitted",
    isLocked: false,
    version: 1,
    createdBy: "",
    createdAt: new Date().toISOString(),
    ...(metadata.loadId ? { loadId: String(metadata.loadId) } : {}),
  };

  return doc;
};

/**
 * Update document status and/or lock state via PATCH /api/documents/:id.
 */
export const updateDocumentStatus = async (
  id: string,
  status: string,
  isLocked: boolean,
): Promise<void> => {
  await api.patch(`/documents/${id}`, { status, is_locked: isLocked });
};

/**
 * Get a download URL for a document.
 * Calls GET /api/documents/:id/download.
 */
export const getDocumentDownloadUrl = async (
  documentId: string,
): Promise<string> => {
  const data = await api.get(`/documents/${documentId}/download`);
  return data.url;
};

/**
 * Trigger a file download in the browser.
 */
export const downloadVaultDoc = async (
  documentId: string,
  filename: string,
): Promise<void> => {
  const url = await getDocumentDownloadUrl(documentId);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};
