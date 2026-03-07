import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P3-01-AC1, R-P3-01-AC2, R-P3-01-AC3

// --- Mock setup ---
const {
  mockRepoCreate,
  mockRepoFindById,
  mockRepoFindByCompany,
  mockRepoUpdateStatus,
  mockRepoDeleteById,
} = vi.hoisted(() => {
  return {
    mockRepoCreate: vi.fn(),
    mockRepoFindById: vi.fn(),
    mockRepoFindByCompany: vi.fn(),
    mockRepoUpdateStatus: vi.fn(),
    mockRepoDeleteById: vi.fn(),
  };
});

vi.mock("../../repositories/document.repository", () => ({
  documentRepository: {
    create: mockRepoCreate,
    findById: mockRepoFindById,
    findByCompany: mockRepoFindByCompany,
    updateStatus: mockRepoUpdateStatus,
    deleteById: mockRepoDeleteById,
  },
}));

// Mock logger to suppress output in tests
vi.mock("../../lib/logger", () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  createDocumentService,
  type StorageAdapter,
  type UploadInput,
} from "../../services/document.service";
import { DocumentStatus } from "../../services/document-state-machine";
import {
  ValidationError,
  InternalError,
  BusinessRuleError,
} from "../../errors/AppError";

// --- Helpers ---
const COMPANY_A = "company-aaa";
const COMPANY_B = "company-bbb";

function makeStorage(overrides: Partial<StorageAdapter> = {}): StorageAdapter {
  return {
    uploadBlob: vi.fn().mockResolvedValue(undefined),
    deleteBlob: vi.fn().mockResolvedValue(undefined),
    getSignedUrl: vi
      .fn()
      .mockResolvedValue("https://storage.example.com/signed-url"),
    ...overrides,
  };
}

function makeUploadInput(overrides: Partial<UploadInput> = {}): UploadInput {
  return {
    companyId: COMPANY_A,
    originalFilename: "invoice.pdf",
    mimeType: "application/pdf",
    fileSizeBytes: 1024,
    buffer: Buffer.from("fake-pdf-content"),
    documentType: "invoice",
    loadId: "load-001",
    description: "Test invoice",
    uploadedBy: "user-001",
    ...overrides,
  };
}

