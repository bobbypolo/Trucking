/**
 * Tests for services/storage/vault.ts (updated for API-backed implementation)
 * These tests complement src/__tests__/services/vault.test.ts
 * Verifying no localStorage and multipart POST behavior via api client.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    postFormData: vi.fn(),
  },
}));

vi.mock("../../../../services/api", () => ({
  api: mockApi,
  apiFetch: vi.fn(),
}));

import {
  getRawVaultDocs,
  uploadVaultDoc,
} from "../../../../services/storage/vault";

import * as vaultExports from "../../../../services/storage/vault";

describe("vault.ts (storage/ path, API-backed)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not export STORAGE_KEY_VAULT_DOCS", () => {
    expect(
      (vaultExports as Record<string, unknown>)["STORAGE_KEY_VAULT_DOCS"],
    ).toBeUndefined();
  });

  it("does not export saveVaultDoc (removed no-op stub)", () => {
    expect(
      (vaultExports as Record<string, unknown>)["saveVaultDoc"],
    ).toBeUndefined();
  });

  it("getRawVaultDocs propagates error on API failure", async () => {
    mockApi.get.mockRejectedValueOnce(new Error("network"));
    await expect(getRawVaultDocs()).rejects.toThrow("network");
  });

  it("getRawVaultDocs returns docs on success", async () => {
    const docs = [
      {
        id: "d1",
        tenantId: "t1",
        type: "BOL",
        url: "/up/d1",
        filename: "bol.pdf",
        status: "Submitted",
        isLocked: false,
        version: 1,
        createdBy: "u1",
        createdAt: "2026-01-01T00:00:00Z",
      },
    ];
    mockApi.get.mockResolvedValueOnce({ documents: docs });
    const result = await getRawVaultDocs();
    expect(result).toEqual(docs);
  });

  it("uploadVaultDoc calls api.postFormData /vault-docs with FormData", async () => {
    const file = new File(["pdf"], "bol.pdf", { type: "application/pdf" });
    mockApi.postFormData.mockResolvedValueOnce({
      documentId: "d1",
      storagePath: "/up/d1",
      status: "Submitted",
      sanitizedFilename: "bol.pdf",
    });

    const result = await uploadVaultDoc(file, "BOL", "tenant-1");

    expect(mockApi.postFormData).toHaveBeenCalledOnce();
    const [endpoint, formData] = mockApi.postFormData.mock.calls[0];
    expect(endpoint).toBe("/documents");
    expect(formData).toBeInstanceOf(FormData);
    expect(result.id).toBe("d1");
    expect(result.type).toBe("BOL");
  });

  it("uploadVaultDoc does not use localStorage", async () => {
    const file = new File(["pdf"], "bol.pdf", { type: "application/pdf" });
    mockApi.postFormData.mockResolvedValueOnce({
      documentId: "d2",
      storagePath: "",
      status: "Submitted",
      sanitizedFilename: "bol.pdf",
    });
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    await uploadVaultDoc(file, "BOL", "tenant-1");
    expect(setItemSpy).not.toHaveBeenCalled();
    setItemSpy.mockRestore();
  });
});
