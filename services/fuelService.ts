import { API_URL as API_BASE } from "./config";
import { FuelEntry, VaultDoc, AutomationRule } from "../types";
import { executeFuelMatchingRule } from "./rulesEngineService";
import { getVaultDocs } from "./financialService";
import { v4 as uuidv4 } from "uuid";

/**
 * FuelCardService handles the integration with external fuel card providers
 * (Comdata, WEX, EFS) and orchestrates the automatic matching with load records.
 */
export const FuelCardService = {
  /**
   * Simulates a real-time stream webhook from a fuel card provider.
   */
  processIncomingTransaction: async (
    rawTx: any,
    tenantId: string,
  ): Promise<FuelEntry> => {
    const fuelEntry: FuelEntry = {
      id: uuidv4(),
      tenantId,
      truckId: rawTx.unit_id || "UNKNOWN",
      driverId: rawTx.driver_id || "UNKNOWN",
      cardNumber: rawTx.card_number,
      transactionDate: rawTx.timestamp || new Date().toISOString(),
      stateCode: rawTx.state || "XX",
      gallons: Number(rawTx.gallons) || 0,
      unitPrice: Number(rawTx.price_per_gal) || 0,
      totalCost: Number(rawTx.total_amount) || 0,
      vendorName: rawTx.location_name || "Generic Fuel Stop",
      isIftaTaxable: true,
      isBillableToLoad: false,
    };

    // Auto-Trigger Matching Logic
    const docs = await getVaultDocs({});
    const defaultMatchRule: AutomationRule = {
      id: "auto-fuel-match",
      name: "Stream Meta-Match",
      enabled: true,
      trigger: "doc_upload",
      action: "match_receipt",
      configuration: { matchTolerance: 0.02, lookbackDays: 3 },
    };

    const result = await executeFuelMatchingRule(
      [fuelEntry],
      docs,
      defaultMatchRule,
    );
    if (result.matched > 0) {
    }

    return fuelEntry;
  },

  /**
   * Bulk import from a file (CSV/XLSX)
   */
  importBatch: async (entries: any[]): Promise<number> => {
    const res = await fetch(`${API_BASE}/accounting/fuel/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entries),
    });
    if (!res.ok) throw new Error("Failed to import fuel batch");
    return entries.length;
  },

  /**
   * Broadcasts optimal fuel stops based on current price anchors to all active drivers.
   */
  pushOptimalRoutes: async (drivers: string[]): Promise<boolean> => {
    // Simulate API call to mobile push service
    return new Promise((resolve) => setTimeout(() => resolve(true), 800));
  },
};
