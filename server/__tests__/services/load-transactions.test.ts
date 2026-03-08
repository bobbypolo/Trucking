import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P2-07-AC1, R-P2-07-AC4, R-P2-07-AC5

// --- Mock setup (hoisted so vi.mock factory can reference them) ---
const {
  mockQuery,
  mockExecute,
  mockBeginTransaction,
  mockCommit,
  mockRollback,
  mockRelease,
  mockGetConnection,
  mockConnection,
} = vi.hoisted(() => {
  const mockQuery = vi.fn();
  const mockExecute = vi.fn();
  const mockBeginTransaction = vi.fn().mockResolvedValue(undefined);
  const mockCommit = vi.fn().mockResolvedValue(undefined);
  const mockRollback = vi.fn().mockResolvedValue(undefined);
  const mockRelease = vi.fn();
  const mockGetConnection = vi.fn();

  const mockConnection = {
    beginTransaction: mockBeginTransaction,
    commit: mockCommit,
    rollback: mockRollback,
    release: mockRelease,
    query: mockQuery,
    execute: mockExecute,
  };

  return {
    mockQuery,
    mockExecute,
    mockBeginTransaction,
    mockCommit,
    mockRollback,
    mockRelease,
    mockGetConnection,
    mockConnection,
  };
});

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
    execute: mockExecute,
    getConnection: mockGetConnection,
  },
}));

import { loadService } from "../../services/load.service";
import { LoadStatus } from "../../services/load-state-machine";
import { ConflictError, NotFoundError } from "../../errors/AppError";

// --- Constants ---
const COMPANY_A = "company-aaa";
const USER_ID = "user-001";

const makeLoadRow = (overrides: Record<string, unknown> = {}) => ({
  id: "load-001",
  company_id: COMPANY_A,
  customer_id: "cust-1",
  driver_id: "driver-1",
  dispatcher_id: "disp-1",
  load_number: "LD-001",
  status: "draft",
  carrier_rate: 1500,
  driver_pay: 800,
  pickup_date: "2026-03-10",
  freight_type: "Dry Van",
  commodity: "Electronics",
  weight: 42000,
  container_number: null,
  container_size: null,
  chassis_number: null,
  chassis_provider: null,
  bol_number: "BOL-001",
  notification_emails: "[]",
  contract_id: null,
  gps_history: "[]",
  pod_urls: "[]",
  customer_user_id: null,
  created_at: "2026-03-07T00:00:00.000Z",
  version: 1,
  ...overrides,
});

const makeStopRow = (overrides: Record<string, unknown> = {}) => ({
  id: "stop-001",
  load_id: "load-001",
  type: "Pickup",
  facility_name: "Warehouse A",
  city: "Chicago",
  state: "IL",
  date: "2026-03-10",
  appointment_time: "08:00",
  completed: false,
  sequence_order: 0,
  ...overrides,
});

