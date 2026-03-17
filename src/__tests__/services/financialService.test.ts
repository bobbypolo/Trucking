import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  getGLAccounts,
  getLoadProfitLoss,
  createARInvoice,
  createAPBill,
  createJournalEntry,
  getSettlements,
  createSettlement,
  importFuelPurchases,
  getInvoices,
  getBills,
  getVaultDocs,
  uploadToVault,
  updateDocStatus,
  getIFTASummary,
  getMileageEntries,
  saveMileageEntry,
  postIFTAToLedger,
  getIFTAEvidence,
  analyzeIFTA,
  lockIFTATrip,
} from "../../../services/financialService";

describe("financialService", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── GET endpoints ───────────────────────────────────────────────────
  describe("getGLAccounts", () => {
    it("fetches GL accounts from API", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        json: () => Promise.resolve([{ id: "gl-1", name: "Revenue" }]),
      } as any);

      const accounts = await getGLAccounts();
      expect(accounts).toHaveLength(1);
      expect(accounts[0].name).toBe("Revenue");
    });
  });

  describe("getLoadProfitLoss", () => {
    it("fetches P&L for a specific load", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        json: () => Promise.resolve({ revenue: 5000, costs: 3000 }),
      } as any);

      const pl = await getLoadProfitLoss("load-1");
      expect(pl.revenue).toBe(5000);
      expect(pl.costs).toBe(3000);
      expect((globalThis.fetch as any).mock.calls[0][0]).toContain("load-pl/load-1");
    });
  });

  describe("getSettlements", () => {
    it("fetches all settlements when no driverId", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        json: () => Promise.resolve([{ id: "s1" }]),
      } as any);

      const settlements = await getSettlements();
      expect(settlements).toHaveLength(1);
      expect((globalThis.fetch as any).mock.calls[0][0]).not.toContain("driverId");
    });

    it("fetches driver-specific settlements", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        json: () => Promise.resolve([{ id: "s2", driverId: "d1" }]),
      } as any);

      const settlements = await getSettlements("d1");
      expect(settlements).toHaveLength(1);
      expect((globalThis.fetch as any).mock.calls[0][0]).toContain("driverId=d1");
    });
  });

  describe("getInvoices", () => {
    it("fetches all invoices", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        json: () => Promise.resolve([{ id: "inv-1" }, { id: "inv-2" }]),
      } as any);

      const invoices = await getInvoices();
      expect(invoices).toHaveLength(2);
    });
  });

  describe("getBills", () => {
    it("fetches all bills", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        json: () => Promise.resolve([{ id: "bill-1" }]),
      } as any);

      const bills = await getBills();
      expect(bills).toHaveLength(1);
    });
  });

  describe("getVaultDocs", () => {
    it("passes filters as query parameters", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        json: () => Promise.resolve([]),
      } as any);

      await getVaultDocs({ status: "active", type: "BOL" });
      const url = (globalThis.fetch as any).mock.calls[0][0];
      expect(url).toContain("status=active");
      expect(url).toContain("type=BOL");
    });
  });

  describe("getIFTASummary", () => {
    it("passes quarter and year as query params", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        json: () => Promise.resolve({ quarter: 1, year: 2026 }),
      } as any);

      const summary = await getIFTASummary(1, 2026);
      const url = (globalThis.fetch as any).mock.calls[0][0];
      expect(url).toContain("quarter=1");
      expect(url).toContain("year=2026");
    });
  });

  describe("getMileageEntries", () => {
    it("fetches all mileage entries when no truckId", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        json: () => Promise.resolve([{ id: "m1" }]),
      } as any);

      const entries = await getMileageEntries();
      expect(entries).toHaveLength(1);
    });

    it("fetches truck-specific mileage entries", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        json: () => Promise.resolve([{ id: "m2", truckId: "t1" }]),
      } as any);

      await getMileageEntries("t1");
      expect((globalThis.fetch as any).mock.calls[0][0]).toContain("truckId=t1");
    });
  });

  describe("getIFTAEvidence", () => {
    it("fetches IFTA evidence for a load", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        json: () => Promise.resolve([{ loadId: "l1" }]),
      } as any);

      const evidence = await getIFTAEvidence("l1");
      expect(evidence).toHaveLength(1);
      expect((globalThis.fetch as any).mock.calls[0][0]).toContain("ifta-evidence/l1");
    });
  });

  // ─── POST endpoints ──────────────────────────────────────────────────
  describe("createARInvoice", () => {
    it("posts invoice data to API", async () => {
      const mockInvoice = { id: "inv-new", loadId: "l1", totalAmount: 3000 };
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        json: () => Promise.resolve(mockInvoice),
      } as any);

      const result = await createARInvoice({ loadId: "l1", totalAmount: 3000 } as any);
      expect(result.id).toBe("inv-new");

      const fetchCall = (globalThis.fetch as any).mock.calls[0];
      expect(fetchCall[1].method).toBe("POST");
    });
  });

  describe("createAPBill", () => {
    it("posts bill data to API", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        json: () => Promise.resolve({ id: "bill-new" }),
      } as any);

      const result = await createAPBill({ vendorId: "v1" } as any);
      expect(result.id).toBe("bill-new");
    });
  });

  describe("createJournalEntry", () => {
    it("posts journal entry to API", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        json: () => Promise.resolve({ id: "je-1" }),
      } as any);

      const result = await createJournalEntry({ description: "Test entry" } as any);
      expect(result.id).toBe("je-1");
    });
  });

  describe("createSettlement", () => {
    it("posts settlement data", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        json: () => Promise.resolve({ id: "stl-1", netPay: 1500 }),
      } as any);

      const result = await createSettlement({ driverId: "d1" } as any);
      expect(result.netPay).toBe(1500);
    });
  });

  describe("importFuelPurchases", () => {
    it("posts fuel purchase array", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({} as any);

      await importFuelPurchases([
        { gallons: 100, amount: 350, state: "IL" },
      ] as any);

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body).toHaveLength(1);
      expect(body[0].gallons).toBe(100);
    });
  });

  describe("uploadToVault", () => {
    it("posts vault doc data", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({} as any);

      await uploadToVault({ fileName: "test.pdf", type: "BOL" } as any);

      const fetchCall = (globalThis.fetch as any).mock.calls[0];
      expect(fetchCall[1].method).toBe("POST");
    });
  });

  describe("saveMileageEntry", () => {
    it("posts mileage entry", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({} as any);

      await saveMileageEntry({ truckId: "t1", miles: 500 } as any);

      const fetchCall = (globalThis.fetch as any).mock.calls[0];
      expect(fetchCall[1].method).toBe("POST");
    });
  });

  describe("postIFTAToLedger", () => {
    it("posts IFTA data to ledger", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({} as any);

      await postIFTAToLedger({ quarter: 1, year: 2026, netTaxDue: 250 });

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.quarter).toBe(1);
      expect(body.netTaxDue).toBe(250);
    });
  });

  describe("analyzeIFTA", () => {
    it("posts analysis request", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        json: () => Promise.resolve({ result: "ok" }),
      } as any);

      const result = await analyzeIFTA({ pings: [], mode: "GPS" });
      expect(result.result).toBe("ok");
    });
  });

  describe("lockIFTATrip", () => {
    it("posts audit lock request", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({} as any);

      await lockIFTATrip({ tripId: "t1", lockedBy: "admin" } as any);

      const fetchCall = (globalThis.fetch as any).mock.calls[0];
      expect(fetchCall[1].method).toBe("POST");
    });
  });

  // ─── PATCH endpoints ─────────────────────────────────────────────────
  describe("updateDocStatus", () => {
    it("patches doc status", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({} as any);

      await updateDocStatus("doc-1", "approved", true, "admin");

      const fetchCall = fetchSpy.mock.calls[0];
      expect(fetchCall[0]).toContain("docs/doc-1");
      expect(fetchCall[1].method).toBe("PATCH");

      const body = JSON.parse(fetchCall[1].body);
      expect(body.status).toBe("approved");
      expect(body.is_locked).toBe(true);
      expect(body.updatedBy).toBe("admin");
    });
  });
});
