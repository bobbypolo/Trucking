import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../../services/authService", () => ({
  getCompany: vi.fn(),
  updateCompany: vi.fn(),
  getStoredUsers: vi.fn().mockReturnValue([]),
  getAuthHeaders: vi
    .fn()
    .mockResolvedValue({
      "Content-Type": "application/json",
      Authorization: "Bearer test-token",
    }),
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
  const d = {
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
  return { jsPDF: vi.fn(() => d) };
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
  saveMessage: vi.fn().mockImplementation((msg: any) => Promise.resolve(msg)),
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
  saveVaultDoc: vi.fn(),
  uploadVaultDoc: vi.fn(),
}));
vi.mock("../../../services/storage/notifications", () => ({
  STORAGE_KEY_NOTIFICATION_JOBS: "notification_jobs_v1",
  getRawNotificationJobs: vi.fn().mockReturnValue([]),
  saveNotificationJob: vi.fn(),
}));

import {
  saveProvider,
  getProviders,
  getContacts,
  saveContact,
  getDirectory,
  getRawVaultDocs,
  saveVaultDoc,
  uploadVaultDoc,
  getRawNotificationJobs,
  saveNotificationJob,
  getMessages,
  saveMessage,
  getLeads,
  saveLead,
  getQuotes,
  saveQuote,
  getBookings,
  saveBooking,
  getRawCalls,
  saveCallSession,
  attachToRecord,
  linkSessionToRecord,
  getRawTasks,
  saveTask,
  getRawWorkItems,
  getWorkItems,
  saveWorkItem,
  getRawCrisisActions,
  saveCrisisAction,
  getRawRequests,
  getRequests,
  saveRequest,
  updateRequestStatus,
  getUnresolvedRequests,
  getRawServiceTickets,
  saveServiceTicket,
  getIncidents,
  saveIncident,
  getLoads,
  convertBookingToLoad,
} from "../../../services/storageService";
import {
  fetchLoads as apiFetchLoads,
  createLoad as apiCreateLoad,
} from "../../../services/loadService";
import {
  saveProvider as mSP,
  getProviders as mGP,
  getContacts as mGC,
  saveContact as mSC,
  getDirectory as mGD,
} from "../../../services/storage/directory";
import { getBookings as _gB } from "../../../services/storage/bookings";
import { getQuotes as _gQ } from "../../../services/storage/quotes";

const mFL = apiFetchLoads as ReturnType<typeof vi.fn>;
const mCL = apiCreateLoad as ReturnType<typeof vi.fn>;

