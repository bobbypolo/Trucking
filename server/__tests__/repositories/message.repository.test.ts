import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P5-02-AC3, R-P5-02-AC4

const { mockQuery } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  return { mockQuery };
});

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
  },
}));

import { messageRepository } from "../../repositories/message.repository";

const COMPANY_A = "company-aaa";
const COMPANY_B = "company-bbb";

const makeMessageRow = (overrides: Record<string, unknown> = {}) => ({
  id: "msg-001",
  company_id: COMPANY_A,
  load_id: "load-001",
  sender_id: "user-001",
  sender_name: "Driver Joe",
  text: "ETA 30 minutes",
  timestamp: "2026-03-08T00:00:00.000Z",
  attachments: null,
  ...overrides,
});

describe("R-P5-02-AC3: Message Repository — tenant-scoped reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("findByCompany returns all messages for specified company", async () => {
    const rows = [makeMessageRow(), makeMessageRow({ id: "msg-002" })];
    mockQuery.mockResolvedValueOnce([rows, []]);

    const result = await messageRepository.findByCompany(COMPANY_A);

    expect(result).toHaveLength(2);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("WHERE");
    expect(sql).toContain("company_id");
    expect(params).toContain(COMPANY_A);
  });

  it("findByCompany with loadId filters by both company and load", async () => {
    const rows = [makeMessageRow()];
    mockQuery.mockResolvedValueOnce([rows, []]);

    const result = await messageRepository.findByCompany(COMPANY_A, "load-001");

    expect(result).toHaveLength(1);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("company_id");
    expect(sql).toContain("load_id");
    expect(params).toContain(COMPANY_A);
    expect(params).toContain("load-001");
  });

  it("findByCompany returns empty array when company has no messages", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const result = await messageRepository.findByCompany("company-empty");
    expect(result).toHaveLength(0);
  });

  it("findById returns null when message belongs to different tenant", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const result = await messageRepository.findById("msg-001", COMPANY_B);
    expect(result).toBeNull();
  });

  it("findByCompany uses parameterized query (no interpolation)", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    await messageRepository.findByCompany(COMPANY_A);

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).not.toContain(COMPANY_A);
    expect(params).toContain(COMPANY_A);
  });
});

describe("R-P5-02-AC4: Message Repository — CRUD operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("create inserts a new message with tenant scoping", async () => {
    const newRow = makeMessageRow({ id: "msg-new" });
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[newRow], []]);

    const result = await messageRepository.create(
      {
        load_id: "load-001",
        sender_id: "user-001",
        sender_name: "Driver Joe",
        text: "ETA 30 minutes",
      },
      COMPANY_A,
    );

    expect(result).not.toBeNull();
    expect(result.company_id).toBe(COMPANY_A);

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("INSERT INTO messages");
    expect(params).toContain(COMPANY_A);
    expect(params).toContain("load-001");
    expect(params).toContain("user-001");
  });

  it("create uses parameterized query (no string interpolation)", async () => {
    const newRow = makeMessageRow();
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockQuery.mockResolvedValueOnce([[newRow], []]);

    await messageRepository.create(
      { load_id: "load-001", sender_id: "user-001" },
      COMPANY_A,
    );

    const [sql] = mockQuery.mock.calls[0];
    expect(sql).not.toContain(COMPANY_A);
    expect(sql).not.toContain("load-001");
    expect(sql).toContain("?");
  });

  it("delete removes message scoped to tenant", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const deleted = await messageRepository.delete("msg-001", COMPANY_A);

    expect(deleted).toBe(true);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("DELETE FROM messages");
    expect(params).toContain("msg-001");
    expect(params).toContain(COMPANY_A);
  });

  it("delete returns false when message not found", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

    const deleted = await messageRepository.delete("nonexistent", COMPANY_A);
    expect(deleted).toBe(false);
  });
});
