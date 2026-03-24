// Tests R-P1-18, R-P1-19, R-P1-20
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the api module
const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock("../../../services/api", () => ({
  api: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    patch: vi.fn(),
    delete: vi.fn(),
    postFormData: vi.fn(),
  },
}));

// Mock authService
vi.mock("../../../services/authService", () => ({
  getCompany: vi.fn(),
  updateCompany: vi.fn(),
  getStoredUsers: vi.fn().mockReturnValue([]),
  getAuthHeaders: vi.fn().mockResolvedValue({
    "Content-Type": "application/json",
    Authorization: "Bearer test-token",
  }),
  getCurrentUser: vi.fn(),
  updateUser: vi.fn(),
}));

// Mock storageService to avoid circular dependency + heavy deps
vi.mock("../../../services/storageService", () => ({
  getLoads: vi.fn().mockResolvedValue([]),
  getTenantKey: vi.fn((baseName: string) => `loadpilot_${baseName}`),
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
import {
  getCurrentUser,
  getCompany,
  updateCompany,
} from "../../../services/authService";
import { getLoads } from "../../../services/storageService";

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;
const mockGetCompany = getCompany as ReturnType<typeof vi.fn>;
const mockUpdateCompany = updateCompany as ReturnType<typeof vi.fn>;
const mockGetLoads = getLoads as ReturnType<typeof vi.fn>;

// Helper to set api.get to return data (simulates success)
function mockApiGet(data: unknown) {
  mockGet.mockResolvedValue(data);
}

// Helper to set api.get to throw (simulates network/API error)
function mockApiGetFail() {
  mockGet.mockRejectedValue(new Error("network error"));
}

// Helper to set api.post to return data (simulates success)
function mockApiPost(data: unknown) {
  mockPost.mockResolvedValue(data);
}

// Helper to set api.post to throw (simulates network/API error)
function mockApiPostFail() {
  mockPost.mockRejectedValue(new Error("network error"));
}

describe("safetyService — enhanced coverage (API-based)", () => {
  beforeEach(() => {
    mockGetCurrentUser.mockReturnValue({ companyId: "test-co" });
    mockGet.mockReset();
    mockPost.mockReset();
  });

  // --- Storage getters ---
  describe("storage getters", () => {
    it("getStoredQuizzes returns empty array on network failure", async () => {
      mockApiGetFail();
      expect(await getStoredQuizzes()).toEqual([]);
    });

    it("getStoredResults returns empty array on network failure", async () => {
      mockApiGetFail();
      expect(await getStoredResults()).toEqual([]);
    });

    it("getStoredSafetyActivity returns empty array on network failure", async () => {
      mockApiGetFail();
      expect(await getStoredSafetyActivity()).toEqual([]);
    });

    it("getMaintenanceRecords returns empty array on network failure", async () => {
      mockApiGetFail();
      expect(await getMaintenanceRecords()).toEqual([]);
    });

    it("getServiceTickets returns empty array on network failure", async () => {
      mockApiGetFail();
      expect(await getServiceTickets()).toEqual([]);
    });

    it("getVendors returns empty array on network failure", async () => {
      mockApiGetFail();
      expect(await getVendors()).toEqual([]);
    });

    it("getStoredQuizzes returns data from API", async () => {
      mockApiGet([{ id: "q1", title: "Test" }]);
      const result = await getStoredQuizzes();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("q1");
    });

    it("getStoredResults returns empty array when API throws", async () => {
      mockApiGetFail();
      expect(await getStoredResults()).toEqual([]);
    });
  });

  // --- saveMaintenanceRecord ---
  describe("saveMaintenanceRecord", () => {
    it("POSTs record to /api/safety/maintenance", async () => {
      mockApiPost({ id: "mr-1" });

      const record = {
        id: "mr-1",
        equipmentId: "eq-1",
        type: "Preventive",
        description: "Oil change",
        date: "2026-03-15",
        cost: 150,
        performedBy: "Mechanic",
      } as any;

      await saveMaintenanceRecord(record);

      expect(mockPost).toHaveBeenCalledWith("/safety/maintenance", record);
    });

    it("does not throw on network failure", async () => {
      mockApiPostFail();
      await expect(
        saveMaintenanceRecord({ id: "mr-1" } as any),
      ).resolves.not.toThrow();
    });
  });

  // --- saveServiceTicket ---
  describe("saveServiceTicket", () => {
    it("POSTs ticket to /api/safety/service-tickets", async () => {
      mockApiPost({ id: "st-1" });

      await saveServiceTicket({ id: "st-1", title: "Fix brakes" } as any);

      expect(mockPost).toHaveBeenCalledWith(
        "/safety/service-tickets",
        expect.objectContaining({ id: "st-1" }),
      );
    });

    it("does not throw on network failure", async () => {
      mockApiPostFail();
      await expect(
        saveServiceTicket({ id: "st-1" } as any),
      ).resolves.not.toThrow();
    });
  });

  // --- saveVendor ---
  describe("saveVendor", () => {
    it("POSTs vendor to /api/safety/vendors", async () => {
      mockApiPost({ id: "v-1" });

      await saveVendor({ id: "v-1", name: "AutoParts Inc" } as any);

      expect(mockPost).toHaveBeenCalledWith(
        "/safety/vendors",
        expect.objectContaining({ id: "v-1" }),
      );
    });

    it("does not throw on network failure", async () => {
      mockApiPostFail();
      await expect(saveVendor({ id: "v-1" } as any)).resolves.not.toThrow();
    });
  });

  // --- logSafetyActivity ---
  describe("logSafetyActivity", () => {
    it("POSTs to /api/safety/activity", async () => {
      mockApiPost({ id: "act-1" });

      await logSafetyActivity("Test event", "Status", "admin");

      expect(mockPost).toHaveBeenCalledWith("/safety/activity", {
        action: "Test event",
        entity_type: "Status",
        actor: "admin",
      });
    });

    it("does not throw on network failure", async () => {
      mockApiPostFail();
      await expect(logSafetyActivity("Event", "Alert")).resolves.not.toThrow();
    });
  });

  // --- saveQuizResult ---
  describe("saveQuizResult", () => {
    it("POSTs to /api/safety/quiz-results", async () => {
      mockApiPost({ id: "qr-1" });

      await saveQuizResult({
        quizId: "q1",
        driverId: "d1",
        passed: true,
        score: 90,
        completedAt: "2026-03-15",
      } as any);

      expect(mockPost).toHaveBeenCalledWith(
        "/safety/quiz-results",
        expect.objectContaining({ quizId: "q1", driverId: "d1" }),
      );
    });
  });

  // --- checkDriverCompliance ---
  describe("checkDriverCompliance", () => {
    it("returns compliant for driver with no requirements", () => {
      const user = { id: "d1", safetyScore: 100, restricted: false } as any;
      const result = checkDriverCompliance(user, [], []);
      expect(result.isCompliant).toBe(true);
      expect(result.blockingReasons).toHaveLength(0);
      expect(result.safetyScore).toBe(100);
    });

    it("blocks driver with incomplete mandatory quiz", () => {
      const quizzes = [
        {
          id: "q1",
          title: "Hazmat Safety",
          isMandatory: true,
          assignedTo: ["all"],
          createdAt: "2026-03-01",
          questions: [],
        },
      ] as any[];

      const user = { id: "d1", safetyScore: 100, restricted: false } as any;
      const result = checkDriverCompliance(user, quizzes, []);
      expect(result.isCompliant).toBe(false);
      expect(result.blockingReasons).toContain(
        "Training: Hazmat Safety Required",
      );
      expect(result.safetyScore).toBe(90); // -10 for missing quiz
    });

    it("passes driver who completed mandatory quiz", () => {
      const quizzes = [
        {
          id: "q1",
          title: "Safety 101",
          isMandatory: true,
          assignedTo: ["d1"],
          createdAt: "2026-03-01",
          questions: [],
        },
      ] as any[];

      const results = [
        {
          quizId: "q1",
          driverId: "d1",
          passed: true,
          score: 85,
          completedAt: "2026-03-10",
        },
      ] as any[];

      const user = { id: "d1", safetyScore: 100, restricted: false } as any;
      const result = checkDriverCompliance(user, quizzes, results);
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
      const result = checkDriverCompliance(user, [], []);
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
      const result = checkDriverCompliance(user, [], []);
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
      const result = checkDriverCompliance(user, [], []);
      expect(result.isCompliant).toBe(true);
    });

    it("blocks restricted driver", () => {
      const user = {
        id: "d1",
        safetyScore: 100,
        restricted: true,
        restrictionReason: "Suspended license",
      } as any;
      const result = checkDriverCompliance(user, [], []);
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
      const result = checkDriverCompliance(user, [], []);
      expect(result.blockingReasons).toContain("Administrative Lockout");
    });

    it("safetyScore never goes below 0", () => {
      const quizzes = [
        {
          id: "q1",
          title: "Quiz 1",
          isMandatory: true,
          assignedTo: ["all"],
          createdAt: "2026-03-01",
          questions: [],
        },
        {
          id: "q2",
          title: "Quiz 2",
          isMandatory: true,
          assignedTo: ["all"],
          createdAt: "2026-03-01",
          questions: [],
        },
      ] as any[];

      const user = {
        id: "d1",
        safetyScore: 15, // low starting score
        restricted: false,
        complianceChecklist: [
          { type: "CDL", status: "Expired", isMandatory: true },
        ],
      } as any;
      const result = checkDriverCompliance(user, quizzes, []);
      expect(result.safetyScore).toBeGreaterThanOrEqual(0);
    });

    it("uses default safetyScore of 100 when not set", () => {
      const user = { id: "d1", restricted: false } as any;
      const result = checkDriverCompliance(user, [], []);
      expect(result.safetyScore).toBe(100);
    });
  });

  // --- getDriverQuizzes ---
  describe("getDriverQuizzes", () => {
    it("returns empty array when no quizzes exist", async () => {
      // getDriverQuizzes calls getStoredQuizzes and getStoredResults in parallel
      // Both use api.get — first call returns quizzes, second returns results
      mockGet.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const result = await getDriverQuizzes("d1");
      expect(result).toEqual([]);
    });

    it("returns quizzes assigned to driver with Pending status", async () => {
      const quizzes = [
        {
          id: "q1",
          title: "Safety Quiz",
          isMandatory: true,
          assignedTo: ["d1"],
          createdAt: "2026-03-01",
          questions: [],
        },
      ];
      mockGet.mockResolvedValueOnce(quizzes).mockResolvedValueOnce([]);

      const result = await getDriverQuizzes("d1");
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("Pending");
    });

    it("shows Passed status when driver passed the quiz", async () => {
      const quizzes = [
        {
          id: "q1",
          title: "Safety Quiz",
          isMandatory: true,
          assignedTo: ["d1"],
          createdAt: "2026-03-01",
          questions: [],
        },
      ];
      const results = [
        {
          quizId: "q1",
          driverId: "d1",
          passed: true,
          score: 95,
          completedAt: "2026-03-10",
        },
      ];
      mockGet.mockResolvedValueOnce(quizzes).mockResolvedValueOnce(results);

      const result = await getDriverQuizzes("d1");
      expect(result[0].status).toBe("Passed");
      expect(result[0].score).toBe(95);
    });

    it("shows Failed status when driver failed the quiz", async () => {
      const quizzes = [
        {
          id: "q1",
          title: "Safety Quiz",
          isMandatory: true,
          assignedTo: ["d1"],
          createdAt: "2026-03-01",
          questions: [],
        },
      ];
      const results = [
        {
          quizId: "q1",
          driverId: "d1",
          passed: false,
          score: 40,
          completedAt: "2026-03-10",
        },
      ];
      mockGet.mockResolvedValueOnce(quizzes).mockResolvedValueOnce(results);

      const result = await getDriverQuizzes("d1");
      expect(result[0].status).toBe("Failed");
    });

    it("includes quizzes assigned to 'all'", async () => {
      const quizzes = [
        {
          id: "q1",
          title: "Universal Quiz",
          isMandatory: false,
          assignedTo: ["all"],
          createdAt: "2026-03-01",
          questions: [],
        },
      ];
      mockGet.mockResolvedValueOnce(quizzes).mockResolvedValueOnce([]);

      const result = await getDriverQuizzes("any-driver");
      expect(result).toHaveLength(1);
    });

    it("excludes quizzes not assigned to driver", async () => {
      const quizzes = [
        {
          id: "q1",
          title: "Other Driver Quiz",
          isMandatory: true,
          assignedTo: ["d2"],
          createdAt: "2026-03-01",
          questions: [],
        },
      ];
      mockGet.mockResolvedValueOnce(quizzes).mockResolvedValueOnce([]);

      const result = await getDriverQuizzes("d1");
      expect(result).toHaveLength(0);
    });
  });

  // --- calculateDriverPerformance ---
  describe("calculateDriverPerformance", () => {
    it("returns Elite grade for driver with 100% scores", async () => {
      const user = {
        id: "d1",
        companyId: "c1",
        safetyScore: 100,
        restricted: false,
      } as any;
      mockGetCompany.mockResolvedValue({
        scoringConfig: {
          minimumDispatchScore: 75,
          weights: { safety: 0.5, onTime: 0.3, paperwork: 0.2 },
        },
      });
      mockGetLoads.mockResolvedValue([]);

      // getStoredQuizzes and getStoredResults both return empty
      mockGet.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const perf = await calculateDriverPerformance(user);
      expect(perf.driverId).toBe("d1");
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
          issues: [{ category: "Dispatch", description: "Late delivery" }],
        },
      ]);

      mockGet.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const perf = await calculateDriverPerformance(user);
      expect(perf.grade).toBe("At Risk");
      expect(perf.status).toBe("Blocked");
    });

    it("counts on-time and paperwork metrics", async () => {
      const user = {
        id: "d1",
        companyId: "c1",
        safetyScore: 100,
        restricted: false,
      } as any;
      mockGetCompany.mockResolvedValue(null); // Uses defaults
      mockGetLoads.mockResolvedValue([
        {
          driverId: "d1",
          status: "delivered",
          bolNumber: "BOL-1",
          issues: [],
        },
        {
          driverId: "d1",
          status: "delivered",
          bolNumber: "",
          bolUrls: [],
          issues: [{ category: "Dispatch", description: "late" }],
        },
      ]);

      mockGet.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const perf = await calculateDriverPerformance(user);
      expect(perf.metrics.loadCount).toBe(2);
      expect(perf.metrics.onTimeRate).toBe(50); // 1 out of 2
      expect(perf.metrics.paperworkScore).toBe(50); // 1 out of 2
    });
  });

  // --- getEquipment ---
  describe("getEquipment", () => {
    it("fetches equipment from API via api.get", async () => {
      mockGet.mockResolvedValue([{ id: "eq-1", type: "Truck" }]);

      const equipment = await getEquipment("c1");
      expect(equipment).toHaveLength(1);
      expect(mockGet).toHaveBeenCalledWith("/equipment/c1");
    });

    it("returns empty array on API failure", async () => {
      mockGet.mockRejectedValue(new Error("offline"));
      const equipment = await getEquipment("c1");
      expect(equipment).toEqual([]);
    });
  });

  // --- getComplianceRecords ---
  describe("getComplianceRecords", () => {
    it("fetches compliance records from API via api.get", async () => {
      mockGet.mockResolvedValue([{ id: "cr-1" }]);

      const records = await getComplianceRecords("u1");
      expect(records).toHaveLength(1);
      expect(mockGet).toHaveBeenCalledWith("/compliance/u1");
    });

    it("returns empty array on API failure", async () => {
      mockGet.mockRejectedValue(new Error("offline"));
      const records = await getComplianceRecords("u1");
      expect(records).toEqual([]);
    });
  });

  // --- registerAsset ---
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
      // logSafetyActivity uses api.post
      mockPost.mockResolvedValue({});

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

      await registerAsset(
        "nonexistent",
        { id: "eq-1" } as any,
        { name: "Admin" } as any,
      );

      expect(mockUpdateCompany).not.toHaveBeenCalled();
    });
  });

  // --- updateEquipmentStatus ---
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

  // --- seedSafetyData ---
  describe("seedSafetyData", () => {
    it("is a no-op (deprecated)", () => {
      expect(() => seedSafetyData()).not.toThrow();
      expect(() => seedSafetyData(true)).not.toThrow();
    });
  });
});
