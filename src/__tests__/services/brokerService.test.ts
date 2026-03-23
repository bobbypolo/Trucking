import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock firebase
vi.mock("../../../services/firebase", () => ({
  auth: { currentUser: null },
  DEMO_MODE: true,
}));

vi.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
  getIdToken: vi.fn(),
}));

// Mock fixtures
vi.mock("../../../fixtures/test-users.json", () => ({
  default: {
    admin: { email: "a@t.com", name: "A", password: "p", companyName: "C", accountType: "carrier" },
    dispatcher: { email: "d@t.com", name: "D", role: "dispatcher", password: "p" },
    opsManager: { email: "o@t.com", name: "O", role: "OPS_MANAGER", password: "p" },
    arSpecialist: { email: "ar@t.com", name: "AR", role: "ACCOUNTING_AR", password: "p" },
    apClerk: { email: "ap@t.com", name: "AP", role: "ACCOUNTING_AP", password: "p" },
    payroll: { email: "pr@t.com", name: "PR", role: "payroll_manager", password: "p" },
    safety: { email: "s@t.com", name: "S", role: "safety_manager", password: "p" },
    maintenance: { email: "m@t.com", name: "M", role: "MAINTENANCE_MANAGER", password: "p" },
    smallBiz: { email: "sb@t.com", name: "SB", role: "OWNER_ADMIN", password: "p" },
    fusedOps: { email: "fo@t.com", name: "FO", role: "OPS", password: "p" },
    fusedFinance: { email: "ff@t.com", name: "FF", role: "FINANCE", password: "p" },
    fleetOwner: { email: "fl@t.com", name: "FL", role: "FLEET_OO_ADMIN_PORTAL", password: "p" },
    operator1: { email: "o1@t.com", name: "O1", role: "owner_operator", password: "p" },
    operator2: { email: "o2@t.com", name: "O2", role: "owner_operator", password: "p" },
    customer: { email: "c@t.com", name: "C", role: "customer", password: "p" },
    architect: { email: "arch@t.com", name: "Arch", role: "ORG_OWNER_SUPER_ADMIN", password: "p" },
    drivers: [{ email: "dr@t.com", name: "Dr", password: "p", state: "IL" }],
  },
}));

vi.mock("../../../services/storageService", () => ({
  seedDemoLoads: vi.fn(),
}));

// Tests R-P1-30, R-P1-31, R-P1-32
import {
  getBrokers,
  saveBroker,
  getBrokerById,
  getContracts,
  saveContract,
  checkSafetyScore,
} from "../../../services/brokerService";

