/**
 * Tests for services/storage/vault.ts
 * Vault Documents domain -- localStorage CRUD + Firebase Storage upload.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../../../services/authService", () => ({
  getCurrentUser: vi.fn().mockReturnValue({ companyId: "test-co" }),
  getAuthHeaders: vi.fn().mockResolvedValue({}),
}));

import { getCurrentUser } from "../../../../services/authService";
const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;

const mockUploadBytes = vi.fn().mockResolvedValue({});
const mockGetDownloadURL = vi
  .fn()
  .mockResolvedValue("https://storage.example.com/doc.pdf");
const mockRef = vi.fn().mockReturnValue({});

vi.mock("firebase/storage", () => ({
  ref: (...args: any[]) => mockRef(...args),
  uploadBytes: (...args: any[]) => mockUploadBytes(...args),
  getDownloadURL: (...args: any[]) => mockGetDownloadURL(...args),
}));

vi.mock("../../../../services/firebase", () => ({
  storage: {},
}));

vi.mock("uuid", () => ({
  v4: vi.fn().mockReturnValue("mock-uuid-1234"),
}));

import {
  STORAGE_KEY_VAULT_DOCS,
  getRawVaultDocs,
  saveVaultDoc,
  uploadVaultDoc,
} from "../../../../services/storage/vault";

describe("vault.ts", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe("STORAGE_KEY_VAULT_DOCS", () => {
    it("returns tenant-scoped key", () => {
      const key = STORAGE_KEY_VAULT_DOCS();
      expect(key).toContain("test-co");
      expect(key).toContain("vault_docs_v1");
    });
  });

  describe("getRawVaultDocs", () => {
    it("returns empty array when no data exists", () => {
      expect(getRawVaultDocs()).toEqual([]);
    });

    it("returns parsed docs from localStorage", () => {
      const docs = [
        {
          id: "doc-1",
          tenantId: "test-co",
          type: "BOL",
          url: "https://example.com/doc.pdf",
          filename: "bol.pdf",
          status: "Submitted",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ];
      localStorage.setItem(STORAGE_KEY_VAULT_DOCS(), JSON.stringify(docs));

      const result = getRawVaultDocs();
      expect(result).toEqual(docs);
    });

    it("returns empty array on parse error", () => {
      localStorage.setItem(STORAGE_KEY_VAULT_DOCS(), "bad-json{{");
      expect(getRawVaultDocs()).toEqual([]);
    });
  });

  describe("saveVaultDoc", () => {
    it("adds new doc to beginning of list", async () => {
      const existingDoc = {
        id: "doc-1",
        tenantId: "test-co",
        type: "BOL" as const,
        url: "https://example.com/existing.pdf",
        filename: "existing.pdf",
        status: "Submitted" as const,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      };
      localStorage.setItem(
        STORAGE_KEY_VAULT_DOCS(),
        JSON.stringify([existingDoc]),
      );

      const newDoc = {
        id: "doc-2",
        tenantId: "test-co",
        type: "POD" as const,
        url: "https://example.com/new.pdf",
        filename: "new.pdf",
        status: "Submitted" as const,
        createdAt: "2026-01-02T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
      };

      await saveVaultDoc(newDoc);

      const stored = getRawVaultDocs();
      expect(stored).toHaveLength(2);
      expect(stored[0].id).toBe("doc-2"); // new doc at front
      expect(stored[1].id).toBe("doc-1"); // existing doc at back
    });

    it("updates existing doc in-place", async () => {
      const doc = {
        id: "doc-1",
        tenantId: "test-co",
        type: "BOL" as const,
        url: "https://example.com/doc.pdf",
        filename: "doc.pdf",
        status: "Submitted" as const,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      };
      localStorage.setItem(
        STORAGE_KEY_VAULT_DOCS(),
        JSON.stringify([doc]),
      );

      const updated = { ...doc, status: "Approved" as const };
      await saveVaultDoc(updated);

      const stored = getRawVaultDocs();
      expect(stored).toHaveLength(1);
      expect(stored[0].status).toBe("Approved");
    });

    it("returns the saved doc", async () => {
      const doc = {
        id: "doc-1",
        tenantId: "test-co",
        type: "BOL" as const,
        url: "https://example.com/doc.pdf",
        filename: "doc.pdf",
        status: "Submitted" as const,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      };

      const result = await saveVaultDoc(doc);
      expect(result).toEqual(doc);
    });
  });

  describe("uploadVaultDoc", () => {
    it("uploads file to Firebase Storage and saves doc to localStorage", async () => {
      const file = new File(["test content"], "bol.pdf", {
        type: "application/pdf",
      });

      const result = await uploadVaultDoc(file, "BOL", "test-co", {
        loadId: "L-100",
      });

      expect(mockRef).toHaveBeenCalled();
      expect(mockUploadBytes).toHaveBeenCalledWith(expect.anything(), file);
      expect(mockGetDownloadURL).toHaveBeenCalled();

      expect(result.id).toBe("mock-uuid-1234");
      expect(result.tenantId).toBe("test-co");
      expect(result.type).toBe("BOL");
      expect(result.url).toBe("https://storage.example.com/doc.pdf");
      expect(result.filename).toBe("bol.pdf");
      expect(result.mimeType).toBe("application/pdf");
      expect(result.status).toBe("Submitted");
      expect(result.loadId).toBe("L-100");

      // Doc should also be saved to localStorage
      const stored = getRawVaultDocs();
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe("mock-uuid-1234");
    });

    it("includes file size in doc metadata", async () => {
      const content = "test content for size check";
      const file = new File([content], "pod.pdf", {
        type: "application/pdf",
      });

      const result = await uploadVaultDoc(file, "POD", "test-co");
      expect(result.fileSize).toBe(file.size);
    });

    it("constructs correct storage path with tenantId and docType", async () => {
      mockRef.mockClear();
      const file = new File(["data"], "fuel.pdf", {
        type: "application/pdf",
      });

      await uploadVaultDoc(file, "Fuel", "my-tenant");

      // Get the latest call (may have previous calls from other tests)
      const lastCall = mockRef.mock.calls[mockRef.mock.calls.length - 1];
      const storagePath = lastCall[1];
      expect(storagePath).toContain("tenants/my-tenant/docs/Fuel/");
      expect(storagePath).toContain("mock-uuid-1234");
    });
  });

  describe("tenant isolation", () => {
    it("docs from different tenants use different storage keys", () => {
      // Save doc for tenant A
      mockGetCurrentUser.mockReturnValue({ companyId: "tenant-a" });
      const keyA = STORAGE_KEY_VAULT_DOCS();
      localStorage.setItem(
        keyA,
        JSON.stringify([
          {
            id: "doc-a",
            tenantId: "tenant-a",
            type: "BOL",
            url: "a",
            filename: "a.pdf",
            status: "Submitted",
            createdAt: "2026-01-01",
            updatedAt: "2026-01-01",
          },
        ]),
      );

      // Switch to tenant B
      mockGetCurrentUser.mockReturnValue({ companyId: "tenant-b" });
      const keyB = STORAGE_KEY_VAULT_DOCS();

      expect(keyA).not.toBe(keyB);
      expect(keyA).toContain("tenant-a");
      expect(keyB).toContain("tenant-b");

      // Tenant B should not see tenant A's docs
      const docsB = getRawVaultDocs();
      expect(docsB).toEqual([]);

      // Restore
      mockGetCurrentUser.mockReturnValue({ companyId: "test-co" });
    });
  });
});