describe("storageService deep coverage", () => {
  let ls: Record<string, string>;
  beforeEach(() => {
    ls = {};
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(
      (k: string) => ls[k] ?? null,
    );
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(
      (k: string, v: string) => {
        ls[k] = v;
      },
    );
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(
      (k: string) => {
        delete ls[k];
      },
    );
    vi.spyOn(globalThis, "fetch").mockReset();
    mFL.mockReset().mockResolvedValue([]);
    mCL.mockReset().mockResolvedValue({});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("directory re-exports (lines 102-108)", () => {
    it("saveProvider", async () => {
      await saveProvider({ id: "p1" } as any);
      expect(mSP).toHaveBeenCalled();
    });
    it("getProviders", async () => {
      (mGP as any).mockResolvedValue([{ id: "p1" }]);
      expect(await getProviders()).toHaveLength(1);
    });
    it("getContacts", async () => {
      (mGC as any).mockResolvedValue([{ id: "c1" }]);
      expect(await getContacts()).toHaveLength(1);
    });
    it("saveContact", async () => {
      await saveContact({ id: "c1" } as any);
      expect(mSC).toHaveBeenCalled();
    });
    it("getDirectory", async () => {
      (mGD as any).mockResolvedValue({ providers: [{}], contacts: [{}] });
      const d = await getDirectory();
      expect(d.providers).toHaveLength(1);
    });
  });

  describe("vault re-exports (lines 109-114)", () => {
    it("getRawVaultDocs", () => {
      expect(Array.isArray(getRawVaultDocs())).toBe(true);
    });
    it("saveVaultDoc", async () => {
      await saveVaultDoc({ id: "d1" } as any);
      const m = await import("../../../services/storage/vault");
      expect(m.saveVaultDoc).toHaveBeenCalled();
    });
    it("uploadVaultDoc", async () => {
      await uploadVaultDoc(new File([], "test.pdf"), "BOL", "test-tenant");
      const m = await import("../../../services/storage/vault");
      expect(m.uploadVaultDoc).toHaveBeenCalled();
    });
  });

  describe("notifications re-exports (lines 115-119)", () => {
    it("getRawNotificationJobs", () => {
      expect(Array.isArray(getRawNotificationJobs())).toBe(true);
    });
    it("saveNotificationJob", async () => {
      await saveNotificationJob({ id: "j1" } as any);
      const m = await import("../../../services/storage/notifications");
      expect(m.saveNotificationJob).toHaveBeenCalled();
    });
  });

  describe("messages (line 77)", () => {
    it("getMessages", async () => {
      expect(Array.isArray(await getMessages())).toBe(true);
    });
    it("saveMessage", async () => {
      const r = await saveMessage({ id: "m1", text: "Hi" } as any);
      expect(r.id).toBe("m1");
    });
  });

  describe("other re-exports", () => {
    it("getLeads", async () => {
      expect(Array.isArray(await getLeads("test-co"))).toBe(true);
    });
    it("getQuotes", async () => {
      expect(Array.isArray(await getQuotes())).toBe(true);
    });
    it("getBookings", async () => {
      expect(Array.isArray(await getBookings("co"))).toBe(true);
    });
    it("getRawCalls", async () => {
      expect(Array.isArray(await getRawCalls())).toBe(true);
    });
    it("getRawTasks", async () => {
      expect(Array.isArray(await getRawTasks())).toBe(true);
    });
    it("getWorkItems", async () => {
      expect(Array.isArray(await getWorkItems())).toBe(true);
    });
    it("getRawCrisisActions", async () => {
      expect(Array.isArray(await getRawCrisisActions())).toBe(true);
    });
    it("getRawRequests", async () => {
      expect(Array.isArray(await getRawRequests())).toBe(true);
    });
    it("getRequests", async () => {
      expect(Array.isArray(await getRequests())).toBe(true);
    });
    it("getUnresolvedRequests", async () => {
      expect(Array.isArray(await getUnresolvedRequests())).toBe(true);
    });
    it("getRawServiceTickets", async () => {
      expect(Array.isArray(await getRawServiceTickets())).toBe(true);
    });

  });

  describe("saveIncident API-only (localStorage removed)", () => {
    it("returns false when API fails (no localStorage fallback)", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
      const result = await saveIncident({
        id: "inc-1",
        description: "Updated",
        timeline: [],
        billingItems: [],
      } as any);
      // API is sole source of truth — returns false on failure, no localStorage write
      expect(result).toBe(false);
    });
  });

  describe("convertBookingToLoad success", () => {
    it("converts booking with quote to load", async () => {
      (_gB as any).mockResolvedValue([{ id: "b1", quoteId: "q1" }]);
      (_gQ as any).mockResolvedValue([
        {
          id: "q1",
          totalRate: 3000,
          equipmentType: "Flatbed",
          pickup: { city: "Chicago", state: "IL" },
          dropoff: { city: "Dallas", state: "TX" },
        },
      ]);
      mCL.mockResolvedValue({});
      const r = await convertBookingToLoad("b1", {
        id: "u1",
        companyId: "c1",
      } as any);
      expect(r).not.toBeNull();
      expect(r!.carrierRate).toBe(3000);
    });
  });

  describe("getLoads owner_operator", () => {
    it("filters by driverId", async () => {
      mFL.mockResolvedValue([
        { id: "l1", companyId: "c1", driverId: "oo1" },
        { id: "l2", companyId: "c1", driverId: "oo2" },
      ]);
      const loads = await getLoads({
        id: "oo1",
        companyId: "c1",
        role: "owner_operator",
      } as any);
      expect(loads).toHaveLength(1);
    });
  });

  describe("getIncidents non-ok response", () => {
    it("returns empty array on non-ok API response (API-only, no localStorage)", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 500,
      } as any);
      // API-only: non-ok response returns empty array (no localStorage fallback)
      const incidents = await getIncidents();
      expect(Array.isArray(incidents)).toBe(true);
      expect(incidents).toHaveLength(0);
    });
  });
});
