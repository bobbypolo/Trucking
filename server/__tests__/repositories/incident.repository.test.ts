import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P5-02-AC1, R-P5-02-AC2

// --- Mock setup (hoisted so vi.mock factory can reference them) ---
const { mockQuery } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  return { mockQuery };
});

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
  },
}));

import { incidentRepository } from "../../repositories/incident.repository";

const COMPANY_A = "company-aaa";
const COMPANY_B = "company-bbb";

const makeIncidentRow = (overrides: Record<string, unknown> = {}) => ({
  id: "inc-001",
  company_id: COMPANY_A,
  load_id: "load-001",
  type: "Breakdown",
  severity: "High",
  status: "Open",
  reported_at: "2026-03-08T00:00:00.000Z",
  sla_deadline: null,
  description: "Engine failure",
  location_lat: 41.8781,
  location_lng: -87.6298,
  recovery_plan: null,
  ...overrides,
});

describe("R-P5-02-AC1: Incident Repository — tenant-scoped reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("findByCompany returns incidents for specified company", async () => {
    const rows = [makeIncidentRow(), makeIncidentRow({ id: "inc-002" })];
    mockQuery.mockResolvedValueOnce([rows, []]);

    const result = await incidentRepository.findByCompany(COMPANY_A);

    expect(result).toHaveLength(2);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("WHERE");
    expect(sql).toContain("company_id");
    expect(params).toContain(COMPANY_A);
  });

  it("findByCompany returns empty array for company with no incidents", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const result = await incidentRepository.findByCompany("company-empty");
    expect(result).toHaveLength(0);
  });

  it("findByCompany uses parameterized query (no string interpolation)", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    await incidentRepository.findByCompany(COMPANY_A);

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).not.toContain(COMPANY_A);
    expect(params).toEqual([COMPANY_A]);
  });

  it("findById returns incident when id and companyId match", async () => {
    const row = makeIncidentRow();
    mockQuery.mockResolvedValueOnce([[row], []]);

    const result = await incidentRepository.findById("inc-001", COMPANY_A);

    expect(result).not.toBeNull();
    expect(result!.id).toBe("inc-001");
    expect(result!.company_id).toBe(COMPANY_A);
  });

  it("findById returns null when incident belongs to different tenant", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const result = await incidentRepository.findById("inc-001", COMPANY_B);

    expect(result).toBeNull();
    const [sql, params] = mockQuery.mock.calls[0];
    expect(params).toContain("inc-001");
    expect(params).toContain(COMPANY_B);
  });

  it("findById returns null when incident does not exist", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const result = await incidentRepository.findById("nonexistent", COMPANY_A);
    expect(result).toBeNull();
  });
});

describe("R-P5-02-AC2: Incident Repository — CRUD operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("create inserts a new incident with tenant scoping", async () => {
    const newRow = makeIncidentRow({ id: "inc-new" });
    // INSERT
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // findById after insert
    mockQuery.mockResolvedValueOnce([[newRow], []]);

    const result = await incidentRepository.create(
      {
        load_id: "load-001",
        type: "Breakdown",
        severity: "High",
        description: "Engine failure",
      },
      COMPANY_A,
    );

    expect(result).not.toBeNull();
    expect(result.company_id).toBe(COMPANY_A);

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("INSERT INTO incidents");
    expect(sql).toContain("?");
    expect(params).toContain(COMPANY_A);
    expect(params).toContain("load-001");
    expect(params).toContain("Breakdown");
  });

  it("create uses parameterized query (no string interpolation)", async () => {
    const newRow = makeIncidentRow();
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[newRow], []]);

    await incidentRepository.create(
      { load_id: "load-001", type: "Accident" },
      COMPANY_A,
    );

    const [sql] = mockQuery.mock.calls[0];
    expect(sql).not.toContain(COMPANY_A);
    expect(sql).not.toContain("load-001");
    expect(sql).toContain("?");
  });

  it("update modifies incident with tenant scope", async () => {
    const updatedRow = makeIncidentRow({ status: "In_Progress" });
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[updatedRow], []]);

    const result = await incidentRepository.update(
      "inc-001",
      { status: "In_Progress" },
      COMPANY_A,
    );

    expect(result).not.toBeNull();
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("UPDATE incidents");
    expect(sql).toContain("WHERE");
    expect(params).toContain("inc-001");
    expect(params).toContain(COMPANY_A);
  });

  it("update returns null when incident not found for tenant", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

    const result = await incidentRepository.update(
      "inc-001",
      { status: "Closed" },
      COMPANY_B,
    );

    expect(result).toBeNull();
  });

  it("delete removes incident scoped to tenant", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const deleted = await incidentRepository.delete("inc-001", COMPANY_A);

    expect(deleted).toBe(true);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("DELETE FROM incidents");
    expect(params).toContain("inc-001");
    expect(params).toContain(COMPANY_A);
  });

  it("delete returns false when incident not found", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

    const deleted = await incidentRepository.delete("nonexistent", COMPANY_A);
    expect(deleted).toBe(false);
  });
});
