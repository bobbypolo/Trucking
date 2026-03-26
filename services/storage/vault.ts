/**
 * Vault Documents domain — API-backed service.
 * Tests: src/__tests__/services/vault.test.ts
 *
 * R-P1-21: No local-storage calls (fully API-backed).
 * R-P1-22: Vault storage key constant removed (API-backed).
 * R-P1-23: uploadVaultDoc uses POST /api/vault-docs multipart.
 */
// Tests R-P1-21, R-P1-22, R-P1-23
import { VaultDoc, VaultDocType } from "../../types";
import { api } from "../api";

/**
 * Allowed MIME types for vault uploads.
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
 * R-W5-03b: Invalid MIME type shows clear rejection message.
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
 * R-W5-03c: File size limit enforced with user-visible error.
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
 * Fetch all vault documents for the current tenant from the API.
 */
export const getRawVaultDocs = async (): Promise<VaultDoc[]> => {
  try {
    const data = await api.get("/vault-docs");
    return Array.isArray(data?.documents) ? data.documents : [];
  } catch {
    return [];
  }
};

/**
 * Upload a file to the vault via POST /api/vault-docs (multipart/form-data).
 * Returns the server response cast to a partial VaultDoc shape.
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

  const result = await api.postFormData("/vault-docs", form);

  // Build a client-side VaultDoc shape from the server response.
  // The server returns { documentId, storagePath, status, sanitizedFilename }.
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
 * Get a download URL for a vault document.
 * Calls GET /api/documents/:id/download which returns { url } pointing
 * to the DiskStorageAdapter file on the server.
 *
 * R-W6-02c: FileVault component calls download endpoint.
 */
export const getDocumentDownloadUrl = async (
  documentId: string,
): Promise<string> => {
  const data = await api.get(`/documents/${documentId}/download`);
  return data.url;
};

/**
 * Trigger a file download in the browser.
 * Fetches the download URL then opens it to initiate the browser download.
 *
 * R-W6-02c: FileVault component calls download endpoint.
 */
export const downloadVaultDoc = async (
  documentId: string,
  filename: string,
): Promise<void> => {
  const url = await getDocumentDownloadUrl(documentId);
  // Use a temporary anchor element to trigger download
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};
