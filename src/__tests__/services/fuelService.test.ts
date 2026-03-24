import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the api module
const mockPost = vi.fn();

vi.mock("../../../services/api", () => ({
  api: {
    get: vi.fn(),
    post: (...args: any[]) => mockPost(...args),
    patch: vi.fn(),
    delete: vi.fn(),
    postFormData: vi.fn(),
  },
}));

// Mock dependencies
vi.mock("../../../services/rulesEngineService", () => ({
  executeFuelMatchingRule: vi
    .fn()
    .mockResolvedValue({ matched: 0, orphaned: 1 }),
}));

vi.mock("../../../services/financialService", () => ({
  getVaultDocs: vi.fn().mockResolvedValue([]),
}));

vi.mock("uuid", () => ({
  v4: vi.fn(() => "test-uuid-1234"),
}));

import { FuelCardService } from "../../../services/fuelService";
import { executeFuelMatchingRule } from "../../../services/rulesEngineService";
import { getVaultDocs } from "../../../services/financialService";

describe("FuelCardService", () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  // --- processIncomingTransaction ---
  describe("processIncomingTransaction", () => {
    const sampleTx = {
      unit_id: "TRUCK-42",
      driver_id: "DRV-01",
      card_number: "****1234",
      timestamp: "2026-03-15T10:00:00Z",
      state: "TX",
      gallons: "85.5",
      price_per_gal: "3.29",
      total_amount: "281.30",
      location_name: "Pilot Travel Center",
    };

    it("transforms raw transaction into a FuelEntry with correct fields", async () => {
      const result = await FuelCardService.processIncomingTransaction(
        sampleTx,
        "tenant-123",
      );
      expect(result.id).toBe("test-uuid-1234");
      expect(result.tenantId).toBe("tenant-123");
      expect(result.truckId).toBe("TRUCK-42");
      expect(result.driverId).toBe("DRV-01");
      expect(result.cardNumber).toBe("****1234");
      expect(result.transactionDate).toBe("2026-03-15T10:00:00Z");
      expect(result.stateCode).toBe("TX");
      expect(result.gallons).toBe(85.5);
      expect(result.unitPrice).toBe(3.29);
      expect(result.totalCost).toBe(281.3);
      expect(result.vendorName).toBe("Pilot Travel Center");
      expect(result.isIftaTaxable).toBe(true);
      expect(result.isBillableToLoad).toBe(false);
    });

    it("uses defaults for missing raw transaction fields", async () => {
      const result = await FuelCardService.processIncomingTransaction(
        {},
        "tenant-456",
      );
      expect(result.truckId).toBe("UNKNOWN");
      expect(result.driverId).toBe("UNKNOWN");
      expect(result.stateCode).toBe("XX");
      expect(result.gallons).toBe(0);
      expect(result.unitPrice).toBe(0);
      expect(result.totalCost).toBe(0);
      expect(result.vendorName).toBe("Generic Fuel Stop");
    });

    it("invokes auto-matching rule engine with the fuel entry", async () => {
      await FuelCardService.processIncomingTransaction(sampleTx, "tenant-123");
      expect(getVaultDocs).toHaveBeenCalledWith({});
      expect(executeFuelMatchingRule).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ truckId: "TRUCK-42" }),
        ]),
        expect.any(Array),
        expect.objectContaining({
          id: "auto-fuel-match",
          trigger: "doc_upload",
          action: "match_receipt",
        }),
      );
    });

    it("returns the FuelEntry even when matching finds no matches", async () => {
      vi.mocked(executeFuelMatchingRule).mockResolvedValue({
        matched: 0,
        orphaned: 1,
      });
      const result = await FuelCardService.processIncomingTransaction(
        sampleTx,
        "tenant-123",
      );
      expect(result.truckId).toBe("TRUCK-42");
    });

    it("returns the FuelEntry when matching finds matches", async () => {
      vi.mocked(executeFuelMatchingRule).mockResolvedValue({
        matched: 1,
        orphaned: 0,
      });
      const result = await FuelCardService.processIncomingTransaction(
        sampleTx,
        "tenant-123",
      );
      expect(result.truckId).toBe("TRUCK-42");
    });
  });

  // --- importBatch ---
  describe("importBatch", () => {
    it("sends a POST to the batch endpoint and returns entry count", async () => {
      mockPost.mockResolvedValue({ success: true });
      const entries = [{ id: "1" }, { id: "2" }, { id: "3" }];
      const count = await FuelCardService.importBatch(entries);
      expect(count).toBe(3);
      expect(mockPost).toHaveBeenCalledWith("/accounting/fuel/batch", entries);
    });

    it("throws on non-OK response", async () => {
      mockPost.mockRejectedValue(new Error("API Request failed: 400"));
      await expect(
        FuelCardService.importBatch([{ id: "1" }]),
      ).rejects.toThrow();
    });
  });

  // --- pushOptimalRoutes ---
  describe("pushOptimalRoutes", () => {
    it("resolves to true", async () => {
      const result = await FuelCardService.pushOptimalRoutes([
        "driver1",
        "driver2",
      ]);
      expect(result).toBe(true);
    });
  });
});
