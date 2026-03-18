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
import { API_URL } from "../config";
import { getIdTokenAsync } from "../authService";

/**
 * Fetch all vault documents for the current tenant from the API.
 */
export const getRawVaultDocs = async (): Promise<VaultDoc[]> => {
  try {
    const token = await getIdTokenAsync();
    const res = await fetch(`${API_URL}/vault-docs`, {
      method: "GET",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.documents) ? data.documents : [];
  } catch {
    return [];
  }
};

/**
 * Persist a VaultDoc record.
 * The /api/vault-docs route does not expose a PATCH endpoint yet.
 * This is a client-side stub that returns the doc unchanged; callers
 * should prefer uploadVaultDoc for full persistence.
 */
export const saveVaultDoc = async (doc: VaultDoc): Promise<VaultDoc> => {
  return doc;
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
  const token = await getIdTokenAsync();

  const form = new FormData();
  form.append("file", file);
  form.append("document_type", docType);
  if (metadata.loadId) form.append("load_id", String(metadata.loadId));
  if (metadata.description)
    form.append("description", String(metadata.description));

  const res = await fetch(`${API_URL}/vault-docs`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // NOTE: Do NOT set Content-Type — browser must set boundary for multipart
    },
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: string }).error || `Upload failed: ${res.status}`,
    );
  }

  const result = await res.json();

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
