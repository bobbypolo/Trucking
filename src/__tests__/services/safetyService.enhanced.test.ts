import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock authService
vi.mock("../../../services/authService", () => ({
  getCompany: vi.fn(),
  updateCompany: vi.fn(),
  getStoredUsers: vi.fn().mockReturnValue([]),
  getAuthHeaders: vi.fn().mockResolvedValue({}),
  getCurrentUser: vi.fn(),
  updateUser: vi.fn(),
}));

// Mock storageService to avoid circular dependency + heavy deps
vi.mock("../../../services/storageService", () => ({
  getLoads: vi.fn().mockResolvedValue([]),
  getTenantKey: vi.fn((baseName: string) => {
    const user = (
      getCurrentUser as unknown as () => { companyId?: string } | null
    )();
    if (!user?.companyId) return `loadpilot_${baseName}`;
    return `loadpilot_${user.companyId}_${baseName}`;
  }),
}));

vi.mock("../../../services/firebase", () => ({
  storage: {},
  DEMO_MODE: false,
}));

import {
  getStoredQuizzes,
  getStoredResults,
  getStoredSafetyActivity,
  getMaintenanceRecords,
  getServiceTickets,
  getVendors,
  saveMaintenanceRecord,
  saveServiceTicket,
  saveVendor,
  logSafetyActivity,
  saveQuiz,
  saveQuizResult,
  checkDriverCompliance,
  getDriverQuizzes,
  getEquipment,
  getComplianceRecords,
  registerAsset,
  updateEquipmentStatus,
  seedSafetyData,
  calculateDriverPerformance,
} from "../../../services/safetyService";
import { getCurrentUser, getCompany, updateCompany } from "../../../services/authService";
import { getLoads } from "../../../services/storageService";

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;
const mockGetCompany = getCompany as ReturnType<typeof vi.fn>;
const mockUpdateCompany = updateCompany as ReturnType<typeof vi.fn>;
const mockGetLoads = getLoads as ReturnType<typeof vi.fn>;

