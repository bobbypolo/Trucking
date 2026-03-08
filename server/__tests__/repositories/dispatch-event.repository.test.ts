import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P2-04-AC1

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

import {
  dispatchEventRepository,
  DispatchEventRow,
} from "../../repositories/dispatch-event.repository";

// --- Constants ---
const COMPANY_A = "company-aaa";
const COMPANY_B = "company-bbb";
const LOAD_ID = "load-001";
const ACTOR_ID = "user-001";

const makeEventRow = (
  overrides: Record<string, unknown> = {},
): DispatchEventRow =>
  ({
    id: "event-001",
    load_id: LOAD_ID,
    dispatcher_id: ACTOR_ID,
    actor_id: ACTOR_ID,
    event_type: "StatusChange",
    prior_state: "draft",
    next_state: "planned",
    correlation_id: "corr-001",
    message: "Status changed from draft to planned",
    payload: "{}",
    created_at: "2026-03-07T12:00:00.000Z",
    ...overrides,
  }) as DispatchEventRow;

describe("R-P2-04: Dispatch Event Repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("AC1: Append-only design — repository exposes no update/delete methods", () => {
    it("has a create method", () => {
      expect(typeof dispatchEventRepository.create).toBe("function");
    });

    it("has a findByLoadId method", () => {
      expect(typeof dispatchEventRepository.findByLoadId).toBe("function");
    });

    it("does NOT have an update method", () => {
      expect(
        (dispatchEventRepository as Record<string, unknown>).update,
      ).toBeUndefined();
    });

    it("does NOT have a delete method", () => {
      expect(
        (dispatchEventRepository as Record<string, unknown>).delete,
      ).toBeUndefined();
    });

    it("does NOT have a remove method", () => {
      expect(
        (dispatchEventRepository as Record<string, unknown>).remove,
      ).toBeUndefined();
    });
  });

  describe("AC1: create — inserts dispatch event with actor_id, prior_state, next_state, correlation_id", () => {
    it("inserts event with all required columns", async () => {
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

      await dispatchEventRepository.create({
        id: "event-001",
        load_id: LOAD_ID,
        dispatcher_id: ACTOR_ID,
        actor_id: ACTOR_ID,
        event_type: "StatusChange",
        prior_state: "draft",
        next_state: "planned",
        correlation_id: "corr-001",
        message: "Status changed from draft to planned",
        payload: {},
      });

      expect(mockExecute).toHaveBeenCalledTimes(1);
      const [sql, params] = mockExecute.mock.calls[0];

      // Verify SQL mentions all required columns
      expect(sql).toContain("actor_id");
      expect(sql).toContain("prior_state");
      expect(sql).toContain("next_state");
      expect(sql).toContain("correlation_id");

      // Verify parameterized (no string interpolation)
      expect(sql).toContain("?");
      expect(sql).not.toContain(LOAD_ID);
      expect(sql).not.toContain(ACTOR_ID);

      // Verify params include the correct values
      expect(params).toContain("event-001");
      expect(params).toContain(LOAD_ID);
      expect(params).toContain(ACTOR_ID);
      expect(params).toContain("draft");
      expect(params).toContain("planned");
      expect(params).toContain("corr-001");
    });

    it("uses INSERT statement (no UPDATE)", async () => {
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

      await dispatchEventRepository.create({
        id: "event-002",
        load_id: LOAD_ID,
        dispatcher_id: ACTOR_ID,
        actor_id: ACTOR_ID,
        event_type: "StatusChange",
        prior_state: "planned",
        next_state: "dispatched",
        correlation_id: "corr-002",
        message: "Status changed",
        payload: {},
      });

      const [sql] = mockExecute.mock.calls[0];
      expect(sql).toMatch(/INSERT\s+INTO/i);
      expect(sql).not.toMatch(/UPDATE/i);
    });
  });

  describe("AC1: findByLoadId — tenant-scoped event query", () => {
    it("returns events for a load with tenant scoping", async () => {
      const events = [
        makeEventRow({
          id: "event-001",
          prior_state: "draft",
          next_state: "planned",
        }),
        makeEventRow({
          id: "event-002",
          prior_state: "planned",
          next_state: "dispatched",
        }),
      ];
      mockQuery.mockResolvedValueOnce([events, []]);

      const result = await dispatchEventRepository.findByLoadId(
        LOAD_ID,
        COMPANY_A,
      );

      expect(result).toHaveLength(2);
      expect(result[0].prior_state).toBe("draft");
      expect(result[1].prior_state).toBe("planned");
    });

    it("uses parameterized query with company_id for tenant isolation", async () => {
      mockQuery.mockResolvedValueOnce([[], []]);

      await dispatchEventRepository.findByLoadId(LOAD_ID, COMPANY_A);

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("?");
      expect(sql).not.toContain(LOAD_ID);
      expect(sql).not.toContain(COMPANY_A);
      expect(params).toContain(LOAD_ID);
      expect(params).toContain(COMPANY_A);
    });

    it("orders events chronologically (created_at ASC)", async () => {
      mockQuery.mockResolvedValueOnce([[], []]);

      await dispatchEventRepository.findByLoadId(LOAD_ID, COMPANY_A);

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toMatch(/ORDER BY.*created_at\s+ASC/i);
    });

    it("returns empty array when no events exist for load", async () => {
      mockQuery.mockResolvedValueOnce([[], []]);

      const result = await dispatchEventRepository.findByLoadId(
        "nonexistent-load",
        COMPANY_A,
      );

      expect(result).toHaveLength(0);
    });
  });
});
