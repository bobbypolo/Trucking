/**
 * Unit test for the document repository column-alias mapping added in
 * Phase 2 of the Bulletproof Sales Demo sprint.
 *
 * Tests R-P2-12.
 *
 * Background:
 *   - LoadDetailView.tsx:1125-1135 renders doc.filename and doc.type,
 *     but the raw DB rows returned by document.repository only expose
 *     original_filename and document_type.
 *   - This phase adds a ≤10-line additive alias mapping in the
 *     repository accessors so every returned row carries both the
 *     original columns AND the alias properties.
 *
 * Contract asserted here:
 *   1. findByCompany returns rows where row.filename equals
 *      row.original_filename and row.type equals row.document_type.
 *   2. findById returns a single row with the same alias guarantees.
 *   3. The original columns (original_filename, document_type) remain
 *      present on every returned row — the mapping is additive only.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks must exist before the module under test is imported.
const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
    execute: vi.fn(),
  },
}));

import { documentRepository } from "../../repositories/document.repository";

const COMPANY_ID = "SALES-DEMO-001";
const HERO_LOAD_ID = "LP-DEMO-RC-001";

function makeRawRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "SALES-DEMO-DOC-RATECON-001",
    company_id: COMPANY_ID,
    load_id: HERO_LOAD_ID,
    original_filename: "rate-con.pdf",
    sanitized_filename: "rate-con.pdf",
    mime_type: "application/pdf",
    file_size_bytes: 1400,
    storage_path: `sales-demo/${HERO_LOAD_ID}/rate-con.pdf`,
    document_type: "rate_confirmation",
    status: "ready",
    description: "Rate confirmation for LP-DEMO-RC-001",
    uploaded_by: "SALES-DEMO-ADMIN-001",
    created_at: "2025-11-10T00:00:00.000Z",
    updated_at: "2025-11-10T00:00:00.000Z",
    ...overrides,
  };
}

describe("documentRepository alias mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Tests R-P2-12 — findByCompany returns rows with .filename and .type
  // aliases that equal the raw original_filename and document_type
  // columns, with the original columns still present.
  it("R-P2-12: findByCompany aliases original_filename -> filename and document_type -> type", async () => {
    const raw = makeRawRow();
    mockQuery.mockResolvedValueOnce([[raw], []]);

    const rows = await documentRepository.findByCompany(COMPANY_ID, {
      load_id: HERO_LOAD_ID,
    });

    expect(rows).toHaveLength(1);
    const row = rows[0] as Record<string, unknown>;

    // Specific value assertions — both aliases must match the raw cols.
    expect(row.filename).toBe("rate-con.pdf");
    expect(row.type).toBe("rate_confirmation");

    // Additive contract — original columns must still be present so
    // other callers that read original_filename / document_type keep
    // working byte-for-byte.
    expect(row.original_filename).toBe("rate-con.pdf");
    expect(row.document_type).toBe("rate_confirmation");

    // The alias values equal the raw column values for every row.
    expect(row.filename).toBe(row.original_filename);
    expect(row.type).toBe(row.document_type);
  });

  // Tests R-P2-12 — findById applies the same alias guarantees.
  it("R-P2-12: findById aliases original_filename -> filename and document_type -> type", async () => {
    const raw = makeRawRow({
      id: "SALES-DEMO-DOC-BOL-001",
      original_filename: "bol.pdf",
      sanitized_filename: "bol.pdf",
      document_type: "bill_of_lading",
      description: "Signed BOL for LP-DEMO-RC-001",
    });
    mockQuery.mockResolvedValueOnce([[raw], []]);

    const row = (await documentRepository.findById(
      "SALES-DEMO-DOC-BOL-001",
      COMPANY_ID,
    )) as Record<string, unknown> | null;

    expect(row).not.toBeNull();
    expect(row!.filename).toBe("bol.pdf");
    expect(row!.type).toBe("bill_of_lading");
    expect(row!.original_filename).toBe("bol.pdf");
    expect(row!.document_type).toBe("bill_of_lading");
  });

  // Tests R-P2-12 — every row in a multi-row result receives the alias
  // treatment, not just the first row.
  it("R-P2-12: findByCompany applies aliases to every row in a multi-row result", async () => {
    const raws = [
      makeRawRow({
        id: "SALES-DEMO-DOC-RATECON-001",
        original_filename: "rate-con.pdf",
        document_type: "rate_confirmation",
      }),
      makeRawRow({
        id: "SALES-DEMO-DOC-BOL-001",
        original_filename: "bol.pdf",
        document_type: "bill_of_lading",
      }),
      makeRawRow({
        id: "SALES-DEMO-DOC-LUMPER-001",
        original_filename: "lumper-receipt.pdf",
        document_type: "lumper_receipt",
      }),
    ];
    mockQuery.mockResolvedValueOnce([raws, []]);

    const rows = await documentRepository.findByCompany(COMPANY_ID, {
      load_id: HERO_LOAD_ID,
    });

    expect(rows).toHaveLength(3);

    // Build the expected alias pairs — behavioral assertion, not a
    // loop-by-count mechanic check.
    const observed = (rows as unknown as Record<string, unknown>[]).map((r) => [
      r.filename,
      r.type,
    ]);
    expect(observed).toEqual([
      ["rate-con.pdf", "rate_confirmation"],
      ["bol.pdf", "bill_of_lading"],
      ["lumper-receipt.pdf", "lumper_receipt"],
    ]);
  });

  // Tests R-P2-12 — findById returns null when no row matches and the
  // alias code path is not triggered (no TypeError on null).
  it("R-P2-12: findById returns null when no matching row exists (alias mapping is safe on empty results)", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const row = await documentRepository.findById("nope", COMPANY_ID);

    expect(row).toBeNull();
  });
});
