import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P5-02-AC5, R-P5-02-AC6

const { mockQuery } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  return { mockQuery };
});

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
  },
}));

import { callSessionRepository } from "../../repositories/call-session.repository";

const COMPANY_A = "company-aaa";
const COMPANY_B = "company-bbb";

const makeCallSessionRow = (overrides: Record<string, unknown> = {}) => ({
  id: "call-001",
  company_id: COMPANY_A,
  start_time: "2026-03-08T10:00:00.000Z",
  end_time: "2026-03-08T10:15:00.000Z",
  duration_seconds: 900,
  status: "completed",
  assigned_to: "user-001",
  team: "dispatch",
  last_activity_at: "2026-03-08T10:15:00.000Z",
  notes: "Confirmed delivery time",
  participants: null,
  links: null,
  created_at: "2026-03-08T10:00:00.000Z",
  ...overrides,
});

describe("R-P5-02-AC5: Call Session Repository — tenant-scoped reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("findByCompany returns call sessions for specified company", async () => {
    const rows = [makeCallSessionRow(), makeCallSessionRow({ id: "call-002" })];
    mockQuery.mockResolvedValueOnce([rows, []]);

    const result = await callSessionRepository.findByCompany(COMPANY_A);

    expect(result).toHaveLength(2);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("WHERE");
    expect(sql).toContain("company_id");
    expect(params).toContain(COMPANY_A);
  });

  it("findByCompany returns empty array when company has no sessions", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const result = await callSessionRepository.findByCompany("company-empty");
    expect(result).toHaveLength(0);
  });

  it("findByCompany uses parameterized query (no interpolation)", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    await callSessionRepository.findByCompany(COMPANY_A);

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).not.toContain(COMPANY_A);
    expect(params).toEqual([COMPANY_A]);
  });

  it("findById returns session when id and companyId match", async () => {
    const row = makeCallSessionRow();
    mockQuery.mockResolvedValueOnce([[row], []]);

    const result = await callSessionRepository.findById("call-001", COMPANY_A);

    expect(result).not.toBeNull();
    expect(result!.id).toBe("call-001");
    expect(result!.company_id).toBe(COMPANY_A);
  });

  it("findById returns null when session belongs to different tenant", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const result = await callSessionRepository.findById("call-001", COMPANY_B);
    expect(result).toBeNull();
  });
});

describe("R-P5-02-AC6: Call Session Repository — CRUD operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("create inserts a new call session with tenant scoping", async () => {
    const newRow = makeCallSessionRow({ id: "call-new" });
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[newRow], []]);

    const result = await callSessionRepository.create(
      {
        status: "active",
        assigned_to: "user-001",
        team: "dispatch",
        notes: "Outbound call",
      },
      COMPANY_A,
    );

    expect(result).not.toBeNull();
    expect(result.company_id).toBe(COMPANY_A);

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("INSERT INTO call_sessions");
    expect(sql).toContain("?");
    expect(params).toContain(COMPANY_A);
  });

  it("create uses parameterized query (no string interpolation)", async () => {
    const newRow = makeCallSessionRow();
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[newRow], []]);

    await callSessionRepository.create({ status: "active" }, COMPANY_A);

    const [sql] = mockQuery.mock.calls[0];
    expect(sql).not.toContain(COMPANY_A);
    expect(sql).toContain("?");
  });

  it("update modifies session with tenant scope", async () => {
    const updatedRow = makeCallSessionRow({ status: "completed" });
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[updatedRow], []]);

    const result = await callSessionRepository.update(
      "call-001",
      { status: "completed", duration_seconds: 900 },
      COMPANY_A,
    );

    expect(result).not.toBeNull();
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("UPDATE call_sessions");
    expect(params).toContain("call-001");
    expect(params).toContain(COMPANY_A);
  });

  it("update returns null when session not found for tenant", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

    const result = await callSessionRepository.update(
      "call-001",
      { status: "completed" },
      COMPANY_B,
    );
    expect(result).toBeNull();
  });

  it("delete removes session scoped to tenant", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const deleted = await callSessionRepository.delete("call-001", COMPANY_A);

    expect(deleted).toBe(true);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("DELETE FROM call_sessions");
    expect(params).toContain("call-001");
    expect(params).toContain(COMPANY_A);
  });

  it("delete returns false when session not found", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

    const deleted = await callSessionRepository.delete(
      "nonexistent",
      COMPANY_A,
    );
    expect(deleted).toBe(false);
  });
});
