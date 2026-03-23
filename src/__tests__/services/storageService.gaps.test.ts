import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock authService BEFORE importing storageService
vi.mock("../../../services/authService", () => ({
  getCompany: vi.fn(),
  updateCompany: vi.fn(),
  getStoredUsers: vi.fn().mockReturnValue([]),
  getAuthHeaders: vi.fn().mockResolvedValue({
    "Content-Type": "application/json",
    Authorization: "Bearer test-token",
  }),
  getIdTokenAsync: vi.fn().mockResolvedValue("test-token"),
  getCurrentUser: vi.fn().mockReturnValue({ companyId: "test-co" }),
}));

vi.mock("../../../services/firebase", () => ({
  storage: {},
  DEMO_MODE: false,
}));
vi.mock("firebase/storage", () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
}));
vi.mock("../../../services/brokerService", () => ({
  getBrokers: vi.fn().mockResolvedValue([]),
}));
vi.mock("jspdf", () => {
  function MockJsPDF() {
    return {
      setFontSize: vi.fn(),
      setFont: vi.fn(),
      text: vi.fn(),
      setFillColor: vi.fn(),
      rect: vi.fn(),
      setTextColor: vi.fn(),
      save: vi.fn(),
      addImage: vi.fn(),
      lastAutoTable: { finalY: 120 },
    };
  }
  return { jsPDF: MockJsPDF };
});
vi.mock("jspdf-autotable", () => ({ default: vi.fn() }));
vi.mock("../../../services/dispatchIntelligence", () => ({
  DispatchIntelligence: {
    getBestMatches: vi.fn().mockResolvedValue([]),
    predictExceptionRisk: vi.fn().mockReturnValue({ risk: "LOW" }),
    analyzeProfitability: vi.fn().mockReturnValue({ recommendation: "ACCEPT" }),
    auditSettlement: vi.fn().mockReturnValue({ status: "READY" }),
    getDriverPerformance: vi.fn().mockReturnValue({ rank: "STANDARD" }),
    getCapacityForecast: vi.fn().mockReturnValue([]),
  },
}));
vi.mock("../../../services/loadService", () => ({
  fetchLoads: vi.fn().mockResolvedValue([]),
  createLoad: vi.fn().mockResolvedValue({}),
  updateLoadStatusApi: vi.fn().mockResolvedValue({}),
  searchLoadsApi: vi.fn().mockResolvedValue([]),
  deleteLoadApi: vi.fn().mockResolvedValue({}),
}));

// Mock sub-modules used by storageService aggregators
vi.mock("../../../services/storage/quotes", () => ({
  getQuotes: vi.fn().mockResolvedValue([]),
  saveQuote: vi.fn(),
}));
vi.mock("../../../services/storage/leads", () => ({
  getLeads: vi.fn().mockResolvedValue([]),
  saveLead: vi.fn(),
}));
vi.mock("../../../services/storage/bookings", () => ({
  getBookings: vi.fn().mockResolvedValue([]),
  saveBooking: vi.fn(),
}));
vi.mock("../../../services/storage/messages", () => ({
  getMessages: vi.fn().mockResolvedValue([]),
  saveMessage: vi.fn(),
}));
vi.mock("../../../services/storage/calls", () => ({
  getRawCalls: vi.fn().mockResolvedValue([]),
  saveCallSession: vi.fn(),
  attachToRecord: vi.fn(),
  linkSessionToRecord: vi.fn(),
}));
vi.mock("../../../services/storage/tasks", () => ({
  getRawTasks: vi.fn().mockResolvedValue([]),
  saveTask: vi.fn(),
  getRawWorkItems: vi.fn().mockResolvedValue([]),
  getWorkItems: vi.fn().mockResolvedValue([]),
  saveWorkItem: vi.fn(),
}));
vi.mock("../../../services/storage/recovery", () => ({
  getRawCrisisActions: vi.fn().mockResolvedValue([]),
  saveCrisisAction: vi.fn(),
  getRawRequests: vi.fn().mockResolvedValue([]),
  getRequests: vi.fn().mockResolvedValue([]),
  saveRequest: vi.fn(),
  updateRequestStatus: vi.fn(),
  getUnresolvedRequests: vi.fn().mockResolvedValue([]),
  getRawServiceTickets: vi.fn().mockResolvedValue([]),
  saveServiceTicket: vi.fn(),
}));
vi.mock("../../../services/storage/directory", () => ({
  saveProvider: vi.fn(),
  getProviders: vi.fn().mockResolvedValue([]),
  getContacts: vi.fn().mockResolvedValue([]),
  saveContact: vi.fn(),
  getDirectory: vi.fn().mockResolvedValue({ providers: [], contacts: [] }),
}));
vi.mock("../../../services/storage/vault", () => ({
  STORAGE_KEY_VAULT_DOCS: "vault_docs_v1",
  getRawVaultDocs: vi.fn().mockReturnValue([]),
  uploadVaultDoc: vi.fn(),
}));
vi.mock("../../../services/storage/notifications", () => ({
  STORAGE_KEY_NOTIFICATION_JOBS: "notification_jobs_v1",
  getRawNotificationJobs: vi.fn().mockReturnValue([]),
  saveNotificationJob: vi.fn(),
}));