describe("safetyService — enhanced coverage", () => {
  let localStorageMock: Record<string, string>;

  beforeEach(() => {
    localStorageMock = {};
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(
      (key: string) => localStorageMock[key] ?? null,
    );
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(
      (key: string, value: string) => {
        localStorageMock[key] = value;
      },
    );
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(
      (key: string) => {
        delete localStorageMock[key];
      },
    );
    mockGetCurrentUser.mockReturnValue({ companyId: "test-co" });
    vi.spyOn(globalThis, "fetch").mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Storage getters ─────────────────────────────────────────────────
  describe("storage getters", () => {
    it("getStoredQuizzes returns empty array when nothing stored", () => {
      expect(getStoredQuizzes()).toEqual([]);
    });

    it("getStoredResults returns empty array when nothing stored", () => {
      expect(getStoredResults()).toEqual([]);
    });

    it("getStoredSafetyActivity returns empty array when nothing stored", () => {
      expect(getStoredSafetyActivity()).toEqual([]);
    });

    it("getMaintenanceRecords returns empty array when nothing stored", () => {
      expect(getMaintenanceRecords()).toEqual([]);
    });

    it("getServiceTickets returns empty array when nothing stored", () => {
      expect(getServiceTickets()).toEqual([]);
    });

    it("getVendors returns empty array when nothing stored", () => {
      expect(getVendors()).toEqual([]);
    });

    it("safeParse returns fallback for corrupted data", () => {
      localStorageMock["loadpilot_test-co_quizzes_v1"] = "not-json";
      expect(getStoredQuizzes()).toEqual([]);
    });
  });

  // ─── saveMaintenanceRecord ───────────────────────────────────────────
  describe("saveMaintenanceRecord", () => {
    it("adds record to front of list", () => {
      const record = {
        id: "mr-1",
        equipmentId: "eq-1",
        type: "Preventive",
        description: "Oil change",
        date: "2026-03-15",
        cost: 150,
        performedBy: "Mechanic",
      } as any;

      saveMaintenanceRecord(record);

      const key = Object.keys(localStorageMock).find((k) =>
        k.includes("maintenance"),
      );
      expect(key).toBeTruthy();
      const stored = JSON.parse(localStorageMock[key!]);
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe("mr-1");
    });

    it("prepends new records (most recent first)", () => {
      saveMaintenanceRecord({ id: "mr-1" } as any);
      saveMaintenanceRecord({ id: "mr-2" } as any);

      const key = Object.keys(localStorageMock).find((k) =>
        k.includes("maintenance"),
      );
      const stored = JSON.parse(localStorageMock[key!]);
      expect(stored[0].id).toBe("mr-2"); // most recent first
      expect(stored[1].id).toBe("mr-1");
    });
  });

  // ─── saveServiceTicket ───────────────────────────────────────────────
  describe("saveServiceTicket", () => {
    it("creates new ticket", () => {
      saveServiceTicket({ id: "st-1", title: "Fix brakes" } as any);

      const key = Object.keys(localStorageMock).find((k) =>
        k.includes("service_tickets"),
      );
      const stored = JSON.parse(localStorageMock[key!]);
      expect(stored).toHaveLength(1);
      expect(stored[0].title).toBe("Fix brakes");
    });

    it("updates existing ticket by id", () => {
      saveServiceTicket({ id: "st-1", title: "Fix brakes" } as any);
      saveServiceTicket({ id: "st-1", title: "Fix brakes - URGENT" } as any);

      const key = Object.keys(localStorageMock).find((k) =>
        k.includes("service_tickets"),
      );
      const stored = JSON.parse(localStorageMock[key!]);
      expect(stored).toHaveLength(1);
      expect(stored[0].title).toBe("Fix brakes - URGENT");
    });
  });

  // ─── saveVendor ──────────────────────────────────────────────────────
  describe("saveVendor", () => {
    it("creates new vendor", () => {
      saveVendor({ id: "v-1", name: "AutoParts Inc" } as any);

      const key = Object.keys(localStorageMock).find((k) =>
        k.includes("vendors"),
      );
      const stored = JSON.parse(localStorageMock[key!]);
      expect(stored).toHaveLength(1);
      expect(stored[0].name).toBe("AutoParts Inc");
    });

    it("updates existing vendor by id", () => {
      saveVendor({ id: "v-1", name: "Old Name" } as any);
      saveVendor({ id: "v-1", name: "New Name" } as any);

      const key = Object.keys(localStorageMock).find((k) =>
        k.includes("vendors"),
      );
      const stored = JSON.parse(localStorageMock[key!]);
      expect(stored).toHaveLength(1);
      expect(stored[0].name).toBe("New Name");
    });
  });

  // ─── logSafetyActivity ───────────────────────────────────────────────
  describe("logSafetyActivity", () => {
    it("logs an activity entry", () => {
      logSafetyActivity("Test event", "Status", "admin");

      const key = Object.keys(localStorageMock).find((k) =>
        k.includes("safety_activity"),
      );
      const stored = JSON.parse(localStorageMock[key!]);
      expect(stored).toHaveLength(1);
      expect(stored[0].message).toBe("Test event");
      expect(stored[0].type).toBe("Status");
      expect(stored[0].user).toBe("admin");
    });

    it("prepends new entries (most recent first)", () => {
      logSafetyActivity("First", "Alert");
      logSafetyActivity("Second", "Notification");

      const key = Object.keys(localStorageMock).find((k) =>
        k.includes("safety_activity"),
      );
      const stored = JSON.parse(localStorageMock[key!]);
      expect(stored[0].message).toBe("Second");
    });

    it("limits log to 50 entries", () => {
      for (let i = 0; i < 55; i++) {
        logSafetyActivity(`Event ${i}`, "Status");
      }

      const key = Object.keys(localStorageMock).find((k) =>
        k.includes("safety_activity"),
      );
      const stored = JSON.parse(localStorageMock[key!]);
      expect(stored.length).toBeLessThanOrEqual(50);
    });
  });

  // ─── saveQuizResult ──────────────────────────────────────────────────
  describe("saveQuizResult", () => {
    it("appends quiz result", () => {
      saveQuizResult({
        quizId: "q1",
        driverId: "d1",
        passed: true,
        score: 90,
        completedAt: "2026-03-15",
      } as any);

      const key = Object.keys(localStorageMock).find((k) =>
        k.includes("quiz_results"),
      );
      const stored = JSON.parse(localStorageMock[key!]);
      expect(stored).toHaveLength(1);
      expect(stored[0].passed).toBe(true);
    });
  });

  // ─── checkDriverCompliance ───────────────────────────────────────────
  describe("checkDriverCompliance", () => {
    it("returns compliant for driver with no requirements", () => {
      const user = { id: "d1", safetyScore: 100, restricted: false } as any;
      const result = checkDriverCompliance(user);
      expect(result.isCompliant).toBe(true);
      expect(result.blockingReasons).toHaveLength(0);
      expect(result.safetyScore).toBe(100);
    });

    it("blocks driver with incomplete mandatory quiz", () => {
      // Store mandatory quiz
      saveQuiz({
        id: "q1",
        title: "Hazmat Safety",
        isMandatory: true,
        assignedTo: ["all"],
        createdAt: "2026-03-01",
        questions: [],
      } as any);

      const user = { id: "d1", safetyScore: 100, restricted: false } as any;
      const result = checkDriverCompliance(user);
      expect(result.isCompliant).toBe(false);
      expect(result.blockingReasons).toContain("Training: Hazmat Safety Required");
      expect(result.safetyScore).toBe(90); // -10 for missing quiz
    });

    it("passes driver who completed mandatory quiz", () => {
      saveQuiz({
        id: "q1",
        title: "Safety 101",
        isMandatory: true,
        assignedTo: ["d1"],
        createdAt: "2026-03-01",
        questions: [],
      } as any);

      saveQuizResult({
        quizId: "q1",
        driverId: "d1",
        passed: true,
        score: 85,
        completedAt: "2026-03-10",
      } as any);

      const user = { id: "d1", safetyScore: 100, restricted: false } as any;
      const result = checkDriverCompliance(user);
      expect(result.isCompliant).toBe(true);
    });

    it("blocks driver with expired compliance record", () => {
      const user = {
        id: "d1",
        safetyScore: 100,
        restricted: false,
        complianceChecklist: [
          { type: "CDL", status: "Expired", isMandatory: true },
        ],
      } as any;
      const result = checkDriverCompliance(user);
      expect(result.isCompliant).toBe(false);
      expect(result.blockingReasons).toContain("Compliance: CDL Expired");
      expect(result.safetyScore).toBe(85); // -15 for expired doc
    });

    it("blocks driver with failed compliance record", () => {
      const user = {
        id: "d1",
        safetyScore: 100,
        restricted: false,
        complianceChecklist: [
          { type: "Drug Test", status: "Failed", isMandatory: true },
        ],
      } as any;
      const result = checkDriverCompliance(user);
      expect(result.isCompliant).toBe(false);
      expect(result.blockingReasons).toContain("Compliance: Drug Test Failed");
    });

    it("ignores non-mandatory compliance records", () => {
      const user = {
        id: "d1",
        safetyScore: 100,
        restricted: false,
        complianceChecklist: [
          { type: "First Aid", status: "Expired", isMandatory: false },
        ],
      } as any;
      const result = checkDriverCompliance(user);
      expect(result.isCompliant).toBe(true);
    });

    it("blocks restricted driver", () => {
      const user = {
        id: "d1",
        safetyScore: 100,
        restricted: true,
        restrictionReason: "Suspended license",
      } as any;
      const result = checkDriverCompliance(user);
      expect(result.isCompliant).toBe(false);
      expect(result.blockingReasons).toContain("Suspended license");
      expect(result.safetyScore).toBeLessThanOrEqual(50);
    });

    it("uses default restriction reason when none provided", () => {
      const user = {
        id: "d1",
        safetyScore: 100,
        restricted: true,
      } as any;
      const result = checkDriverCompliance(user);
      expect(result.blockingReasons).toContain("Administrative Lockout");
    });

    it("safetyScore never goes below 0", () => {
      // Multiple deductions to push below 0
      saveQuiz({
        id: "q1",
        title: "Quiz 1",
        isMandatory: true,
        assignedTo: ["all"],
        createdAt: "2026-03-01",
        questions: [],
      } as any);
      saveQuiz({
        id: "q2",
        title: "Quiz 2",
        isMandatory: true,
        assignedTo: ["all"],
        createdAt: "2026-03-01",
        questions: [],
      } as any);

      const user = {
        id: "d1",
        safetyScore: 15, // low starting score
        restricted: false,
        complianceChecklist: [
          { type: "CDL", status: "Expired", isMandatory: true },
        ],
      } as any;
      const result = checkDriverCompliance(user);
      expect(result.safetyScore).toBeGreaterThanOrEqual(0);
    });

    it("uses default safetyScore of 100 when not set", () => {
      const user = { id: "d1", restricted: false } as any;
      const result = checkDriverCompliance(user);
      expect(result.safetyScore).toBe(100);
    });
  });

  // ─── getDriverQuizzes ────────────────────────────────────────────────
  describe("getDriverQuizzes", () => {
    it("returns empty array when no quizzes exist", () => {
      const result = getDriverQuizzes("d1");
      expect(result).toEqual([]);
    });

    it("returns quizzes assigned to driver with Pending status", () => {
      saveQuiz({
        id: "q1",
        title: "Safety Quiz",
        isMandatory: true,
        assignedTo: ["d1"],
        createdAt: "2026-03-01",
        questions: [],
      } as any);

      const result = getDriverQuizzes("d1");
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("Pending");
    });

    it("shows Passed status when driver passed the quiz", () => {
      saveQuiz({
        id: "q1",
        title: "Safety Quiz",
        isMandatory: true,
        assignedTo: ["d1"],
        createdAt: "2026-03-01",
        questions: [],
      } as any);

      saveQuizResult({
        quizId: "q1",
        driverId: "d1",
        passed: true,
        score: 95,
        completedAt: "2026-03-10",
      } as any);

      const result = getDriverQuizzes("d1");
      expect(result[0].status).toBe("Passed");
      expect(result[0].score).toBe(95);
    });

    it("shows Failed status when driver failed the quiz", () => {
      saveQuiz({
        id: "q1",
        title: "Safety Quiz",
        isMandatory: true,
        assignedTo: ["d1"],
        createdAt: "2026-03-01",
        questions: [],
      } as any);

      saveQuizResult({
        quizId: "q1",
        driverId: "d1",
        passed: false,
        score: 40,
        completedAt: "2026-03-10",
      } as any);

      const result = getDriverQuizzes("d1");
      expect(result[0].status).toBe("Failed");
    });

    it("includes quizzes assigned to 'all'", () => {
      saveQuiz({
        id: "q1",
        title: "Universal Quiz",
        isMandatory: false,
        assignedTo: ["all"],
        createdAt: "2026-03-01",
        questions: [],
      } as any);

      const result = getDriverQuizzes("any-driver");
      expect(result).toHaveLength(1);
    });

    it("excludes quizzes not assigned to driver", () => {
      saveQuiz({
        id: "q1",
        title: "Other Driver Quiz",
        isMandatory: true,
        assignedTo: ["d2"],
        createdAt: "2026-03-01",
        questions: [],
      } as any);

      const result = getDriverQuizzes("d1");
      expect(result).toHaveLength(0);
    });
  });

  // ─── calculateDriverPerformance ──────────────────────────────────────
  describe("calculateDriverPerformance", () => {
    it("returns Elite grade for driver with 100% scores", async () => {
      const user = { id: "d1", companyId: "c1", safetyScore: 100, restricted: false } as any;
      mockGetCompany.mockResolvedValue({
        scoringConfig: {
          minimumDispatchScore: 75,
          weights: { safety: 0.5, onTime: 0.3, paperwork: 0.2 },
        },
      });
      mockGetLoads.mockResolvedValue([]);

      const perf = await calculateDriverPerformance(user);
      expect(perf.driverId).toBe("d1");
      // No loads = 100% on all metrics
      expect(perf.totalScore).toBe(100);
      expect(perf.grade).toBe("Elite");
      expect(perf.status).toBe("Ready");
    });

    it("returns At Risk grade for driver below minimum score", async () => {
      const user = {
        id: "d1",
        companyId: "c1",
        safetyScore: 30,
        restricted: true,
        restrictionReason: "Multiple violations",
      } as any;
      mockGetCompany.mockResolvedValue({
        scoringConfig: {
          minimumDispatchScore: 75,
          weights: { safety: 0.5, onTime: 0.3, paperwork: 0.2 },
        },
      });
      mockGetLoads.mockResolvedValue([
        {
          driverId: "d1",
          status: "delivered",
          issues: [
            { category: "Dispatch", description: "Late delivery" },
          ],
        },
      ]);

      const perf = await calculateDriverPerformance(user);
      expect(perf.grade).toBe("At Risk");
      expect(perf.status).toBe("Blocked");
    });

    it("counts on-time and paperwork metrics", async () => {
      const user = { id: "d1", companyId: "c1", safetyScore: 100, restricted: false } as any;
      mockGetCompany.mockResolvedValue(null); // Uses defaults
      mockGetLoads.mockResolvedValue([
        { driverId: "d1", status: "delivered", bolNumber: "BOL-1", issues: [] },
        { driverId: "d1", status: "delivered", bolNumber: "", bolUrls: [], issues: [{ category: "Dispatch", description: "late" }] },
      ]);

      const perf = await calculateDriverPerformance(user);
      expect(perf.metrics.loadCount).toBe(2);
      expect(perf.metrics.onTimeRate).toBe(50); // 1 out of 2
      expect(perf.metrics.paperworkScore).toBe(50); // 1 out of 2
    });
  });

  // ─── getEquipment ────────────────────────────────────────────────────
  describe("getEquipment", () => {
    it("fetches equipment from API", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        json: () => Promise.resolve([{ id: "eq-1", type: "Truck" }]),
      } as any);

      const equipment = await getEquipment("c1");
      expect(equipment).toHaveLength(1);
    });

    it("returns empty array on API failure", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
      const equipment = await getEquipment("c1");
      expect(equipment).toEqual([]);
    });
  });

  // ─── getComplianceRecords ────────────────────────────────────────────
  describe("getComplianceRecords", () => {
    it("fetches compliance records from API", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        json: () => Promise.resolve([{ id: "cr-1" }]),
      } as any);

      const records = await getComplianceRecords("u1");
      expect(records).toHaveLength(1);
    });

    it("returns empty array on API failure", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
      const records = await getComplianceRecords("u1");
      expect(records).toEqual([]);
    });
  });

  // ─── registerAsset ───────────────────────────────────────────────────
  describe("registerAsset", () => {
    beforeEach(() => {
      mockGetCompany.mockReset();
      mockUpdateCompany.mockClear();
    });

    it("adds asset to company equipment registry", async () => {
      mockGetCompany.mockResolvedValue({
        id: "c1",
        name: "Test Co",
        equipmentRegistry: [],
      });

      const asset = { id: "eq-1", type: "Truck" } as any;
      const user = { name: "Admin" } as any;

      await registerAsset("c1", asset, user);

      expect(mockUpdateCompany).toHaveBeenCalledTimes(1);
      const updatedCompany = mockUpdateCompany.mock.calls[0][0];
      expect(updatedCompany.equipmentRegistry).toHaveLength(1);
      expect(updatedCompany.equipmentRegistry[0].addedBy).toBe("Admin");
    });

    it("does nothing when company not found", async () => {
      mockGetCompany.mockResolvedValue(null);

      await registerAsset("nonexistent", { id: "eq-1" } as any, { name: "Admin" } as any);

      expect(mockUpdateCompany).not.toHaveBeenCalled();
    });
  });

  // ─── updateEquipmentStatus ───────────────────────────────────────────
  describe("updateEquipmentStatus", () => {
    beforeEach(() => {
      mockUpdateCompany.mockClear();
    });

    it("updates existing equipment status", () => {
      const company = {
        id: "c1",
        equipmentRegistry: [
          { id: "eq-1", type: "Truck", status: "Active", location: "Chicago" },
        ],
      } as any;

      updateEquipmentStatus(
        company,
        "eq-1",
        "Truck",
        "Out of Service",
        { name: "Admin" } as any,
        "Engine issues",
        "Shop",
      );

      expect(mockUpdateCompany).toHaveBeenCalledTimes(1);
      const updated = mockUpdateCompany.mock.calls[0][0];
      expect(updated.equipmentRegistry[0].status).toBe("Out of Service");
      expect(updated.equipmentRegistry[0].location).toBe("Shop");
    });

    it("adds new equipment when id not found", () => {
      const company = {
        id: "c1",
        equipmentRegistry: [],
      } as any;

      updateEquipmentStatus(
        company,
        "eq-new",
        "Trailer",
        "Active",
        { name: "Admin" } as any,
        "New trailer added",
        "Yard",
      );

      expect(mockUpdateCompany).toHaveBeenCalledTimes(1);
      const updated = mockUpdateCompany.mock.calls[0][0];
      expect(updated.equipmentRegistry).toHaveLength(1);
      expect(updated.equipmentRegistry[0].id).toBe("eq-new");
      expect(updated.equipmentRegistry[0].type).toBe("Trailer");
      expect(updated.equipmentRegistry[0].ownershipType).toBe("Company Owned");
    });

    it("handles undefined equipmentRegistry", () => {
      const company = { id: "c1" } as any;

      updateEquipmentStatus(
        company,
        "eq-1",
        "Chassis",
        "Active",
        { name: "Admin" } as any,
        "New chassis",
        "Terminal",
      );

      expect(mockUpdateCompany).toHaveBeenCalledTimes(1);
      const updated = mockUpdateCompany.mock.calls[0][0];
      expect(updated.equipmentRegistry).toHaveLength(1);
    });
  });

  // ─── seedSafetyData ──────────────────────────────────────────────────
  describe("seedSafetyData", () => {
    it("is a no-op (deprecated)", () => {
      // Should not throw and do nothing
      expect(() => seedSafetyData()).not.toThrow();
      expect(() => seedSafetyData(true)).not.toThrow();
    });
  });
});
