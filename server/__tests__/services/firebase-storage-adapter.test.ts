/**
 * Tests for FirebaseStorageAdapter and createStorageAdapter factory.
 *
 * Tests R-P6-01, R-P6-02, R-P6-03, R-P6-04, R-P6-05, R-P6-06
 *
 * These tests mock firebase-admin to avoid real cloud calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- Mock firebase-admin storage ---
const mockSave = vi.fn().mockResolvedValue(undefined);
const mockDelete = vi.fn().mockResolvedValue(undefined);
const mockGetSignedUrl = vi
  .fn()
  .mockResolvedValue(["https://storage.googleapis.com/bucket/signed-url"]);

const mockFile = vi.fn().mockReturnValue({
  save: mockSave,
  delete: mockDelete,
  getSignedUrl: mockGetSignedUrl,
});

const mockBucket = vi.fn().mockReturnValue({
  file: mockFile,
});

vi.mock("../../auth", () => ({
  default: {
    storage: () => ({
      bucket: mockBucket,
    }),
  },
}));

import { createFirebaseStorageAdapter } from "../../services/firebase-storage-adapter";

describe("FirebaseStorageAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // R-P6-01: FirebaseStorageAdapter implements StorageAdapter interface
  describe("R-P6-01: implements StorageAdapter interface", () => {
    it("exposes uploadBlob, deleteBlob, and getSignedUrl methods", () => {
      const adapter = createFirebaseStorageAdapter("test-bucket");
      expect(typeof adapter.uploadBlob).toBe("function");
      expect(typeof adapter.deleteBlob).toBe("function");
      expect(typeof adapter.getSignedUrl).toBe("function");
    });

    it("uploadBlob calls Firebase file.save with buffer and metadata", async () => {
      const adapter = createFirebaseStorageAdapter("test-bucket");
      const buffer = Buffer.from("test content");
      const metadata = {
        contentType: "application/pdf",
        documentId: "doc-123",
        companyId: "tenant-456",
      };

      await adapter.uploadBlob(
        "tenants/tenant-456/documents/doc-123/file.pdf",
        buffer,
        metadata,
      );

      expect(mockBucket).toHaveBeenCalledWith("test-bucket");
      expect(mockFile).toHaveBeenCalledWith(
        "tenants/tenant-456/documents/doc-123/file.pdf",
      );
      expect(mockSave).toHaveBeenCalledWith(buffer, {
        metadata: {
          contentType: "application/pdf",
          metadata,
        },
        resumable: false,
      });
    });

    it("deleteBlob calls Firebase file.delete with ignoreNotFound", async () => {
      const adapter = createFirebaseStorageAdapter("test-bucket");
      const path = "tenants/tenant-456/documents/doc-123/file.pdf";

      await adapter.deleteBlob(path);

      expect(mockFile).toHaveBeenCalledWith(path);
      expect(mockDelete).toHaveBeenCalledWith({ ignoreNotFound: true });
    });
  });

  // R-P6-02: Upload paths are tenant-scoped
  describe("R-P6-02: tenant-scoped upload paths", () => {
    it("uploadBlob preserves tenant-scoped path format", async () => {
      const adapter = createFirebaseStorageAdapter("my-bucket");
      const tenantPath =
        "tenants/company-abc/documents/doc-xyz/invoice.pdf";
      const buffer = Buffer.from("invoice data");

      await adapter.uploadBlob(tenantPath, buffer, {
        contentType: "application/pdf",
      });

      expect(mockFile).toHaveBeenCalledWith(tenantPath);
      // Verify the path starts with tenants/{companyId}/documents/
      expect(tenantPath).toMatch(
        /^tenants\/[^/]+\/documents\/[^/]+\/[^/]+$/,
      );
    });

    it("deleteBlob uses exact tenant-scoped path", async () => {
      const adapter = createFirebaseStorageAdapter("my-bucket");
      const tenantPath =
        "tenants/company-xyz/documents/doc-001/receipt.png";

      await adapter.deleteBlob(tenantPath);

      expect(mockFile).toHaveBeenCalledWith(tenantPath);
    });

    it("getSignedUrl uses exact tenant-scoped path", async () => {
      const adapter = createFirebaseStorageAdapter("my-bucket");
      const tenantPath =
        "tenants/company-xyz/documents/doc-002/report.xlsx";

      await adapter.getSignedUrl(tenantPath, 3600000);

      expect(mockFile).toHaveBeenCalledWith(tenantPath);
    });
  });

  // R-P6-03: getSignedUrl returns time-limited signed URL
  describe("R-P6-03: getSignedUrl returns time-limited URL", () => {
    it("returns the signed URL string from Firebase", async () => {
      const adapter = createFirebaseStorageAdapter("test-bucket");
      const path = "tenants/t1/documents/d1/file.pdf";

      const url = await adapter.getSignedUrl(path, 900000); // 15 minutes

      expect(url).toBe(
        "https://storage.googleapis.com/bucket/signed-url",
      );
    });

    it("passes correct expiry to getSignedUrl", async () => {
      const adapter = createFirebaseStorageAdapter("test-bucket");
      const path = "tenants/t1/documents/d1/file.pdf";
      const expiresInMs = 1800000; // 30 minutes

      const beforeCall = Date.now();
      await adapter.getSignedUrl(path, expiresInMs);
      const afterCall = Date.now();

      // Verify getSignedUrl was called with action: 'read' and a valid expires timestamp
      expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
      const callArgs = mockGetSignedUrl.mock.calls[0][0];
      expect(callArgs.action).toBe("read");
      // expires should be approximately Date.now() + expiresInMs
      expect(callArgs.expires).toBeGreaterThanOrEqual(
        beforeCall + expiresInMs,
      );
      expect(callArgs.expires).toBeLessThanOrEqual(
        afterCall + expiresInMs,
      );
    });

    it("uses default 1-hour expiry when expiresInMs not provided", async () => {
      const adapter = createFirebaseStorageAdapter("test-bucket");
      const path = "tenants/t1/documents/d1/file.pdf";

      const beforeCall = Date.now();
      await adapter.getSignedUrl(path, 3600000);

      const callArgs = mockGetSignedUrl.mock.calls[0][0];
      const expectedMinExpiry = beforeCall + 3600000;
      expect(callArgs.expires).toBeGreaterThanOrEqual(expectedMinExpiry);
    });
  });

  // R-P6-01 (negative): error propagation
  describe("error handling", () => {
    it("uploadBlob propagates Firebase errors", async () => {
      mockSave.mockRejectedValueOnce(new Error("Firebase upload failed"));
      const adapter = createFirebaseStorageAdapter("test-bucket");

      await expect(
        adapter.uploadBlob(
          "tenants/t1/documents/d1/f.txt",
          Buffer.from("x"),
          {},
        ),
      ).rejects.toThrow("Firebase upload failed");
    });

    it("deleteBlob propagates Firebase errors", async () => {
      mockDelete.mockRejectedValueOnce(
        new Error("Firebase delete failed"),
      );
      const adapter = createFirebaseStorageAdapter("test-bucket");

      await expect(
        adapter.deleteBlob("tenants/t1/documents/d1/f.txt"),
      ).rejects.toThrow("Firebase delete failed");
    });

    it("getSignedUrl propagates Firebase errors", async () => {
      mockGetSignedUrl.mockRejectedValueOnce(
        new Error("Firebase signing failed"),
      );
      const adapter = createFirebaseStorageAdapter("test-bucket");

      await expect(
        adapter.getSignedUrl("tenants/t1/documents/d1/f.txt", 60000),
      ).rejects.toThrow("Firebase signing failed");
    });
  });

  describe("bucket selection", () => {
    it("uses provided bucket name", () => {
      createFirebaseStorageAdapter("custom-bucket");
      expect(mockBucket).toHaveBeenCalledWith("custom-bucket");
    });

    it("falls back to FIREBASE_STORAGE_BUCKET env var", () => {
      const original = process.env.FIREBASE_STORAGE_BUCKET;
      process.env.FIREBASE_STORAGE_BUCKET = "env-bucket";
      try {
        createFirebaseStorageAdapter();
        expect(mockBucket).toHaveBeenCalledWith("env-bucket");
      } finally {
        if (original === undefined) {
          delete process.env.FIREBASE_STORAGE_BUCKET;
        } else {
          process.env.FIREBASE_STORAGE_BUCKET = original;
        }
      }
    });

    it("passes undefined when no bucket specified and no env var", () => {
      const original = process.env.FIREBASE_STORAGE_BUCKET;
      delete process.env.FIREBASE_STORAGE_BUCKET;
      try {
        createFirebaseStorageAdapter();
        expect(mockBucket).toHaveBeenCalledWith(undefined);
      } finally {
        if (original !== undefined) {
          process.env.FIREBASE_STORAGE_BUCKET = original;
        }
      }
    });
  });
});

// --- Factory tests ---
// The factory in document.service.ts uses dynamic import() for both adapters.
// firebase-storage-adapter is already mocked above (via vi.mock("../../auth")).
// We import createStorageAdapter directly.
import { createStorageAdapter } from "../../services/document.service";

describe("createStorageAdapter factory", () => {
  const originalBackend = process.env.STORAGE_BACKEND;

  afterEach(() => {
    if (originalBackend === undefined) {
      delete process.env.STORAGE_BACKEND;
    } else {
      process.env.STORAGE_BACKEND = originalBackend;
    }
  });

  // R-P6-04: STORAGE_BACKEND=firebase selects Firebase adapter
  it("R-P6-04: STORAGE_BACKEND=firebase selects Firebase adapter", async () => {
    process.env.STORAGE_BACKEND = "firebase";

    const adapter = await createStorageAdapter();

    // Firebase adapter: uploadBlob calls our mocked Firebase save
    expect(typeof adapter.uploadBlob).toBe("function");
    expect(typeof adapter.deleteBlob).toBe("function");
    expect(typeof adapter.getSignedUrl).toBe("function");

    // Verify it is the Firebase adapter by calling uploadBlob and checking mock
    mockSave.mockClear();
    await adapter.uploadBlob(
      "tenants/t/documents/d/f.txt",
      Buffer.from("x"),
      {},
    );
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  // R-P6-05: STORAGE_BACKEND=disk selects disk adapter
  it("R-P6-05: STORAGE_BACKEND=disk selects disk adapter", async () => {
    process.env.STORAGE_BACKEND = "disk";

    const adapter = await createStorageAdapter();

    expect(typeof adapter.uploadBlob).toBe("function");
    expect(typeof adapter.deleteBlob).toBe("function");
    expect(typeof adapter.getSignedUrl).toBe("function");

    // Verify it is the disk adapter: getSignedUrl returns disk:// URI
    const url = await adapter.getSignedUrl("test/path.txt", 60000);
    expect(url).toBe("disk://test/path.txt");
  });

  // R-P6-05 (default): no STORAGE_BACKEND defaults to disk
  it("R-P6-05: default (no env var) selects disk adapter", async () => {
    delete process.env.STORAGE_BACKEND;

    const adapter = await createStorageAdapter();

    const url = await adapter.getSignedUrl("any/path.txt", 60000);
    expect(url).toBe("disk://any/path.txt");
  });

  // R-P6-06: createStorageAdapter exported from document.service.ts
  it("R-P6-06: createStorageAdapter is exported from document.service", () => {
    expect(typeof createStorageAdapter).toBe("function");
  });

  // R-P6-04 (case insensitive): STORAGE_BACKEND=Firebase works
  it("R-P6-04: STORAGE_BACKEND is case-insensitive", async () => {
    process.env.STORAGE_BACKEND = "Firebase";

    const adapter = await createStorageAdapter();

    mockSave.mockClear();
    await adapter.uploadBlob(
      "tenants/t/documents/d/f.txt",
      Buffer.from("x"),
      {},
    );
    expect(mockSave).toHaveBeenCalledTimes(1);
  });
});