describe("R-P2-07: Transaction Safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConnection.mockResolvedValue(mockConnection);
  });

  describe("AC1: Atomic transaction — load+stops creation is atomic", () => {
    it("load creation uses beginTransaction, commit, and release", async () => {
      // The loadRepository.create already wraps in a transaction.
      // We import it directly to test.
      const { loadRepository } =
        await import("../../repositories/load.repository");

      // Mock: INSERT load
      mockQuery.mockResolvedValueOnce([{ insertId: 0, affectedRows: 1 }, []]);
      // Mock: INSERT stop 1
      mockQuery.mockResolvedValueOnce([{ insertId: 0, affectedRows: 1 }, []]);
      // Mock: INSERT stop 2
      mockQuery.mockResolvedValueOnce([{ insertId: 0, affectedRows: 1 }, []]);

      const result = await loadRepository.create(
        {
          load_number: "LD-001",
          status: "draft",
        },
        [
          { type: "Pickup", city: "Chicago", state: "IL" },
          { type: "Dropoff", city: "Dallas", state: "TX" },
        ],
        COMPANY_A,
      );

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(mockGetConnection).toHaveBeenCalledOnce();
      expect(mockBeginTransaction).toHaveBeenCalledOnce();
      expect(mockCommit).toHaveBeenCalledOnce();
      expect(mockRollback).not.toHaveBeenCalled();
      expect(mockRelease).toHaveBeenCalledOnce();
    });

    it("load creation rolls back if stop INSERT fails", async () => {
      const { loadRepository } =
        await import("../../repositories/load.repository");

      // Mock: INSERT load succeeds
      mockQuery.mockResolvedValueOnce([{ insertId: 0, affectedRows: 1 }, []]);
      // Mock: INSERT first stop fails
      mockQuery.mockRejectedValueOnce(new Error("FK constraint violation"));

      await expect(
        loadRepository.create(
          { load_number: "LD-002", status: "draft" },
          [{ type: "Pickup", city: "Chicago", state: "IL" }],
          COMPANY_A,
        ),
      ).rejects.toThrow("FK constraint violation");

      expect(mockRollback).toHaveBeenCalledOnce();
      expect(mockCommit).not.toHaveBeenCalled();
      expect(mockRelease).toHaveBeenCalledOnce();
    });
  });

  describe("AC1: Atomic transaction — status transition+event is atomic", () => {
    it("status transition wraps UPDATE and INSERT in a single transaction", async () => {
      mockQuery.mockResolvedValueOnce([
        [makeLoadRow({ status: "draft", version: 1 })],
        [],
      ]);
      mockQuery.mockResolvedValueOnce([
        [
          makeStopRow({ type: "Pickup" }),
          makeStopRow({ id: "stop-002", type: "Dropoff", sequence_order: 1 }),
        ],
        [],
      ]);
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1, insertId: 0 }, []]);

      const result = await loadService.transitionLoad(
        "load-001",
        LoadStatus.PLANNED,
        COMPANY_A,
        USER_ID,
      );

      expect(result).toBeDefined();
      expect(mockGetConnection).toHaveBeenCalledOnce();
      expect(mockBeginTransaction).toHaveBeenCalledOnce();
      expect(mockCommit).toHaveBeenCalledOnce();
      expect(mockRelease).toHaveBeenCalledOnce();
    });
  });

  describe("AC4: Optimistic locking — concurrent update with stale version returns 409", () => {
    it("stale version on load status transition returns ConflictError (409)", async () => {
      mockQuery.mockResolvedValueOnce([
        [makeLoadRow({ status: "draft", version: 3 })],
        [],
      ]);
      mockQuery.mockResolvedValueOnce([
        [
          makeStopRow({ type: "Pickup" }),
          makeStopRow({ id: "stop-002", type: "Dropoff", sequence_order: 1 }),
        ],
        [],
      ]);
      // UPDATE returns 0 affected rows => stale version
      mockExecute.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      try {
        await loadService.transitionLoad(
          "load-001",
          LoadStatus.PLANNED,
          COMPANY_A,
          USER_ID,
        );
        expect.unreachable("Should have thrown ConflictError");
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictError);
        expect((err as ConflictError).statusCode).toBe(409);
        expect((err as Error).message).toMatch(/version conflict/i);
      }

      expect(mockRollback).toHaveBeenCalledOnce();
      expect(mockCommit).not.toHaveBeenCalled();
    });

    it("optimistic locking uses version in WHERE clause for load updates", async () => {
      mockQuery.mockResolvedValueOnce([
        [makeLoadRow({ status: "draft", version: 7 })],
        [],
      ]);
      mockQuery.mockResolvedValueOnce([
        [
          makeStopRow({ type: "Pickup" }),
          makeStopRow({ id: "stop-002", type: "Dropoff", sequence_order: 1 }),
        ],
        [],
      ]);
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1, insertId: 0 }, []]);

      await loadService.transitionLoad(
        "load-001",
        LoadStatus.PLANNED,
        COMPANY_A,
        USER_ID,
      );

      // Verify the UPDATE SQL uses version
      const updateCall = mockExecute.mock.calls[0];
      const updateSql = updateCall[0] as string;
      const updateParams = updateCall[1] as unknown[];

      expect(updateSql).toContain("version");
      expect(updateSql).toContain("WHERE");
      // Should include old version in WHERE and new version in SET
      expect(updateParams).toContain(7); // old version in WHERE
      expect(updateParams).toContain(8); // new version in SET
    });
  });

  describe("AC5: Transaction rollback — failure after load update but before event write", () => {
    it("rolls back load status change when event write fails mid-transaction", async () => {
      mockQuery.mockResolvedValueOnce([
        [makeLoadRow({ status: "draft", version: 1 })],
        [],
      ]);
      mockQuery.mockResolvedValueOnce([
        [
          makeStopRow({ type: "Pickup" }),
          makeStopRow({ id: "stop-002", type: "Dropoff", sequence_order: 1 }),
        ],
        [],
      ]);

      // UPDATE loads succeeds (load status changed)
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
      // INSERT dispatch_event FAILS (simulating mid-transaction failure)
      mockExecute.mockRejectedValueOnce(
        new Error("Injected failure: connection lost after load update"),
      );

      await expect(
        loadService.transitionLoad(
          "load-001",
          LoadStatus.PLANNED,
          COMPANY_A,
          USER_ID,
        ),
      ).rejects.toThrow("Injected failure: connection lost after load update");

      // Transaction must be rolled back — load should be unchanged
      expect(mockRollback).toHaveBeenCalledOnce();
      expect(mockCommit).not.toHaveBeenCalled();
      expect(mockRelease).toHaveBeenCalledOnce();
    });

    it("connection is always released even after rollback", async () => {
      mockQuery.mockResolvedValueOnce([
        [makeLoadRow({ status: "draft", version: 1 })],
        [],
      ]);
      mockQuery.mockResolvedValueOnce([
        [
          makeStopRow({ type: "Pickup" }),
          makeStopRow({ id: "stop-002", type: "Dropoff", sequence_order: 1 }),
        ],
        [],
      ]);

      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
      mockExecute.mockRejectedValueOnce(new Error("DB connection reset"));

      try {
        await loadService.transitionLoad(
          "load-001",
          LoadStatus.PLANNED,
          COMPANY_A,
          USER_ID,
        );
      } catch {
        // Expected
      }

      // Finally block must always release
      expect(mockRelease).toHaveBeenCalledOnce();
    });
  });
});
