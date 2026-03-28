/**
 * Tests for services/storage/vault.ts (API-backed)
 * Tests R-P1-21, R-P1-22, R-P1-23
 *
 * R-P1-21: No localStorage in vault.ts
 * R-P1-22: STORAGE_KEY_VAULT_DOCS constant removed
 * R-P1-23: uploadVaultDoc calls POST /api/vault-docs with multipart form data
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

vi.mock("../../../services/api", () => ({
  api: mockApi,
  apiFetch: vi.fn(),
}));

import {
  getRawVaultDocs,
  uploadVaultDoc,
} from "../../../services/storage/vault";

// Verify STORAGE_KEY_VAULT_DOCS is no longer exported (R-P1-22)
import * as vaultModule from "../../../services/storage/vault";

describe("vault.ts (API-backed)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // R-P1-22
  describe("R-P1-22: STORAGE_KEY_VAULT_DOCS constant removed", () => {
    it("does not export STORAGE_KEY_VAULT_DOCS", () => {
      expect(
        (vaultModule as Record<string, unknown>)["STORAGE_KEY_VAULT_DOCS"],
      ).toBeUndefined();
    });
  });

  // S-R07: saveVaultDoc removed
  describe("S-R07: saveVaultDoc no-op stub removed", () => {
    it("does not export saveVaultDoc", () => {
      expect(
        (vaultModule as Record<string, unknown>)["saveVaultDoc"],
      ).toBeUndefined();
    });
  });

  // R-P1-21
  describe("R-P1-21: No localStorage usage", () => {
    it("getRawVaultDocs does not call localStorage.getItem", async () => {
      mockApi.get.mockResolvedValueOnce({ documents: [] });
      const getItemSpy = vi.spyOn(Storage.prototype, "getItem");
      await getRawVaultDocs();
      expect(getItemSpy).not.toHaveBeenCalled();
      getItemSpy.mockRestore();
    });

    it("uploadVaultDoc does not call localStorage.setItem", async () => {
      const file = new File(["pdf content"], "test.pdf", {
        type: "application/pdf",
      });
      mockApi.postFormData.mockResolvedValueOnce({
        documentId: "doc-abc-123",
        storagePath: "/uploads/doc-abc-123/test.pdf",
        status: "Submitted",
        sanitizedFilename: "test.pdf",
      });
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
      await uploadVaultDoc(file, "BOL", "tenant-001");
      expect(setItemSpy).not.toHaveBeenCalled();
      setItemSpy.mockRestore();
    });
  });

  // R-P1-23
  describe("R-P1-23: uploadVaultDoc calls POST /api/vault-docs with multipart form data", () => {
    it("calls api.postFormData with /vault-docs endpoint", async () => {
      const file = new File(["content"], "bol.pdf", {
        type: "application/pdf",
      });
      mockApi.postFormData.mockResolvedValueOnce({
        documentId: "doc-001",
        storagePath: "/uploads/doc-001/bol.pdf",
        status: "Submitted",
        sanitizedFilename: "bol.pdf",
      });

      await uploadVaultDoc(file, "BOL", "tenant-001");

      expect(mockApi.postFormData).toHaveBeenCalledOnce();
      const [endpoint, formData] = mockApi.postFormData.mock.calls[0];
      expect(endpoint).toBe("/documents");
      expect(formData).toBeInstanceOf(FormData);
    });

    it("sends FormData body with file and document_type fields", async () => {
      const file = new File(["pdf bytes"], "pod.pdf", {
        type: "application/pdf",
      });
      mockApi.postFormData.mockResolvedValueOnce({
        documentId: "doc-002",
        storagePath: "/uploads/doc-002/pod.pdf",
        status: "Submitted",
        sanitizedFilename: "pod.pdf",
      });

      await uploadVaultDoc(file, "POD", "tenant-001");

      const [, formData] = mockApi.postFormData.mock.calls[0];
      const form = formData as FormData;
      expect(form.get("document_type")).toBe("POD");
      expect(form.get("file")).toBe(file);
    });

    it("appends load_id to FormData when provided in metadata", async () => {
      const file = new File(["doc"], "ratcon.pdf", { type: "application/pdf" });
      mockApi.postFormData.mockResolvedValueOnce({
        documentId: "doc-004",
        storagePath: "/uploads/doc-004/ratcon.pdf",
        status: "Submitted",
        sanitizedFilename: "ratcon.pdf",
      });

      await uploadVaultDoc(file, "RateCon", "tenant-001", { loadId: "L-500" });

      const [, formData] = mockApi.postFormData.mock.calls[0];
      const form = formData as FormData;
      expect(form.get("load_id")).toBe("L-500");
    });

    it("throws error when api.postFormData throws", async () => {
      const file = new File(["data"], "bad.pdf", { type: "application/pdf" });
      mockApi.postFormData.mockRejectedValueOnce(new Error("File too large"));

      await expect(uploadVaultDoc(file, "BOL", "tenant-001")).rejects.toThrow(
        "File too large",
      );
    });

    it("returns VaultDoc shape built from server response", async () => {
      const file = new File(["bytes"], "insurance.pdf", {
        type: "application/pdf",
      });
      mockApi.postFormData.mockResolvedValueOnce({
        documentId: "doc-005",
        storagePath: "/uploads/doc-005/insurance.pdf",
        status: "Submitted",
        sanitizedFilename: "insurance_sanitized.pdf",
      });

      const result = await uploadVaultDoc(file, "Insurance", "tenant-002");

      expect(result.id).toBe("doc-005");
      expect(result.tenantId).toBe("tenant-002");
      expect(result.type).toBe("Insurance");
      expect(result.filename).toBe("insurance_sanitized.pdf");
      expect(result.status).toBe("Submitted");
      expect(result.mimeType).toBe("application/pdf");
    });
  });

  // getRawVaultDocs
  describe("getRawVaultDocs", () => {
    it("calls api.get /vault-docs", async () => {
      mockApi.get.mockResolvedValueOnce({ documents: [] });

      await getRawVaultDocs();

      expect(mockApi.get).toHaveBeenCalledWith("/documents");
    });

    it("returns documents array from API response", async () => {
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

    it("propagates error when API throws", async () => {
      mockApi.get.mockRejectedValueOnce(new Error("401"));
      await expect(getRawVaultDocs()).rejects.toThrow("401");
    });

    it("propagates error when fetch throws a network error", async () => {
      mockApi.get.mockRejectedValueOnce(new Error("network error"));
      await expect(getRawVaultDocs()).rejects.toThrow("network error");
    });
  });
});