describe("brokerService (API-only, no localStorage)", () => {
  let localStorageGetSpy: ReturnType<typeof vi.spyOn>;
  let localStorageSetSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorageGetSpy = vi.spyOn(Storage.prototype, "getItem");
    localStorageSetSpy = vi.spyOn(Storage.prototype, "setItem");
    vi.spyOn(globalThis, "fetch").mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // R-P1-30, R-P1-31: no localStorage in brokerService, BROKERS_KEY removed
  describe("getBrokers (API-only)", () => {
    it("returns brokers from API sorted by name", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            { id: "b2", name: "Zeta Corp", type: "broker" },
            { id: "b1", name: "Alpha Inc", type: "shipper" },
          ]),
      } as any);

      const brokers = await getBrokers();
      expect(brokers).toHaveLength(2);
      expect(brokers[0].name).toBe("Alpha Inc");
      expect(brokers[1].name).toBe("Zeta Corp");
    });

    it("maps chassis_requirements string to approvedChassis array", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: "b1",
              name: "Test",
              type: "broker",
              chassis_requirements: '["DCLI","TRAC"]',
            },
          ]),
      } as any);

      const brokers = await getBrokers();
      expect(brokers[0].approvedChassis).toEqual(["DCLI", "TRAC"]);
    });

    it("maps type to clientType", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([{ id: "b1", name: "Test", type: "shipper" }]),
      } as any);

      const brokers = await getBrokers();
      expect(brokers[0].clientType).toBe("shipper");
    });

    it("returns empty array (not localStorage fallback) when API fails", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

      const brokers = await getBrokers();
      // R-P1-30: no localStorage access on failure
      expect(localStorageGetSpy).not.toHaveBeenCalled();
      expect(brokers).toEqual([]);
    });

    it("does not read localStorage on API success", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      } as any);

      await getBrokers();
      expect(localStorageGetSpy).not.toHaveBeenCalled();
    });

    it("uses companyId-specific URL when provided", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      } as any);

      await getBrokers("comp-1");
      const fetchCall = (globalThis.fetch as any).mock.calls[0];
      expect(fetchCall[0]).toContain("/clients/comp-1");
    });
  });

  // R-P1-32: saveBroker does not write to localStorage
  describe("saveBroker (API-only)", () => {
    it("saves broker to API only — does not write to localStorage", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
      } as any);

      const broker = {
        id: "b1",
        name: "New Broker",
        clientType: "broker",
        approvedChassis: ["DCLI"],
      } as any;

      await saveBroker(broker);

      // R-P1-32: no localStorage writes
      expect(localStorageSetSpy).not.toHaveBeenCalled();
    });

    it("sends type and chassis_requirements to API", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
      } as any);

      await saveBroker({
        id: "b1",
        name: "Test",
        clientType: "shipper",
        approvedChassis: ["TRAC"],
      } as any);

      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
      expect(body.type).toBe("shipper");
      expect(body.chassis_requirements).toEqual(["TRAC"]);
    });

    it("does not write to localStorage when API fails", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

      await saveBroker({ id: "b1", name: "Offline Broker" } as any);

      // R-P1-32: no localStorage fallback at all
      expect(localStorageSetSpy).not.toHaveBeenCalled();
    });
  });

  // getBrokerById
  describe("getBrokerById", () => {
    it("returns broker matching the id", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            { id: "b1", name: "First", type: "broker" },
            { id: "b2", name: "Second", type: "shipper" },
          ]),
      } as any);

      const broker = await getBrokerById("b2");
      expect(broker).toBeDefined();
      expect(broker!.name).toBe("Second");
    });

    it("returns undefined when id not found", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      } as any);

      const broker = await getBrokerById("nonexistent");
      expect(broker).toBeUndefined();
    });
  });

  // getContracts
  describe("getContracts", () => {
    it("returns contracts from API", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: "ct1",
              customer_id: "b1",
              equipment_preferences: '{"trailer":"53ft"}',
            },
          ]),
      } as any);

      const contracts = await getContracts("b1");
      expect(contracts).toHaveLength(1);
      expect(contracts[0].equipmentPreferences).toEqual({ trailer: "53ft" });
    });

    it("parses equipment_preferences when it is an object", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: "ct1",
              customer_id: "b1",
              equipment_preferences: { size: "48ft" },
            },
          ]),
      } as any);

      const contracts = await getContracts("b1");
      expect(contracts[0].equipmentPreferences).toEqual({ size: "48ft" });
    });

    it("returns empty array when API fails", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
      const contracts = await getContracts("b1");
      expect(contracts).toEqual([]);
    });
  });

  // saveContract
  describe("saveContract", () => {
    it("sends contract to API", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
      } as any);

      const contract = { id: "ct1", customerId: "b1", name: "Q4 Contract" } as any;
      await saveContract(contract);

      expect(fetchSpy).toHaveBeenCalled();
      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
      expect(body.id).toBe("ct1");
    });

    it("handles API failure gracefully", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
      await expect(
        saveContract({ id: "ct1" } as any),
      ).resolves.toBeUndefined();
    });
  });

  // checkSafetyScore
  describe("checkSafetyScore", () => {
    it("returns null (no real FMCSA integration yet)", () => {
      expect(checkSafetyScore("MC-123456")).toBeNull();
    });

    it("returns null for any MC number", () => {
      expect(checkSafetyScore("")).toBeNull();
      expect(checkSafetyScore("MC-999999")).toBeNull();
    });
  });
});