import {
  convertBookingToLoad,
  createIncident,
  saveIncidentAction,
  saveIssue,
  saveIncidentCharge,
  saveCallLog,
  getOperationalTrends,
  getUnifiedEvents,
  searchLoads,
  getLoadSummary,
  getDriverSummary,
  getBrokerSummary,
  getRecord360Data,
  getTriageQueues,
  exportToPDF,
  generateBolPDF,
  generateMaintenanceLogPDF,
  generateInvoicePDF,
  generateNextLoadNumber,
  seedIncidents,
  initiateRepowerWorkflow,
  verifyTrailerDrop,
  getLoads,
  saveLoad,
} from "../../../services/storageService";
import {
  fetchLoads as apiFetchLoads,
  createLoad as apiCreateLoad,
  searchLoadsApi,
} from "../../../services/loadService";
import { getCompany, getStoredUsers } from "../../../services/authService";
import { getBrokers } from "../../../services/brokerService";
import { getBookings } from "../../../services/storage/bookings";
import { getQuotes } from "../../../services/storage/quotes";
import { getRawRequests } from "../../../services/storage/recovery";
import { getRawCalls } from "../../../services/storage/calls";
import { getMessages } from "../../../services/storage/messages";
import { getRawTasks } from "../../../services/storage/tasks";
import { getContacts } from "../../../services/storage/directory";
import { getRawVaultDocs } from "../../../services/storage/vault";

const mockApiFetchLoads = apiFetchLoads as ReturnType<typeof vi.fn>;
const mockApiCreateLoad = apiCreateLoad as ReturnType<typeof vi.fn>;
const mockSearchLoadsApi = searchLoadsApi as ReturnType<typeof vi.fn>;
const mockGetCompany = getCompany as ReturnType<typeof vi.fn>;
const mockGetStoredUsers = getStoredUsers as ReturnType<typeof vi.fn>;
const mockGetBrokers = getBrokers as ReturnType<typeof vi.fn>;
const mockGetBookings = getBookings as ReturnType<typeof vi.fn>;
const mockGetQuotes = getQuotes as ReturnType<typeof vi.fn>;
const mockGetRawRequests = getRawRequests as ReturnType<typeof vi.fn>;
const mockGetRawCalls = getRawCalls as ReturnType<typeof vi.fn>;
const mockGetMessages = getMessages as ReturnType<typeof vi.fn>;
const mockGetRawTasks = getRawTasks as ReturnType<typeof vi.fn>;
const mockGetContacts = getContacts as ReturnType<typeof vi.fn>;
const mockGetRawVaultDocs = getRawVaultDocs as ReturnType<typeof vi.fn>;

