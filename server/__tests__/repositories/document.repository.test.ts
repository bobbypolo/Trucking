import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P3-01-AC1, R-P3-01-AC2

// --- Mock setup (hoisted so vi.mock factory can reference them) ---
const { mockQuery, mockExecute } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  const mockExecute = vi.fn();
  return { mockQuery, mockExecute };
});

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
    execute: mockExecute,
  },
}));

import { documentRepository } from "../../repositories/document.repository";
import { DocumentStatus } from "../../services/document-state-machine";

// --- Test data ---
const COMPANY_A = "company-aaa";
const COMPANY_B = "company-bbb";

const makeDocRow = (overrides: Record<string, unknown> = {}) => ({
  id: "doc-001",
  company_id: COMPANY_A,
  load_id: "load-001",
  original_filename: "invoice.pdf",
  sanitized_filename: "invoice.pdf",
  mime_type: "application/pdf",
  file_size_bytes: 1024,
  storage_path: `tenants/${COMPANY_A}/documents/doc-001/invoice.pdf`,
  document_type: "invoice",
  status: "pending",
  description: "Test invoice",
  uploaded_by: "user-001",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("R-P3-01: Document Repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("AC1: create — writes document metadata to MySQL", () => {
    it("inserts a document row with parameterized query", async () => {
      mockQuery.mockResolvedValueOnce([{ insertId: 1, affectedRows: 1 }, []]);

      const input = {
        id: "doc-001",
        company_id: COMPANY_A,
        load_id: "load-001",
        original_filename: "invoice.pdf",
        sanitized_filename: "invoice.pdf",
        mime_type: "application/pdf",
        file_size_bytes: 1024,
        storage_path: `tenants/${COMPANY_A}/documents/doc-001/invoice.pdf`,
        document_type: "invoice",
        status: DocumentStatus.PENDING,
        description: "Test invoice",
        uploaded_by: "user-001",
      };

      const result = await documentRepository.create(input);

      expect(mockQuery).toHaveBeenCalledOnce();
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("INSERT INTO documents");
      expect(params).toContain("doc-001");
      expect(params).toContain(COMPANY_A);
      expect(params).toContain("invoice.pdf");
      expect(params).toContain("application/pdf");
      expect(params).toContain(1024);
      expect(result.id).toBe("doc-001");
      expect(result.company_id).toBe(COMPANY_A);
      expect(result.status).toBe(DocumentStatus.PENDING);
    });

    it("generates UUID when id is not provided", async () => {
      mockQuery.mockResolvedValueOnce([{ insertId: 1, affectedRows: 1 }, []]);

      const input = {
        company_id: COMPANY_A,
        original_filename: "receipt.png",
        sanitized_filename: "receipt.png",
        mime_type: "image/png",
        file_size_bytes: 2048,
        storage_path: "tenants/company-aaa/documents/auto/receipt.png",
        document_type: "receipt",
        status: DocumentStatus.PENDING,
      };

      const result = await documentRepository.create(input);

      expect(result.id).toBeTruthy();
      expect(result.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });
  });

  describe("AC2: findById — tenant-scoped retrieval", () => {
    it("returns document when found for correct tenant", async () => {
      const row = makeDocRow();
      mockQuery.mockResolvedValueOnce([[row], []]);

      const result = await documentRepository.findById("doc-001", COMPANY_A);

      expect(result).toBeTruthy();
      expect(result!.id).toBe("doc-001");
      expect(result!.company_id).toBe(COMPANY_A);

      // Verify tenant isolation in query
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("company_id = ?");
      expect(params).toContain(COMPANY_A);
    });

    it("returns null when document belongs to different tenant", async () => {
      mockQuery.mockResolvedValueOnce([[], []]);

      const result = await documentRepository.findById("doc-001", COMPANY_B);

      expect(result).toBeNull();
    });

    it("returns null when document does not exist", async () => {
      mockQuery.mockResolvedValueOnce([[], []]);

      const result = await documentRepository.findById(
        "nonexistent",
        COMPANY_A,
      );

      expect(result).toBeNull();
    });
  });

  describe("AC2: findByCompany — tenant-scoped listing with filters", () => {
    it("returns all documents for a company", async () => {
      const rows = [
        makeDocRow({ id: "doc-001" }),
        makeDocRow({ id: "doc-002" }),
      ];
      mockQuery.mockResolvedValueOnce([rows, []]);

      const result = await documentRepository.findByCompany(COMPANY_A);

      expect(result).toHaveLength(2);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("company_id = ?");
      expect(params).toContain(COMPANY_A);
    });

    it("applies load_id filter when provided", async () => {
      mockQuery.mockResolvedValueOnce([[], []]);

      await documentRepository.findByCompany(COMPANY_A, {
        load_id: "load-001",
      });

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("load_id = ?");
      expect(params).toContain("load-001");
    });

    it("applies status filter when provided", async () => {
      mockQuery.mockResolvedValueOnce([[], []]);

      await documentRepository.findByCompany(COMPANY_A, {
        status: "finalized",
      });

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("status = ?");
      expect(params).toContain("finalized");
    });

    it("applies document_type filter when provided", async () => {
      mockQuery.mockResolvedValueOnce([[], []]);

      await documentRepository.findByCompany(COMPANY_A, {
        document_type: "invoice",
      });

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("document_type = ?");
      expect(params).toContain("invoice");
    });
  });

  describe("AC1: updateStatus — tenant-scoped status update", () => {
    it("updates status for document belonging to correct tenant", async () => {
      mockQuery
        .mockResolvedValueOnce([{ affectedRows: 1 }, []])
        .mockResolvedValueOnce([[makeDocRow({ status: "finalized" })], []]);

      const result = await documentRepository.updateStatus(
        "doc-001",
        DocumentStatus.FINALIZED,
        COMPANY_A,
      );

      expect(result).toBeTruthy();
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("UPDATE documents SET status = ?");
      expect(sql).toContain("company_id = ?");
      expect(params).toContain(DocumentStatus.FINALIZED);
      expect(params).toContain(COMPANY_A);
    });

    it("returns null when document belongs to different tenant", async () => {
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await documentRepository.updateStatus(
        "doc-001",
        DocumentStatus.FINALIZED,
        COMPANY_B,
      );

      expect(result).toBeNull();
    });
  });

  describe("AC1: deleteById — tenant-scoped deletion for compensation", () => {
    it("deletes document belonging to correct tenant", async () => {
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

      const result = await documentRepository.deleteById("doc-001", COMPANY_A);

      expect(result).toBe(true);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("DELETE FROM documents");
      expect(sql).toContain("company_id = ?");
      expect(params).toContain(COMPANY_A);
    });

    it("returns false when document not found or wrong tenant", async () => {
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await documentRepository.deleteById("doc-001", COMPANY_B);

      expect(result).toBe(false);
    });
  });
});
