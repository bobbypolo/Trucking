import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  executeFuelMatchingRule,
  runRuleAutomation,
} from "../../../services/rulesEngineService";
import type { FuelEntry, VaultDoc, AutomationRule } from "../../../types";

// Mock financialService — rulesEngineService imports from it
vi.mock("../../../services/financialService", () => ({
  getBills: vi.fn().mockResolvedValue([]),
  uploadToVault: vi.fn().mockResolvedValue({}),
  getVaultDocs: vi.fn().mockResolvedValue([]),
}));

describe("rulesEngineService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── executeFuelMatchingRule ────────────────────────────────────────

  describe("executeFuelMatchingRule", () => {
    const baseRule: AutomationRule = {
      id: "rule-1",
      name: "Fuel matching",
      enabled: true,
      trigger: "doc_upload",
      action: "match_receipt",
      configuration: {
        matchTolerance: 0.05,
        lookbackDays: 7,
      },
    };

    it("returns zero matched when purchases array is empty", async () => {
      const result = await executeFuelMatchingRule([], [], baseRule);
      expect(result).toEqual({ matched: 0, orphaned: 0 });
    });

    it("returns all orphaned when no docs exist", async () => {
      const purchases: FuelEntry[] = [
        {
          id: "fuel-1",
          truckId: "TRUCK-1",
          driverId: "DRV-1",
          tenantId: "TEST",
          transactionDate: "2026-03-10",
          gallons: 100,
          unitPrice: 3.5,
          totalCost: 350,
          vendorName: "Test Vendor",
          isIftaTaxable: true,
          isBillableToLoad: false,
          stateCode: "IL",
        },
      ];

      const result = await executeFuelMatchingRule(purchases, [], baseRule);
      expect(result.matched).toBe(0);
      expect(result.orphaned).toBe(1);
    });

    it("matches a purchase to a doc with same truckId within lookback window", async () => {
      const purchases: FuelEntry[] = [
        {
          id: "fuel-1",
          truckId: "TRUCK-1",
          driverId: "DRV-1",
          tenantId: "TEST",
          transactionDate: "2026-03-10",
          gallons: 100,
          unitPrice: 3.5,
          totalCost: 350,
          vendorName: "Test Vendor",
          isIftaTaxable: true,
          isBillableToLoad: false,
          stateCode: "IL",
        },
      ];

      const docs: VaultDoc[] = [
        {
          id: "doc-1",
          companyId: "COMP-1",
          type: "Fuel",
          fileName: "receipt.pdf",
          url: "/vault/receipt.pdf",
          uploadedBy: "user-1",
          createdAt: "2026-03-11",
          truckId: "TRUCK-1",
          status: "active",
        },
      ] as any;

      const result = await executeFuelMatchingRule(purchases, docs, baseRule);
      expect(result.matched).toBe(1);
      expect(result.orphaned).toBe(0);
    });

    it("does not match when doc type is not Fuel", async () => {
      const purchases: FuelEntry[] = [
        {
          id: "fuel-1",
          truckId: "TRUCK-1",
          driverId: "DRV-1",
          tenantId: "TEST",
          transactionDate: "2026-03-10",
          gallons: 50,
          unitPrice: 3.5,
          totalCost: 175,
          vendorName: "Test Vendor",
          isIftaTaxable: true,
          isBillableToLoad: false,
          stateCode: "IL",
        },
      ];

      const docs: VaultDoc[] = [
        {
          id: "doc-1",
          companyId: "COMP-1",
          type: "BOL",
          fileName: "bol.pdf",
          url: "/vault/bol.pdf",
          uploadedBy: "user-1",
          createdAt: "2026-03-11",
          truckId: "TRUCK-1",
          status: "active",
        },
      ] as any;

      const result = await executeFuelMatchingRule(purchases, docs, baseRule);
      expect(result.matched).toBe(0);
      expect(result.orphaned).toBe(1);
    });

    it("does not match when truckId differs", async () => {
      const purchases: FuelEntry[] = [
        {
          id: "fuel-1",
          truckId: "TRUCK-1",
          driverId: "DRV-1",
          tenantId: "TEST",
          transactionDate: "2026-03-10",
          gallons: 50,
          unitPrice: 3.5,
          totalCost: 175,
          vendorName: "Test Vendor",
          isIftaTaxable: true,
          isBillableToLoad: false,
          stateCode: "IL",
        },
      ];

      const docs: VaultDoc[] = [
        {
          id: "doc-1",
          companyId: "COMP-1",
          type: "Fuel",
          fileName: "receipt.pdf",
          url: "/vault/receipt.pdf",
          uploadedBy: "user-1",
          createdAt: "2026-03-11",
          truckId: "TRUCK-2",
          status: "active",
        },
      ] as any;

      const result = await executeFuelMatchingRule(purchases, docs, baseRule);
      expect(result.matched).toBe(0);
      expect(result.orphaned).toBe(1);
    });

    it("does not match when doc is outside lookback window", async () => {
      const purchases: FuelEntry[] = [
        {
          id: "fuel-1",
          truckId: "TRUCK-1",
          driverId: "DRV-1",
          tenantId: "TEST",
          transactionDate: "2026-03-01",
          gallons: 50,
          unitPrice: 3.5,
          totalCost: 175,
          vendorName: "Test Vendor",
          isIftaTaxable: true,
          isBillableToLoad: false,
          stateCode: "IL",
        },
      ];

      const docs: VaultDoc[] = [
        {
          id: "doc-1",
          companyId: "COMP-1",
          type: "Fuel",
          fileName: "receipt.pdf",
          url: "/vault/receipt.pdf",
          uploadedBy: "user-1",
          createdAt: "2026-03-15",
          truckId: "TRUCK-1",
          status: "active",
        },
      ] as any;

      const result = await executeFuelMatchingRule(purchases, docs, baseRule);
      expect(result.matched).toBe(0);
      expect(result.orphaned).toBe(1);
    });

    it("uses default lookbackDays of 7 when not specified in rule", async () => {
      const ruleNoLookback: AutomationRule = {
        ...baseRule,
        configuration: { matchTolerance: 0.05 },
      };

      const purchases: FuelEntry[] = [
        {
          id: "fuel-1",
          truckId: "TRUCK-1",
          driverId: "DRV-1",
          tenantId: "TEST",
          transactionDate: "2026-03-10",
          gallons: 50,
          unitPrice: 3.5,
          totalCost: 175,
          vendorName: "Test Vendor",
          isIftaTaxable: true,
          isBillableToLoad: false,
          stateCode: "IL",
        },
      ];

      const docs: VaultDoc[] = [
        {
          id: "doc-1",
          companyId: "COMP-1",
          type: "Fuel",
          fileName: "receipt.pdf",
          url: "/vault/receipt.pdf",
          uploadedBy: "user-1",
          createdAt: "2026-03-14",
          truckId: "TRUCK-1",
          status: "active",
        },
      ] as any;

      const result = await executeFuelMatchingRule(
        purchases,
        docs,
        ruleNoLookback,
      );
      expect(result.matched).toBe(1);
    });

    it("handles multiple purchases with mixed matches", async () => {
      const purchases: FuelEntry[] = [
        {
          id: "fuel-1",
          truckId: "TRUCK-1",
          driverId: "DRV-1",
          tenantId: "TEST",
          transactionDate: "2026-03-10",
          gallons: 100,
          unitPrice: 3.5,
          totalCost: 350,
          vendorName: "Test Vendor",
          isIftaTaxable: true,
          isBillableToLoad: false,
          stateCode: "IL",
        },
        {
          id: "fuel-2",
          truckId: "TRUCK-2",
          driverId: "DRV-2",
          tenantId: "TEST",
          transactionDate: "2026-03-10",
          gallons: 80,
          unitPrice: 3.5,
          totalCost: 280,
          vendorName: "Test Vendor",
          isIftaTaxable: true,
          isBillableToLoad: false,
          stateCode: "WI",
        },
      ];

      const docs: VaultDoc[] = [
        {
          id: "doc-1",
          companyId: "COMP-1",
          type: "Fuel",
          fileName: "receipt.pdf",
          url: "/vault/receipt.pdf",
          uploadedBy: "user-1",
          createdAt: "2026-03-11",
          truckId: "TRUCK-1",
          status: "active",
        },
      ] as any;

      const result = await executeFuelMatchingRule(purchases, docs, baseRule);
      expect(result.matched).toBe(1);
      expect(result.orphaned).toBe(1);
    });
  });

  // ─── runRuleAutomation ─────────────────────────────────────────────

  describe("runRuleAutomation", () => {
    it("does nothing when rule is disabled", async () => {
      const rule: AutomationRule = {
        id: "rule-1",
        name: "Disabled rule",
        enabled: false,
        trigger: "load_status_change",
        action: "update_ifta",
        configuration: {},
      };

      // Should return undefined (early return)
      const result = await runRuleAutomation(rule, {
        status: "delivered",
      });
      expect(result).toBeUndefined();
    });

    it("handles load_status_change trigger with update_ifta action", async () => {
      const rule: AutomationRule = {
        id: "rule-2",
        name: "Auto-IFTA",
        enabled: true,
        trigger: "load_status_change",
        action: "update_ifta",
        configuration: {},
      };

      // Should not throw even though the IFTA call is a no-op
      await expect(
        runRuleAutomation(rule, { status: "delivered" }),
      ).resolves.not.toThrow();
    });

    it("handles doc_upload trigger with match_receipt action", async () => {
      const rule: AutomationRule = {
        id: "rule-3",
        name: "Auto-match",
        enabled: true,
        trigger: "doc_upload",
        action: "match_receipt",
        configuration: {},
      };

      await expect(runRuleAutomation(rule, {})).resolves.not.toThrow();
    });

    it("handles unmatched trigger/action combinations gracefully", async () => {
      const rule: AutomationRule = {
        id: "rule-4",
        name: "GPS rule",
        enabled: true,
        trigger: "gps_event",
        action: "notify_accounting",
        configuration: {},
      };

      // No matching case in switch — should not throw
      await expect(runRuleAutomation(rule, {})).resolves.not.toThrow();
    });
  });
});