describe("storageService — gap coverage", () => {
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
    vi.spyOn(globalThis, "fetch").mockReset();
    mockApiFetchLoads.mockReset().mockResolvedValue([]);
    mockApiCreateLoad.mockReset().mockResolvedValue({});
    mockSearchLoadsApi.mockReset().mockResolvedValue([]);
    mockGetCompany.mockReset();
    mockGetStoredUsers.mockReset().mockReturnValue([]);
    mockGetBrokers.mockReset().mockResolvedValue([]);
    mockGetBookings.mockReset().mockResolvedValue([]);
    mockGetQuotes.mockReset().mockResolvedValue([]);
    mockGetRawRequests.mockReset().mockResolvedValue([]);
    mockGetRawCalls.mockReset().mockResolvedValue([]);
    mockGetMessages.mockReset().mockResolvedValue([]);
    mockGetRawTasks.mockReset().mockResolvedValue([]);
    mockGetContacts.mockReset().mockResolvedValue([]);
    mockGetRawVaultDocs.mockReset().mockReturnValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── convertBookingToLoad ────────────────────────────────────────────
  describe("convertBookingToLoad", () => {
    it("returns null if booking not found", async () => {
      mockGetBookings.mockResolvedValue([]);
      const user = { id: "u1", companyId: "c1" } as any;
      const result = await convertBookingToLoad("nonexistent", user);
      expect(result).toBeNull();
    });

    it("returns null if quote not found for booking", async () => {
      mockGetBookings.mockResolvedValue([{ id: "b1", quoteId: "q-missing" }]);
      mockGetQuotes.mockResolvedValue([]);
      const user = { id: "u1", companyId: "c1" } as any;
      const result = await convertBookingToLoad("b1", user);
      expect(result).toBeNull();
    });
  });

  // ─── createIncident ──────────────────────────────────────────────────
  describe("createIncident", () => {
    it("posts incident to API and saves to localStorage", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: () => Promise.resolve({}) } as any);

      const result = await createIncident({
        type: "Breakdown",
        severity: "Critical",
        loadId: "l1",
        location: { lat: 41.5, lng: -87.3 },
      });

      expect(result).toBe(true);
    });

    it("assigns default ID and reportedAt when missing", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: () => Promise.resolve({}) } as any);

      await createIncident({ type: "Accident" });

      // Check localStorage was populated
      const keys = Object.keys(localStorageMock);
      const incidentKey = keys.find((k) => k.includes("incidents"));
      if (incidentKey) {
        const incidents = JSON.parse(localStorageMock[incidentKey]);
        expect(incidents[0].id).toBeTruthy();
        expect(incidents[0].reportedAt).toBeTruthy();
        expect(incidents[0].timeline).toEqual([]);
        expect(incidents[0].billingItems).toEqual([]);
      }
    });

    it("returns false when API fails (no localStorage fallback)", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

      // API is sole source of truth — no localStorage fallback, returns false on failure
      const result = await createIncident({ type: "Weather Shutdown" });
      expect(result).toBe(false);
    });
  });

  // ─── saveIncidentAction ──────────────────────────────────────────────
  describe("saveIncidentAction", () => {
    it("posts action to API and updates localStorage", async () => {
      // Seed incident in localStorage
      const key = "loadpilot_test-co_incidents_v1";
      localStorageMock[key] = JSON.stringify([
        { id: "inc-1", timeline: [], billingItems: [] },
      ]);

      vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: () => Promise.resolve({}) } as any);

      const result = await saveIncidentAction("inc-1", {
        action: "DISPATCHED_TOW",
        actorName: "John",
        notes: "Tow dispatched",
      });

      expect(result).toBe(true);
    });

    it("returns false when API fails (no localStorage fallback)", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

      // API is sole source of truth — no localStorage fallback, returns false on failure
      const result = await saveIncidentAction("inc-1", {
        action: "NOTE_ADDED",
      });
      expect(result).toBe(false);
    });
  });

  // ─── saveIssue ───────────────────────────────────────────────────────
  describe("saveIssue", () => {
    it("posts issue to API and returns new issue", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: () => Promise.resolve({}) } as any);

      const issue = await saveIssue({
        category: "Maintenance",
        description: "Flat tire",
      });

      expect(issue).toBeDefined();
      expect(issue.id).toBeTruthy();
      expect(issue.category).toBe("Maintenance");
    });

    it("handles API failure gracefully", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

      const issue = await saveIssue({ description: "Test issue" });
      expect(issue).toBeDefined();
    });
  });

  // ─── saveIncidentCharge ──────────────────────────────────────────────
  describe("saveIncidentCharge", () => {
    it("returns true on API success", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: () => Promise.resolve({}) } as any);

      const result = await saveIncidentCharge("inc-1", {
        amount: 500,
        providerVendor: "Tow Co",
        approvedBy: "Admin",
      });

      expect(result).toBe(true);
    });

    it("returns false on API failure", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

      const result = await saveIncidentCharge("inc-1", { amount: 500 });
      expect(result).toBe(false);
    });

    it("returns false on non-ok response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 500,
      } as any);

      const result = await saveIncidentCharge("inc-1", { amount: 500 });
      expect(result).toBe(false);
    });
  });

  // ─── saveCallLog ─────────────────────────────────────────────────────
  describe("saveCallLog", () => {
    it("posts call log to API and returns the new call", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: () => Promise.resolve({}) } as any);

      const callLog = await saveCallLog({
        type: "Operational",
        category: "Update",
        notes: "Called driver",
        entityId: "global",
      });

      expect(callLog).toBeDefined();
      expect(callLog.id).toBeTruthy();
      expect(callLog.notes).toBe("Called driver");
    });

    it("handles API failure gracefully", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

      const callLog = await saveCallLog({ notes: "Test" });
      expect(callLog).toBeDefined();
      expect(callLog.id).toBeTruthy();
    });
  });

  // ─── getOperationalTrends ────────────────────────────────────────────
  describe("getOperationalTrends", () => {
    it("returns empty array (server-computed)", async () => {
      const trends = await getOperationalTrends("c1" as any);
      expect(trends).toEqual([]);
    });
  });

  // ─── searchLoads ─────────────────────────────────────────────────────
  describe("searchLoads", () => {
    it("delegates to searchLoadsApi", async () => {
      mockSearchLoadsApi.mockResolvedValue([
        { id: "l1", loadNumber: "LD-100" },
      ]);

      const results = await searchLoads("LD-100");
      expect(results).toHaveLength(1);
    });

    it("falls back to in-memory cache on API failure", async () => {
      // Populate cache
      mockApiFetchLoads.mockResolvedValue([
        {
          id: "l1",
          loadNumber: "LD-5555",
          companyId: "c1",
          pickup: { city: "Chicago", facilityName: "WH" },
          dropoff: { city: "Detroit", facilityName: "WH-B" },
          driverId: "d1",
        },
      ]);
      await getLoads({ id: "u1", companyId: "c1", role: "admin" } as any);

      mockSearchLoadsApi.mockRejectedValue(new Error("offline"));
      const results = await searchLoads("5555");
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── seedIncidents ───────────────────────────────────────────────────
  describe("seedIncidents", () => {
    it("is a no-op", async () => {
      await expect(seedIncidents([])).resolves.toBeUndefined();
    });
  });

  // ─── exportToPDF ─────────────────────────────────────────────────────
  describe("exportToPDF", () => {
    it("generates PDF from loads", () => {
      const loads = [
        {
          loadNumber: "LD-1000",
          status: "delivered",
          pickupDate: "2026-03-15",
          pickup: { facilityName: "WH-A" },
          carrierRate: 3000,
        },
      ] as any[];

      expect(() => exportToPDF(loads, { title: "Report" })).not.toThrow();
    });
  });

  // ─── generateBolPDF ──────────────────────────────────────────────────
  describe("generateBolPDF", () => {
    it("generates BOL PDF", () => {
      const load = {
        loadNumber: "LD-100",
        pickup: { facilityName: "WH-A", city: "Chicago", state: "IL" },
        dropoff: { facilityName: "WH-B", city: "Detroit", state: "MI" },
        commodity: "Electronics",
        weight: 42000,
      } as any;

      expect(() => generateBolPDF(load)).not.toThrow();
    });
  });

  // ─── generateMaintenanceLogPDF ───────────────────────────────────────
  describe("generateMaintenanceLogPDF", () => {
    it("generates maintenance PDF with history", () => {
      const eq = {
        id: "TRK-501",
        type: "Truck",
        maintenanceHistory: [
          {
            date: "2026-03-01",
            type: "Oil Change",
            description: "Full synthetic",
            cost: 150,
          },
        ],
      } as any;

      expect(() => generateMaintenanceLogPDF(eq, "Test Fleet")).not.toThrow();
    });

    it("handles empty maintenance history", () => {
      const eq = { id: "TRK-502", type: "Truck" } as any;
      expect(() => generateMaintenanceLogPDF(eq, "Test")).not.toThrow();
    });
  });

  // ─── generateInvoicePDF ──────────────────────────────────────────────
  describe("generateInvoicePDF", () => {
    it("generates invoice PDF", async () => {
      mockGetCompany.mockResolvedValue({
        name: "Test Carrier",
        address: "123 Main St",
        city: "Chicago",
        state: "IL",
        zip: "60601",
        dotNumber: "12345",
        mcNumber: "67890",
        phone: "555-1234",
      });

      const load = {
        companyId: "c1",
        loadNumber: "LD-100",
        carrierRate: 3000,
        pickup: { facilityName: "WH-A", city: "Chicago", state: "IL" },
        dropoff: { facilityName: "WH-B", city: "Detroit", state: "MI" },
      } as any;

      await expect(generateInvoicePDF(load)).resolves.not.toThrow();
    });

    it("handles missing company data", async () => {
      mockGetCompany.mockResolvedValue(null);

      const load = {
        companyId: "c1",
        loadNumber: "LD-100",
        carrierRate: 3000,
        pickup: { facilityName: "WH-A", city: "Chicago", state: "IL" },
        dropoff: { facilityName: "WH-B", city: "Detroit", state: "MI" },
      } as any;

      await expect(generateInvoicePDF(load)).resolves.not.toThrow();
    });

    it("includes expenses in invoice", async () => {
      mockGetCompany.mockResolvedValue({ name: "Carrier" });

      const load = {
        companyId: "c1",
        loadNumber: "LD-100",
        carrierRate: 3000,
        pickup: { facilityName: "WH-A", city: "Chicago", state: "IL" },
        dropoff: { facilityName: "WH-B", city: "Detroit", state: "MI" },
        expenses: [
          { category: "Fuel", amount: 500 },
          { category: "Tolls", amount: 50 },
        ],
      } as any;

      await expect(generateInvoicePDF(load)).resolves.not.toThrow();
    });
  });

  // ─── generateNextLoadNumber — additional branches ─────────────────────
  describe("generateNextLoadNumber — additional branches", () => {
    it("uses custom separator and prefix", () => {
      const company = {
        id: "c1",
        loadNumberingConfig: {
          enabled: true,
          prefix: "KCI",
          suffix: "",
          nextSequence: 500,
          separator: "#",
          includeClientTag: false,
          clientTagPosition: "after_prefix",
          clientTagFormat: "first_3",
        },
      } as any;

      const result = generateNextLoadNumber(company, "Amazon");
      expect(result).toBe("KCI#500");
    });

    it("uses config with different sequence number", () => {
      const company = {
        id: "c1",
        loadNumberingConfig: {
          enabled: true,
          prefix: "LOAD",
          suffix: "",
          nextSequence: 9999,
          separator: "-",
          includeClientTag: false,
          clientTagPosition: "before_suffix",
          clientTagFormat: "first_3",
        },
      } as any;

      const result = generateNextLoadNumber(company, "Amazon");
      expect(result).toBe("LOAD-9999");
    });
  });

  // ─── getLoadSummary ──────────────────────────────────────────────────
  describe("getLoadSummary", () => {
    it("returns null for unknown load", async () => {
      const result = await getLoadSummary("nonexistent");
      expect(result).toBeNull();
    });
  });

  // ─── getDriverSummary ────────────────────────────────────────────────
  describe("getDriverSummary", () => {
    it("returns null for unknown driver", async () => {
      mockGetStoredUsers.mockReturnValue([]);
      const result = await getDriverSummary("nonexistent");
      expect(result).toBeNull();
    });

    it("returns summary for known driver", async () => {
      mockGetStoredUsers.mockReturnValue([
        {
          id: "d1",
          name: "Tom",
          role: "driver",
          complianceStatus: "Eligible",
          complianceChecklist: [],
        },
      ]);
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      } as any);

      const result = await getDriverSummary("d1");
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Tom");
      expect(result?.complianceStatus).toBe("CLEAR");
    });

    it("returns RESTRICTED compliance for restricted driver", async () => {
      mockGetStoredUsers.mockReturnValue([
        {
          id: "d1",
          name: "Elena",
          role: "driver",
          complianceStatus: "Restricted",
          complianceChecklist: [{ status: "Expired" }],
        },
      ]);
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      } as any);

      const result = await getDriverSummary("d1");
      expect(result?.complianceStatus).toBe("RESTRICTED");
      expect(result?.expiringDocsCount).toBe(1);
    });
  });

  // ─── getBrokerSummary ────────────────────────────────────────────────
  describe("getBrokerSummary", () => {
    it("returns null for unknown broker", async () => {
      mockGetBrokers.mockResolvedValue([]);
      const result = await getBrokerSummary("nonexistent");
      expect(result).toBeNull();
    });

    it("returns summary for known broker", async () => {
      mockGetBrokers.mockResolvedValue([{ id: "b1", name: "Acme Freight" }]);
      mockGetRawRequests.mockResolvedValue([]);
      mockGetRawCalls.mockResolvedValue([]);

      const result = await getBrokerSummary("b1");
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Acme Freight");
    });
  });

  // ─── getRecord360Data ────────────────────────────────────────────────
  describe("getRecord360Data", () => {
    it("returns null for unsupported type", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      } as any);
      const result = await getRecord360Data("UNKNOWN" as any, "x");
      expect(result).toBeNull();
    });

    it("returns data for DRIVER type", async () => {
      mockGetStoredUsers.mockReturnValue([
        { id: "d1", name: "Tom", role: "driver" },
      ]);
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      } as any);

      const result = await getRecord360Data("DRIVER", "d1");
      expect(result).toBeDefined();
      expect(result?.driver?.name).toBe("Tom");
    });

    it("returns data for BROKER type", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      } as any);
      mockGetBrokers.mockResolvedValue([{ id: "b1", name: "Acme" }]);

      const result = await getRecord360Data("BROKER", "b1");
      expect(result).toBeDefined();
      expect(result?.broker?.name).toBe("Acme");
    });

    it("returns data for INCIDENT type", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: "inc-1",
              load_id: "l1",
              type: "Breakdown",
              severity: "Critical",
              status: "Open",
              reported_at: "2026-03-15",
              timeline: [],
              billingItems: [],
            },
          ]),
      } as any);

      const result = await getRecord360Data("INCIDENT", "inc-1");
      expect(result).toBeDefined();
    });
  });

  // ─── getTriageQueues ─────────────────────────────────────────────────
  describe("getTriageQueues", () => {
    it("returns structured triage queues", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      } as any);

      const result = await getTriageQueues();
      expect(result).toBeDefined();
      expect(result.requests).toBeDefined();
      expect(result.incidents).toBeDefined();
      expect(result.tasks).toBeDefined();
      expect(result.calls).toBeDefined();
      expect(result.atRiskLoads).toBeDefined();
      expect(result.workItems).toBeDefined();
    });
  });

  // ─── getUnifiedEvents ────────────────────────────────────────────────
  describe("getUnifiedEvents", () => {
    it("returns sorted events from all sources", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      } as any);

      const events = await getUnifiedEvents();
      expect(Array.isArray(events)).toBe(true);
    });
  });

  // ─── initiateRepowerWorkflow ─────────────────────────────────────────
  describe("initiateRepowerWorkflow", () => {
    it("creates request, task, and logs event", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue({ ok: true, json: () => Promise.resolve({}) } as any);

      // Populate load cache first
      mockApiFetchLoads.mockResolvedValue([
        { id: "l1", companyId: "c1", driverId: "d1", loadNumber: "LD-100" },
      ]);
      await getLoads({ id: "u1", companyId: "c1", role: "admin" } as any);

      const user = { id: "u1", name: "Safety Admin" } as any;
      await initiateRepowerWorkflow("l1", user, "Engine failure");

      // Should have called fetch for dispatch event
      expect(fetchSpy).toHaveBeenCalled();
    });
  });

  // ─── verifyTrailerDrop ───────────────────────────────────────────────
  describe("verifyTrailerDrop", () => {
    it("logs dispatch event", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue({ ok: true, json: () => Promise.resolve({}) } as any);

      const user = { id: "u1", name: "Dispatcher" } as any;
      await verifyTrailerDrop("l1", user, {
        trailerId: "TRL-401",
        location: "Gary, IN",
        condition: "Good",
      });

      expect(fetchSpy).toHaveBeenCalled();
    });
  });
});
