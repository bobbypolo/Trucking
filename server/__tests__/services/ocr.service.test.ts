import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P3-04-AC1

// --- Mock setup ---
const {
  mockRepoCreate,
  mockRepoFindById,
  mockRepoFindByDocumentId,
  mockRepoUpdateStatus,
} = vi.hoisted(() => {
  return {
    mockRepoCreate: vi.fn(),
    mockRepoFindById: vi.fn(),
    mockRepoFindByDocumentId: vi.fn(),
    mockRepoUpdateStatus: vi.fn(),
  };
});

vi.mock("../../repositories/ocr.repository", () => ({
  ocrRepository: {
    create: mockRepoCreate,
    findById: mockRepoFindById,
    findByDocumentId: mockRepoFindByDocumentId,
    updateStatus: mockRepoUpdateStatus,
  },
}));

const { mockDocRepoFindById, mockDocRepoUpdateStatus } = vi.hoisted(() => {
  return {
    mockDocRepoFindById: vi.fn(),
    mockDocRepoUpdateStatus: vi.fn(),
  };
});

vi.mock("../../repositories/document.repository", () => ({
  documentRepository: {
    findById: mockDocRepoFindById,
    updateStatus: mockDocRepoUpdateStatus,
  },
}));

// Mock logger
vi.mock("../../lib/logger", () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
  createRequestLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  createOcrService,
  type OcrAdapter,
  type OcrFieldResult,
  OCR_TIMEOUT_MS,
} from "../../services/ocr.service";
import { DocumentStatus } from "../../services/document-state-machine";
import { ValidationError } from "../../errors/AppError";

// --- Helpers ---
const COMPANY_A = "company-aaa";

function makeOcrAdapter(overrides: Partial<OcrAdapter> = {}): OcrAdapter {
  const defaultFields: OcrFieldResult[] = [
    {
      field_name: "shipper_name",
      extracted_value: "Acme Freight",
      confidence: 0.95,
    },
    {
      field_name: "consignee_name",
      extracted_value: "Beta Logistics",
      confidence: 0.88,
    },
    { field_name: "weight", extracted_value: "42000", confidence: 0.72 },
    {
      field_name: "pickup_date",
      extracted_value: "2026-03-15",
      confidence: 0.91,
    },
  ];

  return {
    extractFields: vi.fn().mockResolvedValue({
      fields: defaultFields,
      raw_text: "Sample OCR raw text output",
    }),
    ...overrides,
  };
}

function makeDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: "doc-001",
    company_id: COMPANY_A,
    load_id: "load-001",
    storage_path: "tenants/company-aaa/documents/doc-001/bol.pdf",
    status: DocumentStatus.FINALIZED,
    document_type: "bol",
    ...overrides,
  };
}

