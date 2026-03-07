import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P2-03-AC1, R-P2-03-AC2

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

import { equipmentRepository } from "../../repositories/equipment.repository";

// --- Constants ---
const COMPANY_A = "company-aaa";
const COMPANY_B = "company-bbb";

const makeEquipmentRow = (overrides: Record<string, unknown> = {}) => ({
  id: "equip-001",
  company_id: COMPANY_A,
  unit_number: "TRK-100",
  type: "Truck",
  status: "Active",
  ownership_type: "Owned",
  provider_name: null,
  daily_cost: 150.0,
  maintenance_history: "[]",
  version: 1,
  assigned_load_id: null,
  ...overrides,
});

describe("R-P2-03: Equipment Repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConnection.mockResolvedValue(mockConnection);
  });

  describe("AC1: findById — tenant-scoped equipment lookup", () => {
    it("returns equipment when id and companyId match", async () => {
      const equipRow = makeEquipmentRow();
      mockQuery.mockResolvedValueOnce([[equipRow], []]);

      const result = await equipmentRepository.findById("equip-001", COMPANY_A);

      expect(result).not.toBeNull();
      expect(result!.id).toBe("equip-001");
      expect(result!.company_id).toBe(COMPANY_A);
    });

    it("returns null when equipment belongs to different tenant", async () => {
      mockQuery.mockResolvedValueOnce([[], []]);

      const result = await equipmentRepository.findById("equip-001", COMPANY_B);

      expect(result).toBeNull();

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("?");
      expect(params).toContain("equip-001");
      expect(params).toContain(COMPANY_B);
    });

    it("returns null when equipment does not exist", async () => {
      mockQuery.mockResolvedValueOnce([[], []]);

      const result = await equipmentRepository.findById(
        "nonexistent",
        COMPANY_A,
      );

      expect(result).toBeNull();
    });

    it("uses parameterized query (no string interpolation)", async () => {
      mockQuery.mockResolvedValueOnce([[], []]);

      await equipmentRepository.findById("equip-001", COMPANY_A);

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).not.toContain("equip-001");
      expect(sql).not.toContain(COMPANY_A);
      expect(sql).toContain("?");
      expect(params).toContain("equip-001");
      expect(params).toContain(COMPANY_A);
    });
  });

  describe("AC1: findByCompany — tenant-scoped listing", () => {
    it("returns all equipment for a company", async () => {
      const equipment = [
        makeEquipmentRow({ id: "equip-001" }),
        makeEquipmentRow({ id: "equip-002", unit_number: "TRL-200" }),
      ];
      mockQuery.mockResolvedValueOnce([equipment, []]);

      const result = await equipmentRepository.findByCompany(COMPANY_A);

      expect(result).toHaveLength(2);
    });

    it("returns empty array when company has no equipment", async () => {
      mockQuery.mockResolvedValueOnce([[], []]);

      const result = await equipmentRepository.findByCompany("company-empty");

      expect(result).toHaveLength(0);
    });
  });

  describe("AC2: assignToLoad — optimistic locking on equipment assignment", () => {
    it("assigns equipment to a load with version increment", async () => {
      // UPDATE returns 1 affected row (version matched)
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
      // Follow-up SELECT to return updated row
      mockQuery.mockResolvedValueOnce([
        [makeEquipmentRow({ assigned_load_id: "load-001", version: 2 })],
        [],
      ]);

      const result = await equipmentRepository.assignToLoad(
        "equip-001",
        "load-001",
        COMPANY_A,
        1, // expected version
      );

      expect(result).not.toBeNull();
      expect(result!.assigned_load_id).toBe("load-001");
      expect(result!.version).toBe(2);
    });

    it("returns null when version does not match (stale data)", async () => {
      // UPDATE returns 0 affected rows (version mismatch)
      mockExecute.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await equipmentRepository.assignToLoad(
        "equip-001",
        "load-001",
        COMPANY_A,
        1, // stale version
      );

      expect(result).toBeNull();
    });

    it("returns null when equipment belongs to different tenant", async () => {
      // UPDATE with wrong company_id returns 0 affected rows
      mockExecute.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await equipmentRepository.assignToLoad(
        "equip-001",
        "load-001",
        COMPANY_B,
        1,
      );

      expect(result).toBeNull();
    });

    it("uses parameterized query with version in WHERE clause", async () => {
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
      mockQuery.mockResolvedValueOnce([
        [makeEquipmentRow({ assigned_load_id: "load-001", version: 2 })],
        [],
      ]);

      await equipmentRepository.assignToLoad(
        "equip-001",
        "load-001",
        COMPANY_A,
        1,
      );

      const [sql, params] = mockExecute.mock.calls[0];
      expect(sql).toContain("version");
      expect(sql).toContain("WHERE");
      expect(sql).toContain("?");
      // Params must include version for WHERE clause
      expect(params).toContain(1); // expected version in WHERE
    });

    it("increments version in the UPDATE statement", async () => {
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
      mockQuery.mockResolvedValueOnce([[makeEquipmentRow({ version: 4 })], []]);

      await equipmentRepository.assignToLoad(
        "equip-001",
        "load-001",
        COMPANY_A,
        3,
      );

      const [sql, params] = mockExecute.mock.calls[0];
      expect(sql).toContain("version = version + 1");
    });
  });

  describe("AC2: unassignFromLoad — clear assignment with version check", () => {
    it("clears equipment assignment with version increment", async () => {
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
      mockQuery.mockResolvedValueOnce([
        [makeEquipmentRow({ assigned_load_id: null, version: 3 })],
        [],
      ]);

      const result = await equipmentRepository.unassignFromLoad(
        "equip-001",
        COMPANY_A,
        2,
      );

      expect(result).not.toBeNull();
      expect(result!.assigned_load_id).toBeNull();
    });

    it("returns null when version does not match", async () => {
      mockExecute.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await equipmentRepository.unassignFromLoad(
        "equip-001",
        COMPANY_A,
        99, // wrong version
      );

      expect(result).toBeNull();
    });
  });
});
