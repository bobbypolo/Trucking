import { describe, it, expect, vi } from "vitest";

// Mock financialService to prevent real imports
vi.mock("../../../services/financialService", () => ({
  getBills: vi.fn(),
  uploadToVault: vi.fn(),
  getVaultDocs: vi.fn(),
}));

import {
  executeFuelMatchingRule,
  runRuleAutomation,
} from "../../../services/rulesEngineService";
import type { FuelEntry, VaultDoc, AutomationRule } from "../../../types";

describe("rulesEngineService", () => {
  // --- executeFuelMatchingRule ---
  describe("executeFuelMatchingRule", () => {
    const baseRule: AutomationRule = {
      id: "rule-1",
      name: "Test Rule",
      enabled: true,
      trigger: "doc_upload",
      action: "match_receipt",
      configuration: { matchTolerance: 0.05, lookbackDays: 3 },
    };

    const makePurchase = (
      overrides: Partial<FuelEntry> = {},
    ): FuelEntry => ({
      id: "fuel-1",
      tenantId: "tenant-1",
      truckId: "TRUCK-42",
      driverId: "DRV-01",
      transactionDate: "2026-03-15T10:00:00Z",
      stateCode: "TX",
      gallons: 80,
      unitPrice: 3.5,
      totalCost: 280,
      vendorName: "Pilot",
      isIftaTaxable: true,
      isBillableToLoad: false,
      ...overrides,
    });

    const makeDoc = (overrides: Partial<VaultDoc> = {}): VaultDoc => ({
      id: "doc-1",
      tenantId: "tenant-1",
      type: "Fuel",
      url: "https://example.com/receipt.pdf",
      filename: "receipt.pdf",
      truckId: "TRUCK-42",
      status: "Submitted",
      isLocked: false,
      version: 1,
      createdBy: "user-1",
      createdAt: "2026-03-15T08:00:00Z",
      ...overrides,
    });

    it("matches a purchase to a doc with same truckId within lookback window", async () => {
      const result = await executeFuelMatchingRule(
        [makePurchase()],
        [makeDoc()],
        baseRule,
      );
      expect(result.matched).toBe(1);
      expect(result.orphaned).toBe(0);
    });

    it("reports orphaned when no matching doc exists", async () => {
      const result = await executeFuelMatchingRule(
        [makePurchase()],
        [],
        baseRule,
      );
      expect(result.matched).toBe(0);
      expect(result.orphaned).toBe(1);
    });

    it("does not match doc with different truckId", async () => {
      const result = await executeFuelMatchingRule(
        [makePurchase()],
        [makeDoc({ truckId: "TRUCK-99" })],
        baseRule,
      );
      expect(result.matched).toBe(0);
      expect(result.orphaned).toBe(1);
    });

    it("does not match doc with non-Fuel type", async () => {
      const result = await executeFuelMatchingRule(
        [makePurchase()],
        [makeDoc({ type: "BOL" })],
        baseRule,
      );
      expect(result.matched).toBe(0);
      expect(result.orphaned).toBe(1);
    });

    it("does not match doc outside the lookback window", async () => {
      const result = await executeFuelMatchingRule(
        [makePurchase({ transactionDate: "2026-03-15T10:00:00Z" })],
        [makeDoc({ createdAt: "2026-03-01T08:00:00Z" })], // 14 days before
        baseRule,
      );
      expect(result.matched).toBe(0);
      expect(result.orphaned).toBe(1);
    });

    it("matches within the configured lookback window", async () => {
      // Purchase on March 15, doc on March 13 (2 days = within 3-day window)
      const result = await executeFuelMatchingRule(
        [makePurchase({ transactionDate: "2026-03-15T10:00:00Z" })],
        [makeDoc({ createdAt: "2026-03-13T08:00:00Z" })],
        baseRule,
      );
      expect(result.matched).toBe(1);
    });

    it("uses default lookbackDays=7 when not specified in rule", async () => {
      const ruleNoLookback: AutomationRule = {
        ...baseRule,
        configuration: { matchTolerance: 0.05 },
      };
      // 5 days apart — should match with default 7-day lookback
      const result = await executeFuelMatchingRule(
        [makePurchase({ transactionDate: "2026-03-15T10:00:00Z" })],
        [makeDoc({ createdAt: "2026-03-10T08:00:00Z" })],
        ruleNoLookback,
      );
      expect(result.matched).toBe(1);
    });

    it("handles multiple purchases — some matched, some orphaned", async () => {
      const purchases = [
        makePurchase({ id: "fuel-1", truckId: "TRUCK-42" }),
        makePurchase({ id: "fuel-2", truckId: "TRUCK-99" }),
        makePurchase({ id: "fuel-3", truckId: "TRUCK-42" }),
      ];
      const docs = [makeDoc({ truckId: "TRUCK-42" })];
      const result = await executeFuelMatchingRule(purchases, docs, baseRule);
      // Both TRUCK-42 purchases match the same doc
      expect(result.matched).toBe(2);
      expect(result.orphaned).toBe(1);
    });

    it("handles empty purchases array", async () => {
      const result = await executeFuelMatchingRule(
        [],
        [makeDoc()],
        baseRule,
      );
      expect(result.matched).toBe(0);
      expect(result.orphaned).toBe(0);
    });
  });

  // --- runRuleAutomation ---
  describe("runRuleAutomation", () => {
    it("does nothing when rule is disabled", async () => {
      const rule: AutomationRule = {
        id: "r1",
        name: "Disabled Rule",
        enabled: false,
        trigger: "load_status_change",
        action: "update_ifta",
        configuration: {},
      };
      // Should not throw
      await expect(
        runRuleAutomation(rule, { status: "delivered" }),
      ).resolves.toBeUndefined();
    });

    it("handles load_status_change trigger with update_ifta action", async () => {
      const rule: AutomationRule = {
        id: "r2",
        name: "IFTA Update",
        enabled: true,
        trigger: "load_status_change",
        action: "update_ifta",
        configuration: {},
      };
      await expect(
        runRuleAutomation(rule, { status: "delivered" }),
      ).resolves.toBeUndefined();
    });

    it("handles doc_upload trigger with match_receipt action", async () => {
      const rule: AutomationRule = {
        id: "r3",
        name: "Receipt Match",
        enabled: true,
        trigger: "doc_upload",
        action: "match_receipt",
        configuration: {},
      };
      await expect(
        runRuleAutomation(rule, {}),
      ).resolves.toBeUndefined();
    });

    it("handles unknown trigger/action combinations gracefully", async () => {
      const rule: AutomationRule = {
        id: "r4",
        name: "Unknown Trigger",
        enabled: true,
        trigger: "gps_event",
        action: "create_load",
        configuration: {},
      };
      await expect(
        runRuleAutomation(rule, {}),
      ).resolves.toBeUndefined();
    });
  });
});