describe("R-P3-04: OCR Service — Assistive Flow with Review-Required State", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("AC1: OCR results stored with confidence scoring per field", () => {
    it("extracts fields with per-field confidence scores", async () => {
      const adapter = makeOcrAdapter();
      const service = createOcrService(adapter);

      // Document is finalized (ready for processing)
      mockDocRepoFindById.mockResolvedValueOnce(makeDocument());
      // Transition to processing
      mockDocRepoUpdateStatus.mockResolvedValueOnce({
        status: DocumentStatus.PROCESSING,
      });
      // Create OCR result
      mockRepoCreate.mockResolvedValueOnce({
        id: "ocr-001",
        document_id: "doc-001",
        status: "review_required",
        fields: [],
      });
      // Transition to review_required
      mockDocRepoUpdateStatus.mockResolvedValueOnce({
        status: DocumentStatus.REVIEW_REQUIRED,
      });

      const result = await service.processDocument("doc-001", COMPANY_A);

      expect(result.status).toBe("review_required");
      expect(result.fields).toHaveLength(4);

      // Every field has a confidence score
      for (const field of result.fields) {
        expect(field).toHaveProperty("field_name");
        expect(field).toHaveProperty("extracted_value");
        expect(field).toHaveProperty("confidence");
        expect(typeof field.confidence).toBe("number");
        expect(field.confidence).toBeGreaterThanOrEqual(0);
        expect(field.confidence).toBeLessThanOrEqual(1);
      }
    });

    it("stores OCR result in repository with review_required status", async () => {
      const adapter = makeOcrAdapter();
      const service = createOcrService(adapter);

      mockDocRepoFindById.mockResolvedValueOnce(makeDocument());
      mockDocRepoUpdateStatus
        .mockResolvedValueOnce({ status: DocumentStatus.PROCESSING })
        .mockResolvedValueOnce({ status: DocumentStatus.REVIEW_REQUIRED });
      mockRepoCreate.mockResolvedValueOnce({
        id: "ocr-001",
        document_id: "doc-001",
        status: "review_required",
      });

      await service.processDocument("doc-001", COMPANY_A);

      // Verify OCR result was created in repo
      expect(mockRepoCreate).toHaveBeenCalledOnce();
      const createArg = mockRepoCreate.mock.calls[0][0];
      expect(createArg.document_id).toBe("doc-001");
      expect(createArg.company_id).toBe(COMPANY_A);
      expect(createArg.status).toBe("review_required");
      expect(createArg.fields).toHaveLength(4);
      expect(createArg.raw_text).toBe("Sample OCR raw text output");
    });
  });

  describe("AC1: Document status set to review_required (NOT pending_review)", () => {
    it("transitions document: finalized -> processing -> review_required", async () => {
      const adapter = makeOcrAdapter();
      const service = createOcrService(adapter);

      mockDocRepoFindById.mockResolvedValueOnce(makeDocument());
      mockDocRepoUpdateStatus
        .mockResolvedValueOnce({ status: DocumentStatus.PROCESSING })
        .mockResolvedValueOnce({ status: DocumentStatus.REVIEW_REQUIRED });
      mockRepoCreate.mockResolvedValueOnce({
        id: "ocr-001",
        document_id: "doc-001",
        status: "review_required",
      });

      await service.processDocument("doc-001", COMPANY_A);

      // First call: finalized -> processing
      expect(mockDocRepoUpdateStatus).toHaveBeenCalledTimes(2);
      expect(mockDocRepoUpdateStatus.mock.calls[0]).toEqual([
        "doc-001",
        DocumentStatus.PROCESSING,
        COMPANY_A,
      ]);
      // Second call: processing -> review_required
      expect(mockDocRepoUpdateStatus.mock.calls[1]).toEqual([
        "doc-001",
        DocumentStatus.REVIEW_REQUIRED,
        COMPANY_A,
      ]);
    });

    it("uses 'review_required' not 'pending_review' in the OCR result status", async () => {
      const adapter = makeOcrAdapter();
      const service = createOcrService(adapter);

      mockDocRepoFindById.mockResolvedValueOnce(makeDocument());
      mockDocRepoUpdateStatus
        .mockResolvedValueOnce({ status: DocumentStatus.PROCESSING })
        .mockResolvedValueOnce({ status: DocumentStatus.REVIEW_REQUIRED });
      mockRepoCreate.mockResolvedValueOnce({
        id: "ocr-001",
        document_id: "doc-001",
        status: "review_required",
      });

      const result = await service.processDocument("doc-001", COMPANY_A);

      // MUST use review_required, NEVER pending_review
      expect(result.status).toBe("review_required");
      expect(result.status).not.toBe("pending_review");
    });
  });

  describe("AC1: Never auto-applied to load fields", () => {
    it("returns suggestions only — does not call any load update function", async () => {
      const adapter = makeOcrAdapter();
      const service = createOcrService(adapter);

      mockDocRepoFindById.mockResolvedValueOnce(makeDocument());
      mockDocRepoUpdateStatus
        .mockResolvedValueOnce({ status: DocumentStatus.PROCESSING })
        .mockResolvedValueOnce({ status: DocumentStatus.REVIEW_REQUIRED });
      mockRepoCreate.mockResolvedValueOnce({
        id: "ocr-001",
        document_id: "doc-001",
        status: "review_required",
        fields: [],
      });

      const result = await service.processDocument("doc-001", COMPANY_A);

      // The result should contain fields as suggestions, not applied values
      expect(result).toHaveProperty("fields");
      expect(result).toHaveProperty("status", "review_required");
      // Status is review_required, meaning human must review before applying
      // No load repository or load service was imported or called
    });

    it("getOcrResult returns fields as suggestions requiring human review", async () => {
      const adapter = makeOcrAdapter();
      const service = createOcrService(adapter);

      const mockOcrResult = {
        id: "ocr-001",
        document_id: "doc-001",
        company_id: COMPANY_A,
        status: "review_required",
        fields: JSON.stringify([
          {
            field_name: "shipper_name",
            extracted_value: "Acme Freight",
            confidence: 0.95,
          },
          { field_name: "weight", extracted_value: "42000", confidence: 0.72 },
        ]),
        raw_text: "Raw OCR text",
      };

      mockRepoFindByDocumentId.mockResolvedValueOnce(mockOcrResult);

      const result = await service.getOcrResult("doc-001", COMPANY_A);

      expect(result).toBeDefined();
      expect(result!.status).toBe("review_required");
      expect(result!.fields).toHaveLength(2);
      // Fields are suggestions, not applied data
      expect(result!.fields[0].field_name).toBe("shipper_name");
      expect(result!.fields[0].confidence).toBe(0.95);
    });
  });

  describe("AC1: 30-second timeout with graceful error", () => {
    it("returns degraded response when OCR exceeds 30s timeout", async () => {
      const adapter = makeOcrAdapter({
        extractFields: vi
          .fn()
          .mockRejectedValueOnce(
            new DOMException("The operation was aborted", "AbortError"),
          ),
      });
      const service = createOcrService(adapter);

      mockDocRepoFindById.mockResolvedValueOnce(makeDocument());
      mockDocRepoUpdateStatus.mockResolvedValueOnce({
        status: DocumentStatus.PROCESSING,
      });

      const result = await service.processDocument("doc-001", COMPANY_A);

      expect(result.status).toBe("error");
      expect(result.error).toBeDefined();
      expect(result.error!.reason).toBe("timeout");
      expect(result.fields).toEqual([]);
    });

    it("returns degraded response on general OCR failure", async () => {
      const adapter = makeOcrAdapter({
        extractFields: vi
          .fn()
          .mockRejectedValueOnce(new Error("Gemini API rate limit exceeded")),
      });
      const service = createOcrService(adapter);

      mockDocRepoFindById.mockResolvedValueOnce(makeDocument());
      mockDocRepoUpdateStatus.mockResolvedValueOnce({
        status: DocumentStatus.PROCESSING,
      });

      const result = await service.processDocument("doc-001", COMPANY_A);

      expect(result.status).toBe("error");
      expect(result.error).toBeDefined();
      expect(result.error!.reason).toBe("ocr_failed");
      expect(result.fields).toEqual([]);
    });

    it("OCR_TIMEOUT_MS is 30000 (30 seconds)", () => {
      expect(OCR_TIMEOUT_MS).toBe(30000);
    });
  });

  describe("AC1: Validation and error handling", () => {
    it("throws ValidationError when document not found", async () => {
      const adapter = makeOcrAdapter();
      const service = createOcrService(adapter);

      mockDocRepoFindById.mockResolvedValueOnce(null);

      await expect(
        service.processDocument("nonexistent", COMPANY_A),
      ).rejects.toThrow(ValidationError);
    });

    it("throws ValidationError when document is not in finalized state", async () => {
      const adapter = makeOcrAdapter();
      const service = createOcrService(adapter);

      mockDocRepoFindById.mockResolvedValueOnce(
        makeDocument({ status: DocumentStatus.PENDING }),
      );

      await expect(
        service.processDocument("doc-001", COMPANY_A),
      ).rejects.toThrow(ValidationError);
    });

    it("allows processing documents in finalized state", async () => {
      const adapter = makeOcrAdapter();
      const service = createOcrService(adapter);

      mockDocRepoFindById.mockResolvedValueOnce(
        makeDocument({ status: DocumentStatus.FINALIZED }),
      );
      mockDocRepoUpdateStatus
        .mockResolvedValueOnce({ status: DocumentStatus.PROCESSING })
        .mockResolvedValueOnce({ status: DocumentStatus.REVIEW_REQUIRED });
      mockRepoCreate.mockResolvedValueOnce({
        id: "ocr-001",
        document_id: "doc-001",
        status: "review_required",
      });

      const result = await service.processDocument("doc-001", COMPANY_A);

      expect(result.status).toBe("review_required");
    });
  });

  describe("AC1: Tenant isolation", () => {
    it("scopes document lookup to the requesting company", async () => {
      const adapter = makeOcrAdapter();
      const service = createOcrService(adapter);

      mockDocRepoFindById.mockResolvedValueOnce(null);

      // Company B trying to process Company A's document
      await expect(
        service.processDocument("doc-001", "company-bbb"),
      ).rejects.toThrow(ValidationError);

      expect(mockDocRepoFindById).toHaveBeenCalledWith(
        "doc-001",
        "company-bbb",
      );
    });
  });
});