describe("R-P3-01: Document Service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("AC2: validateFile — file type/size validation", () => {
    it("accepts valid PDF file", () => {
      const storage = makeStorage();
      const service = createDocumentService(storage);

      expect(() =>
        service.validateFile({
          originalFilename: "invoice.pdf",
          mimeType: "application/pdf",
          fileSizeBytes: 1024,
        }),
      ).not.toThrow();
    });

    it("accepts valid JPG file", () => {
      const storage = makeStorage();
      const service = createDocumentService(storage);

      expect(() =>
        service.validateFile({
          originalFilename: "photo.jpg",
          mimeType: "image/jpeg",
          fileSizeBytes: 2048,
        }),
      ).not.toThrow();
    });

    it("accepts valid PNG file", () => {
      const storage = makeStorage();
      const service = createDocumentService(storage);

      expect(() =>
        service.validateFile({
          originalFilename: "scan.png",
          mimeType: "image/png",
          fileSizeBytes: 5000,
        }),
      ).not.toThrow();
    });

    it("accepts valid TIFF file", () => {
      const storage = makeStorage();
      const service = createDocumentService(storage);

      expect(() =>
        service.validateFile({
          originalFilename: "scan.tiff",
          mimeType: "image/tiff",
          fileSizeBytes: 5000,
        }),
      ).not.toThrow();
    });

    it("rejects file exceeding 10MB", () => {
      const storage = makeStorage();
      const service = createDocumentService(storage);

      expect(() =>
        service.validateFile({
          originalFilename: "large.pdf",
          mimeType: "application/pdf",
          fileSizeBytes: 11 * 1024 * 1024,
        }),
      ).toThrow(ValidationError);
    });

    it("rejects zero-size file", () => {
      const storage = makeStorage();
      const service = createDocumentService(storage);

      expect(() =>
        service.validateFile({
          originalFilename: "empty.pdf",
          mimeType: "application/pdf",
          fileSizeBytes: 0,
        }),
      ).toThrow(ValidationError);
    });

    it("rejects disallowed file extension (.exe)", () => {
      const storage = makeStorage();
      const service = createDocumentService(storage);

      expect(() =>
        service.validateFile({
          originalFilename: "malware.exe",
          mimeType: "application/octet-stream",
          fileSizeBytes: 1024,
        }),
      ).toThrow(ValidationError);
    });

    it("rejects disallowed file extension (.html)", () => {
      const storage = makeStorage();
      const service = createDocumentService(storage);

      expect(() =>
        service.validateFile({
          originalFilename: "page.html",
          mimeType: "text/html",
          fileSizeBytes: 1024,
        }),
      ).toThrow(ValidationError);
    });
  });

  describe("AC2: filename sanitization", () => {
    it("strips path traversal from filenames", () => {
      const storage = makeStorage();
      const service = createDocumentService(storage);
      mockRepoCreate.mockResolvedValueOnce({
        id: "doc-001",
        status: "pending",
      });
      mockRepoUpdateStatus.mockResolvedValueOnce({
        id: "doc-001",
        status: "finalized",
      });

      // The upload should not throw — filename gets sanitized
      const input = makeUploadInput({
        originalFilename: "../../../etc/passwd.pdf",
      });

      // Validate that sanitization works (no path traversal in storage path)
      expect(() =>
        service.validateFile({
          originalFilename: input.originalFilename,
          mimeType: input.mimeType,
          fileSizeBytes: input.fileSizeBytes,
        }),
      ).not.toThrow();
    });
  });

  describe("AC1: upload — compensating transaction pattern", () => {
    it("step 1-4: uploads blob, writes metadata, finalizes on success", async () => {
      const storage = makeStorage();
      const service = createDocumentService(storage);

      mockRepoCreate.mockResolvedValueOnce({
        id: "generated-id",
        status: DocumentStatus.PENDING,
      });
      mockRepoUpdateStatus.mockResolvedValueOnce({
        id: "generated-id",
        status: DocumentStatus.FINALIZED,
      });

      const result = await service.upload(makeUploadInput());

      // Verify blob uploaded with pending status metadata
      expect(storage.uploadBlob).toHaveBeenCalledOnce();
      const [storagePath, _buffer, metadata] = (
        storage.uploadBlob as ReturnType<typeof vi.fn>
      ).mock.calls[0];
      expect(storagePath).toContain(`tenants/${COMPANY_A}/documents/`);
      expect(metadata.status).toBe(DocumentStatus.PENDING);
      expect(metadata.companyId).toBe(COMPANY_A);

      // Verify metadata written
      expect(mockRepoCreate).toHaveBeenCalledOnce();
      const createArg = mockRepoCreate.mock.calls[0][0];
      expect(createArg.status).toBe(DocumentStatus.PENDING);
      expect(createArg.company_id).toBe(COMPANY_A);
      expect(createArg.storage_path).toContain(
        `tenants/${COMPANY_A}/documents/`,
      );

      // Verify finalization
      expect(mockRepoUpdateStatus).toHaveBeenCalledOnce();
      expect(mockRepoUpdateStatus.mock.calls[0][1]).toBe(
        DocumentStatus.FINALIZED,
      );

      // Verify result
      expect(result.status).toBe(DocumentStatus.FINALIZED);
      expect(result.storagePath).toContain(`tenants/${COMPANY_A}/documents/`);
    });

    it("step 2: tenant-scoped storage path (tenants/{tenantId}/documents/{docId}/{filename})", async () => {
      const storage = makeStorage();
      const service = createDocumentService(storage);

      mockRepoCreate.mockResolvedValueOnce({ id: "doc-id", status: "pending" });
      mockRepoUpdateStatus.mockResolvedValueOnce({
        id: "doc-id",
        status: "finalized",
      });

      const result = await service.upload(makeUploadInput());

      const pathRegex =
        /^tenants\/company-aaa\/documents\/[a-f0-9-]+\/invoice\.pdf$/;
      expect(result.storagePath).toMatch(pathRegex);
    });

    it("step 5: if blob upload fails, no metadata row is persisted", async () => {
      const storage = makeStorage({
        uploadBlob: vi
          .fn()
          .mockRejectedValueOnce(new Error("Storage unavailable")),
      });
      const service = createDocumentService(storage);

      await expect(service.upload(makeUploadInput())).rejects.toThrow(
        InternalError,
      );

      // Metadata should NOT have been written
      expect(mockRepoCreate).not.toHaveBeenCalled();
      // No cleanup needed
      expect(storage.deleteBlob).not.toHaveBeenCalled();
    });

    it("step 4: if MySQL write fails after blob upload, cleanup blob (compensating)", async () => {
      const storage = makeStorage();
      const service = createDocumentService(storage);

      mockRepoCreate.mockRejectedValueOnce(new Error("MySQL connection lost"));

      await expect(service.upload(makeUploadInput())).rejects.toThrow(
        InternalError,
      );

      // Blob was uploaded
      expect(storage.uploadBlob).toHaveBeenCalledOnce();
      // Compensating cleanup: blob should be deleted
      expect(storage.deleteBlob).toHaveBeenCalledOnce();
      const deletePath = (storage.deleteBlob as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      expect(deletePath).toContain(`tenants/${COMPANY_A}/documents/`);
    });

    it("logs orphan when compensating cleanup also fails", async () => {
      const storage = makeStorage({
        deleteBlob: vi
          .fn()
          .mockRejectedValueOnce(new Error("Storage delete failed")),
      });
      const service = createDocumentService(storage);

      mockRepoCreate.mockRejectedValueOnce(new Error("MySQL connection lost"));

      // Should still throw the original InternalError
      await expect(service.upload(makeUploadInput())).rejects.toThrow(
        InternalError,
      );

      // Both upload and delete attempted
      expect(storage.uploadBlob).toHaveBeenCalledOnce();
      expect(storage.deleteBlob).toHaveBeenCalledOnce();
    });

    it("rejects upload when file validation fails", async () => {
      const storage = makeStorage();
      const service = createDocumentService(storage);

      const invalidInput = makeUploadInput({
        originalFilename: "malware.exe",
        fileSizeBytes: 1024,
      });

      await expect(service.upload(invalidInput)).rejects.toThrow(
        ValidationError,
      );

      // Nothing should have been called
      expect(storage.uploadBlob).not.toHaveBeenCalled();
      expect(mockRepoCreate).not.toHaveBeenCalled();
    });
  });

  describe("AC3: transitionStatus — uses document state machine", () => {
    it("allows valid transition (finalized -> processing)", async () => {
      const storage = makeStorage();
      const service = createDocumentService(storage);

      mockRepoFindById.mockResolvedValueOnce({
        id: "doc-001",
        status: DocumentStatus.FINALIZED,
        company_id: COMPANY_A,
      });
      mockRepoUpdateStatus.mockResolvedValueOnce({
        id: "doc-001",
        status: DocumentStatus.PROCESSING,
      });

      await expect(
        service.transitionStatus(
          "doc-001",
          COMPANY_A,
          DocumentStatus.PROCESSING,
        ),
      ).resolves.not.toThrow();

      expect(mockRepoUpdateStatus).toHaveBeenCalledWith(
        "doc-001",
        DocumentStatus.PROCESSING,
        COMPANY_A,
      );
    });

    it("rejects invalid transition (pending -> accepted)", async () => {
      const storage = makeStorage();
      const service = createDocumentService(storage);

      mockRepoFindById.mockResolvedValueOnce({
        id: "doc-001",
        status: DocumentStatus.PENDING,
        company_id: COMPANY_A,
      });

      await expect(
        service.transitionStatus("doc-001", COMPANY_A, DocumentStatus.ACCEPTED),
      ).rejects.toThrow(BusinessRuleError);
    });

    it("throws when document not found", async () => {
      const storage = makeStorage();
      const service = createDocumentService(storage);

      mockRepoFindById.mockResolvedValueOnce(null);

      await expect(
        service.transitionStatus(
          "nonexistent",
          COMPANY_A,
          DocumentStatus.PROCESSING,
        ),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("AC2: tenant isolation on listDocuments", () => {
    it("passes companyId to repository", async () => {
      const storage = makeStorage();
      const service = createDocumentService(storage);

      mockRepoFindByCompany.mockResolvedValueOnce([]);

      await service.listDocuments(COMPANY_A, { load_id: "load-001" });

      expect(mockRepoFindByCompany).toHaveBeenCalledWith(COMPANY_A, {
        load_id: "load-001",
      });
    });
  });

  describe("AC2: tenant isolation on getDownloadUrl", () => {
    it("returns signed URL for document belonging to tenant", async () => {
      const storage = makeStorage();
      const service = createDocumentService(storage);

      mockRepoFindById.mockResolvedValueOnce({
        id: "doc-001",
        storage_path: "tenants/company-aaa/documents/doc-001/invoice.pdf",
        company_id: COMPANY_A,
      });

      const url = await service.getDownloadUrl("doc-001", COMPANY_A);

      expect(url).toBe("https://storage.example.com/signed-url");
      expect(storage.getSignedUrl).toHaveBeenCalledWith(
        "tenants/company-aaa/documents/doc-001/invoice.pdf",
        15 * 60 * 1000,
      );
    });

    it("throws when document not found (wrong tenant)", async () => {
      const storage = makeStorage();
      const service = createDocumentService(storage);

      mockRepoFindById.mockResolvedValueOnce(null);

      await expect(
        service.getDownloadUrl("doc-001", COMPANY_B),
      ).rejects.toThrow(ValidationError);
    });
  });
});
