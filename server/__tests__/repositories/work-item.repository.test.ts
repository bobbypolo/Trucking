import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P5-02-AC7, R-P5-02-AC8

const { mockQuery } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  return { mockQuery };
});

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
  },
}));

import { workItemRepository } from "../../repositories/work-item.repository";

const COMPANY_A = "company-aaa";
const COMPANY_B = "company-bbb";

const makeWorkItemRow = (overrides: Record<string, unknown> = {}) => ({
  id: "wi-001",
  company_id: COMPANY_A,
  type: "LOAD_EXCEPTION",
  priority: "High",
  label: "Driver overdue at pickup",
  description: "Load LD-001 driver not checked in",
  entity_id: "load-001",
  entity_type: "load",
  status: "Open",
  due_date: null,
  created_at: "2026-03-08T00:00:00.000Z",
  ...overrides,
});

describe("R-P5-02-AC7: Work Item Repository — tenant-scoped reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("findByCompany returns work items for specified company", async () => {
    const rows = [makeWorkItemRow(), makeWorkItemRow({ id: "wi-002" })];
    mockQuery.mockResolvedValueOnce([rows, []]);

    const result = await workItemRepository.findByCompany(COMPANY_A);

    expect(result).toHaveLength(2);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("WHERE");
    expect(sql).toContain("company_id");
    expect(params).toContain(COMPANY_A);
  });

  it("findByCompany returns empty array when company has no work items", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const result = await workItemRepository.findByCompany("company-empty");
    expect(result).toHaveLength(0);
  });

  it("findByCompany uses parameterized query (no interpolation)", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    await workItemRepository.findByCompany(COMPANY_A);

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).not.toContain(COMPANY_A);
    expect(params).toEqual([COMPANY_A]);
  });

  it("findById returns work item when id and companyId match", async () => {
    const row = makeWorkItemRow();
    mockQuery.mockResolvedValueOnce([[row], []]);

    const result = await workItemRepository.findById("wi-001", COMPANY_A);

    expect(result).not.toBeNull();
    expect(result!.id).toBe("wi-001");
    expect(result!.company_id).toBe(COMPANY_A);
  });

  it("findById returns null when work item belongs to different tenant", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const result = await workItemRepository.findById("wi-001", COMPANY_B);
    expect(result).toBeNull();
  });
});

describe("R-P5-02-AC8: Work Item Repository — CRUD operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("create inserts a new work item with tenant scoping", async () => {
    const newRow = makeWorkItemRow({ id: "wi-new" });
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[newRow], []]);

    const result = await workItemRepository.create(
      {
        type: "LOAD_EXCEPTION",
        priority: "High",
        label: "Driver overdue at pickup",
        entity_id: "load-001",
        entity_type: "load",
      },
      COMPANY_A,
    );

    expect(result).not.toBeNull();
    expect(result.company_id).toBe(COMPANY_A);

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("INSERT INTO work_items");
    expect(sql).toContain("?");
    expect(params).toContain(COMPANY_A);
    expect(params).toContain("LOAD_EXCEPTION");
  });

  it("create uses parameterized query (no string interpolation)", async () => {
    const newRow = makeWorkItemRow();
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[newRow], []]);

    await workItemRepository.create(
      { type: "SAFETY_ALARM", label: "HOS violation alert" },
      COMPANY_A,
    );

    const [sql] = mockQuery.mock.calls[0];
    expect(sql).not.toContain(COMPANY_A);
    expect(sql).toContain("?");
  });

  it("update modifies work item with tenant scope", async () => {
    const updatedRow = makeWorkItemRow({ status: "In-Progress" });
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[updatedRow], []]);

    const result = await workItemRepository.update(
      "wi-001",
      { status: "In-Progress" },
      COMPANY_A,
    );

    expect(result).not.toBeNull();
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("UPDATE work_items");
    expect(params).toContain("wi-001");
    expect(params).toContain(COMPANY_A);
  });

  it("update returns null when work item not found for tenant", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

    const result = await workItemRepository.update(
      "wi-001",
      { status: "Resolved" },
      COMPANY_B,
    );
    expect(result).toBeNull();
  });

  it("delete removes work item scoped to tenant", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const deleted = await workItemRepository.delete("wi-001", COMPANY_A);

    expect(deleted).toBe(true);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("DELETE FROM work_items");
    expect(params).toContain("wi-001");
    expect(params).toContain(COMPANY_A);
  });

  it("delete returns false when work item not found", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

    const deleted = await workItemRepository.delete("nonexistent", COMPANY_A);
    expect(deleted).toBe(false);
  });
});
