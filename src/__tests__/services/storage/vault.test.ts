/**
 * Tests for services/storage/vault.ts (updated for API-backed implementation)
 * These tests complement src/__tests__/services/vault.test.ts
 * Verifying no localStorage and multipart POST behavior.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../../../services/authService", () => ({
  getIdTokenAsync: vi.fn().mockResolvedValue("test-token"),
}));

vi.mock("../../../../services/config", () => ({
  API_URL: "http://localhost:3001/api",
}));

import {
  getRawVaultDocs,
  saveVaultDoc,
  uploadVaultDoc,
} from "../../../../services/storage/vault";

import * as vaultExports from "../../../../services/storage/vault";

describe("vault.ts (storage/ path, API-backed)", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("does not export STORAGE_KEY_VAULT_DOCS", () => {
    expect((vaultExports as Record<string, unknown>)["STORAGE_KEY_VAULT_DOCS"]).toBeUndefined();
  });

  it("getRawVaultDocs returns [] on API failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network"));
    const result = await getRawVaultDocs();
    expect(result).toEqual([]);
  });

  it("getRawVaultDocs returns docs on success", async () => {
    const docs = [{ id: "d1", tenantId: "t1", type: "BOL", url: "/up/d1",
      filename: "bol.pdf", status: "Submitted", isLocked: false, version: 1,
      createdBy: "u1", createdAt: "2026-01-01T00:00:00Z" }];
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ documents: docs }) });
    const result = await getRawVaultDocs();
    expect(result).toEqual(docs);
  });

  it("saveVaultDoc returns the doc unchanged without calling fetch", async () => {
    const doc = { id: "d1", tenantId: "t1", type: "BOL" as const,
      url: "/up/d1", filename: "bol.pdf", status: "Submitted" as const,
      isLocked: false, version: 1, createdBy: "u1", createdAt: "2026-01-01T00:00:00Z" };
    const result = await saveVaultDoc(doc);
    expect(result).toEqual(doc);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("uploadVaultDoc calls POST /api/vault-docs with FormData", async () => {
    const file = new File(["pdf"], "bol.pdf", { type: "application/pdf" });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ documentId: "d1", storagePath: "/up/d1", status: "Submitted", sanitizedFilename: "bol.pdf" }),
    });

    const result = await uploadVaultDoc(file, "BOL", "tenant-1");

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("http://localhost:3001/api/vault-docs");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeInstanceOf(FormData);
    expect(result.id).toBe("d1");
    expect(result.type).toBe("BOL");
  });

  it("uploadVaultDoc does not use localStorage", async () => {
    const file = new File(["pdf"], "bol.pdf", { type: "application/pdf" });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ documentId: "d2", storagePath: "", status: "Submitted", sanitizedFilename: "bol.pdf" }),
    });
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    await uploadVaultDoc(file, "BOL", "tenant-1");
    expect(setItemSpy).not.toHaveBeenCalled();
    setItemSpy.mockRestore();
  });
});
