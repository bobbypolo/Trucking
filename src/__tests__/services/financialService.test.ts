import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock authService before importing financialService (which imports api.ts -> authService)
vi.mock("../../../services/authService", () => ({
  getIdTokenAsync: vi.fn().mockResolvedValue("mock-jwt-token"),
  forceRefreshToken: vi.fn().mockResolvedValue("refreshed-jwt-token"),
}));

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
  getIFTASummary,
  getMileageEntries,
  saveMileageEntry,
  postIFTAToLedger,
  getIFTAEvidence,
  analyzeIFTA,
  lockIFTATrip,
} from "../../../services/financialService";

/** Helper: create a mock Response that apiFetch considers successful */
const okJson = (data: unknown) =>
  ({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  }) as unknown as Response;

/** Helper: create a mock Response for void endpoints (apiFetch still calls .json()) */
const okVoid = () =>
  ({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
  }) as unknown as Response;

describe("financialService (api.* helpers)", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── GET endpoints ───────────────────────────────────────────────────
  describe("getGLAccounts", () => {
    it("fetches GL accounts via api.get with auth header", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        okJson([{ id: "gl-1", name: "Revenue" }]),
      );

      const accounts = await getGLAccounts();
      expect(accounts).toHaveLength(1);
      expect(accounts[0].name).toBe("Revenue");

      // Verify auth header is injected
      const fetchCall = (globalThis.fetch as any).mock.calls[0];
      expect(fetchCall[1].headers.Authorization).toBe("Bearer mock-jwt-token");
    });
  });

  describe("getLoadProfitLoss", () => {
    it("fetches P&L for a specific load", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        okJson({ revenue: 5000, costs: 3000 }),
      );

      const pl = await getLoadProfitLoss("load-1");
      expect(pl.revenue).toBe(5000);
      expect(pl.costs).toBe(3000);
      expect((globalThis.fetch as any).mock.calls[0][0]).toContain(
        "load-pl/load-1",
      );
    });
  });

  describe("getSettlements", () => {
    it("fetches all settlements when no driverId", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(okJson([{ id: "s1" }]));

      const settlements = await getSettlements();
      expect(settlements).toHaveLength(1);
      expect((globalThis.fetch as any).mock.calls[0][0]).not.toContain(
        "driverId",
      );
    });

    it("fetches driver-specific settlements", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        okJson([{ id: "s2", driverId: "d1" }]),
      );

      const settlements = await getSettlements("d1");
      expect(settlements).toHaveLength(1);
      expect((globalThis.fetch as any).mock.calls[0][0]).toContain(
        "driverId=d1",
      );
    });
  });

  describe("getInvoices", () => {
    it("fetches all invoices", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        okJson([{ id: "inv-1" }, { id: "inv-2" }]),
      );

      const invoices = await getInvoices();
      expect(invoices).toHaveLength(2);
    });
  });

  describe("getBills", () => {
    it("fetches all bills", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        okJson([{ id: "bill-1" }]),
      );

      const bills = await getBills();
      expect(bills).toHaveLength(1);
    });
  });

  describe("getIFTASummary", () => {
    it("passes quarter and year as query params", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        okJson({ quarter: 1, year: 2026 }),
      );

      const summary = await getIFTASummary(1, 2026);
      const url = (globalThis.fetch as any).mock.calls[0][0];
      expect(url).toContain("quarter=1");
      expect(url).toContain("year=2026");
      expect(summary.quarter).toBe(1);
    });
  });

  describe("getMileageEntries", () => {
    it("fetches all mileage entries when no truckId", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(okJson([{ id: "m1" }]));

      const entries = await getMileageEntries();
      expect(entries).toHaveLength(1);
    });

    it("fetches truck-specific mileage entries", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        okJson([{ id: "m2", truckId: "t1" }]),
      );

      await getMileageEntries("t1");
      expect((globalThis.fetch as any).mock.calls[0][0]).toContain(
        "truckId=t1",
      );
    });
  });

  describe("getIFTAEvidence", () => {
    it("fetches IFTA evidence for a load", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        okJson([{ loadId: "l1" }]),
      );

      const evidence = await getIFTAEvidence("l1");
      expect(evidence).toHaveLength(1);
      expect((globalThis.fetch as any).mock.calls[0][0]).toContain(
        "ifta-evidence/l1",
      );
    });
  });

  // ─── POST endpoints ──────────────────────────────────────────────────
  describe("createARInvoice", () => {
    it("posts invoice data via api.post with auth", async () => {
      const mockInvoice = { id: "inv-new", loadId: "l1", totalAmount: 3000 };
      vi.spyOn(globalThis, "fetch").mockResolvedValue(okJson(mockInvoice));

      const result = await createARInvoice({
        loadId: "l1",
        totalAmount: 3000,
      } as any);
      expect(result.id).toBe("inv-new");

      const fetchCall = (globalThis.fetch as any).mock.calls[0];
      expect(fetchCall[1].method).toBe("POST");
      expect(fetchCall[1].headers.Authorization).toBe("Bearer mock-jwt-token");
    });
  });

  describe("createAPBill", () => {
    it("posts bill data via api.post", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        okJson({ id: "bill-new" }),
      );

      const result = await createAPBill({ vendorId: "v1" } as any);
      expect(result.id).toBe("bill-new");
    });
  });

  describe("createJournalEntry", () => {
    it("posts journal entry via api.post", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(okJson({ id: "je-1" }));

      const result = await createJournalEntry({
        description: "Test entry",
      } as any);
      expect(result.id).toBe("je-1");
    });
  });

  describe("createSettlement", () => {
    it("posts settlement data via api.post", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        okJson({ id: "stl-1", netPay: 1500 }),
      );

      const result = await createSettlement({ driverId: "d1" } as any);
      expect(result.netPay).toBe(1500);
    });
  });

  describe("importFuelPurchases", () => {
    it("posts fuel purchase array via api.post", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(okVoid());

      await importFuelPurchases([
        { gallons: 100, amount: 350, state: "IL" },
      ] as any);

      const fetchCall = (globalThis.fetch as any).mock.calls[0];
      expect(fetchCall[1].method).toBe("POST");
      const body = JSON.parse(fetchCall[1].body as string);
      expect(body.type).toBe("Fuel");
      expect(body.data).toHaveLength(1);
      expect(body.data[0].gallons).toBe(100);
    });
  });

  describe("saveMileageEntry", () => {
    it("posts mileage entry via api.post", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(okVoid());

      await saveMileageEntry({ truckId: "t1", miles: 500 } as any);

      const fetchCall = (globalThis.fetch as any).mock.calls[0];
      expect(fetchCall[1].method).toBe("POST");
    });
  });

  describe("postIFTAToLedger", () => {
    it("posts IFTA data to ledger via api.post", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(okVoid());

      await postIFTAToLedger({ quarter: 1, year: 2026, netTaxDue: 250 });

      const fetchCall = (globalThis.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body as string);
      expect(body.quarter).toBe(1);
      expect(body.netTaxDue).toBe(250);
    });
  });

  describe("analyzeIFTA", () => {
    it("posts analysis request via api.post", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(okJson({ result: "ok" }));

      const result = await analyzeIFTA({ pings: [], mode: "GPS" });
      expect(result.result).toBe("ok");
    });
  });

  describe("lockIFTATrip", () => {
    it("posts audit lock request via api.post", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(okVoid());

      await lockIFTATrip({ tripId: "t1", lockedBy: "admin" } as any);

      const fetchCall = (globalThis.fetch as any).mock.calls[0];
      expect(fetchCall[1].method).toBe("POST");
    });
  });

  // ─── Error handling ──────────────────────────────────────────────────
  describe("error handling", () => {
    describe("network errors (fetch throws TypeError)", () => {
      it("propagates network error from getGLAccounts", async () => {
        vi.spyOn(globalThis, "fetch").mockRejectedValue(
          new TypeError("Failed to fetch"),
        );

        await expect(getGLAccounts()).rejects.toThrow("Failed to fetch");
      });

      it("propagates network error from createARInvoice", async () => {
        vi.spyOn(globalThis, "fetch").mockRejectedValue(
          new TypeError("Network request failed"),
        );

        await expect(
          createARInvoice({ loadId: "l1", totalAmount: 3000 } as any),
        ).rejects.toThrow("Network request failed");
      });

      it("propagates network error from getSettlements", async () => {
        vi.spyOn(globalThis, "fetch").mockRejectedValue(
          new TypeError("ERR_CONNECTION_REFUSED"),
        );

        await expect(getSettlements()).rejects.toThrow(
          "ERR_CONNECTION_REFUSED",
        );
      });
    });

    describe("HTTP error responses (apiFetch now checks response.ok)", () => {
      it("throws on 500 response from getInvoices", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: "Internal Server Error" }),
        } as any);

        await expect(getInvoices()).rejects.toThrow("Internal Server Error");
      });

      it("throws ForbiddenError on 403 response from getLoadProfitLoss", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
          ok: false,
          status: 403,
          json: () => Promise.resolve({ error: "Forbidden" }),
        } as any);

        await expect(getLoadProfitLoss("load-1")).rejects.toThrow("Forbidden");
      });

      it("throws session-expired on 401 response from getIFTAEvidence", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ error: "Unauthorized" }),
        } as any);

        await expect(getIFTAEvidence("nonexistent")).rejects.toThrow(
          "Unauthorized: session expired",
        );
      });
    });

    describe("malformed JSON responses", () => {
      it("throws when getGLAccounts response has invalid JSON", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.reject(new SyntaxError("Unexpected token")),
        } as any);

        await expect(getGLAccounts()).rejects.toThrow("Unexpected token");
      });

      it("throws when createSettlement response has invalid JSON", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
          ok: true,
          status: 200,
          json: () =>
            Promise.reject(new SyntaxError("Unexpected end of JSON input")),
        } as any);

        await expect(
          createSettlement({ driverId: "d1" } as any),
        ).rejects.toThrow("Unexpected end of JSON input");
      });

      it("throws when analyzeIFTA response has invalid JSON", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
          ok: true,
          status: 200,
          json: () =>
            Promise.reject(new SyntaxError("JSON.parse: unexpected character")),
        } as any);

        await expect(analyzeIFTA({ pings: [], mode: "GPS" })).rejects.toThrow(
          "JSON.parse: unexpected character",
        );
      });
    });
  });

  // ─── Auth injection verification ─────────────────────────────────────
  describe("auth injection", () => {
    it("all GET requests include Authorization header", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(okJson([]));

      await getGLAccounts();
      const headers = (globalThis.fetch as any).mock.calls[0][1].headers;
      expect(headers.Authorization).toBe("Bearer mock-jwt-token");
    });

    it("all POST requests include Authorization header", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(okVoid());

      await importFuelPurchases([]);
      const headers = (globalThis.fetch as any).mock.calls[0][1].headers;
      expect(headers.Authorization).toBe("Bearer mock-jwt-token");
    });
  });
});
