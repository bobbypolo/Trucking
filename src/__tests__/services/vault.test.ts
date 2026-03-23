/**
 * Tests for services/storage/vault.ts (API-backed)
 * Tests R-P1-21, R-P1-22, R-P1-23
 *
 * R-P1-21: No localStorage in vault.ts
 * R-P1-22: STORAGE_KEY_VAULT_DOCS constant removed
 * R-P1-23: uploadVaultDoc calls POST /api/vault-docs with multipart form data
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock authService to provide a token
vi.mock("../../../services/authService", () => ({
  getIdTokenAsync: vi.fn().mockResolvedValue("test-auth-token"),
}));

// Mock config to give a stable API URL
vi.mock("../../../services/config", () => ({
  API_URL: "http://localhost:3001/api",
}));

import { getIdTokenAsync } from "../../../services/authService";
const mockGetIdToken = getIdTokenAsync as ReturnType<typeof vi.fn>;

import {
  getRawVaultDocs,
  saveVaultDoc,
  uploadVaultDoc,
} from "../../../services/storage/vault";

// Verify STORAGE_KEY_VAULT_DOCS is no longer exported (R-P1-22)
import * as vaultModule from "../../../services/storage/vault";

describe("vault.ts (API-backed)", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
    mockGetIdToken.mockResolvedValue("test-auth-token");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  // R-P1-22
  describe("R-P1-22: STORAGE_KEY_VAULT_DOCS constant removed", () => {
    it("does not export STORAGE_KEY_VAULT_DOCS", () => {
      expect((vaultModule as Record<string, unknown>)["STORAGE_KEY_VAULT_DOCS"]).toBeUndefined();
    });
  });

  // R-P1-21
  describe("R-P1-21: No localStorage usage", () => {
    it("getRawVaultDocs does not call localStorage.getItem", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ documents: [] }),
      });
      const getItemSpy = vi.spyOn(Storage.prototype, "getItem");
      await getRawVaultDocs();
      expect(getItemSpy).not.toHaveBeenCalled();
      getItemSpy.mockRestore();
    });

    it("uploadVaultDoc does not call localStorage.setItem", async () => {
      const file = new File(["pdf content"], "test.pdf", { type: "application/pdf" });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          documentId: "doc-abc-123",
          storagePath: "/uploads/doc-abc-123/test.pdf",
          status: "Submitted",
          sanitizedFilename: "test.pdf",
        }),
      });
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
      await uploadVaultDoc(file, "BOL", "tenant-001");
      expect(setItemSpy).not.toHaveBeenCalled();
      setItemSpy.mockRestore();
    });
  });

  // R-P1-23
  describe("R-P1-23: uploadVaultDoc calls POST /api/vault-docs with multipart form data", () => {
    it("calls fetch with POST method to /api/vault-docs", async () => {
      const file = new File(["content"], "bol.pdf", { type: "application/pdf" });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          documentId: "doc-001",
          storagePath: "/uploads/doc-001/bol.pdf",
          status: "Submitted",
          sanitizedFilename: "bol.pdf",
        }),
      });

      await uploadVaultDoc(file, "BOL", "tenant-001");

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe("http://localhost:3001/api/vault-docs");
      expect(opts.method).toBe("POST");
    });

    it("sends FormData body with file and document_type fields", async () => {
      const file = new File(["pdf bytes"], "pod.pdf", { type: "application/pdf" });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          documentId: "doc-002",
          storagePath: "/uploads/doc-002/pod.pdf",
          status: "Submitted",
          sanitizedFilename: "pod.pdf",
        }),
      });

      await uploadVaultDoc(file, "POD", "tenant-001");

      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.body).toBeInstanceOf(FormData);
      const form = opts.body as FormData;
      expect(form.get("document_type")).toBe("POD");
      expect(form.get("file")).toBe(file);
    });

    it("includes Authorization header with Bearer token", async () => {
      const file = new File(["data"], "fuel.pdf", { type: "application/pdf" });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          documentId: "doc-003",
          storagePath: "/uploads/doc-003/fuel.pdf",
          status: "Submitted",
          sanitizedFilename: "fuel.pdf",
        }),
      });

      await uploadVaultDoc(file, "Fuel", "tenant-abc");

      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.headers?.Authorization).toBe("Bearer test-auth-token");
    });

    it("appends load_id to FormData when provided in metadata", async () => {
      const file = new File(["doc"], "ratcon.pdf", { type: "application/pdf" });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          documentId: "doc-004",
          storagePath: "/uploads/doc-004/ratcon.pdf",
          status: "Submitted",
          sanitizedFilename: "ratcon.pdf",
        }),
      });

      await uploadVaultDoc(file, "RateCon", "tenant-001", { loadId: "L-500" });

      const [, opts] = mockFetch.mock.calls[0];
      const form = opts.body as FormData;
      expect(form.get("load_id")).toBe("L-500");
    });

    it("throws error when server returns non-ok status", async () => {
      const file = new File(["data"], "bad.pdf", { type: "application/pdf" });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 413,
        json: async () => ({ error: "File too large" }),
      });

      await expect(uploadVaultDoc(file, "BOL", "tenant-001")).rejects.toThrow("File too large");
    });

    it("throws generic error when server returns non-ok with no error body", async () => {
      const file = new File(["data"], "err.pdf", { type: "application/pdf" });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => { throw new Error("not json"); },
      });

      await expect(uploadVaultDoc(file, "BOL", "tenant-001")).rejects.toThrow("Upload failed: 500");
    });

    it("returns VaultDoc shape built from server response", async () => {
      const file = new File(["bytes"], "insurance.pdf", { type: "application/pdf" });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          documentId: "doc-005",
          storagePath: "/uploads/doc-005/insurance.pdf",
          status: "Submitted",
          sanitizedFilename: "insurance_sanitized.pdf",
        }),
      });

      const result = await uploadVaultDoc(file, "Insurance", "tenant-002");

      expect(result.id).toBe("doc-005");
      expect(result.tenantId).toBe("tenant-002");
      expect(result.type).toBe("Insurance");
      expect(result.filename).toBe("insurance_sanitized.pdf");
      expect(result.status).toBe("Submitted");
      expect(result.mimeType).toBe("application/pdf");
    });

    it("does not send Content-Type header (lets browser set multipart boundary)", async () => {
      const file = new File(["x"], "x.pdf", { type: "application/pdf" });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          documentId: "doc-ct",
          storagePath: "",
          status: "Submitted",
          sanitizedFilename: "x.pdf",
        }),
      });

      await uploadVaultDoc(file, "Other", "tenant-001");

      const [, opts] = mockFetch.mock.calls[0];
      const ct = (opts.headers as Record<string, string> | undefined)?.["Content-Type"]
        ?? (opts.headers as Record<string, string> | undefined)?.["content-type"];
      expect(ct).toBeUndefined();
    });
  });

  // getRawVaultDocs
  describe("getRawVaultDocs", () => {
    it("calls GET /api/vault-docs", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ documents: [] }),
      });

      await getRawVaultDocs();

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe("http://localhost:3001/api/vault-docs");
      expect(opts.method).toBe("GET");
    });

    it("returns documents array from API response", async () => {
      const docs = [{ id: "d1", tenantId: "t1", type: "BOL", url: "/up/d1", filename: "bol.pdf",
        status: "Submitted", isLocked: false, version: 1, createdBy: "u1", createdAt: "2026-01-01T00:00:00Z" }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ documents: docs }),
      });

      const result = await getRawVaultDocs();
      expect(result).toEqual(docs);
    });

    it("returns empty array when API returns non-ok status", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
      const result = await getRawVaultDocs();
      expect(result).toEqual([]);
    });

    it("returns empty array when fetch throws a network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("network error"));
      const result = await getRawVaultDocs();
      expect(result).toEqual([]);
    });

    it("includes Authorization header in GET request", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ documents: [] }),
      });

      await getRawVaultDocs();

      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.headers?.Authorization).toBe("Bearer test-auth-token");
    });
  });

  // saveVaultDoc
  describe("saveVaultDoc", () => {
    it("returns the passed doc unchanged", async () => {
      const doc = { id: "d1", tenantId: "t1", type: "BOL" as const, url: "/up/d1",
        filename: "bol.pdf", status: "Submitted" as const, isLocked: false, version: 1,
        createdBy: "u1", createdAt: "2026-01-01T00:00:00Z" };
      const result = await saveVaultDoc(doc);
      expect(result).toEqual(doc);
    });

    it("does not call fetch", async () => {
      const doc = { id: "d2", tenantId: "t1", type: "POD" as const, url: "/up/d2",
        filename: "pod.pdf", status: "Approved" as const, isLocked: false, version: 1,
        createdBy: "u1", createdAt: "2026-01-01T00:00:00Z" };
      await saveVaultDoc(doc);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
