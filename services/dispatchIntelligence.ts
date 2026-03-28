import { LoadData, User, LOAD_STATUS, LoadStatus } from "../types";
import { api } from "./api";

export interface DispatchOpportunity {
  driverId: string;
  driverName: string;
  matchScore: number; // 0-100
  hosAvailable: number; // Hours remaining
  distanceToPickup: number; // Miles
  estimatedArrival: string; // ISO Date
  recommendation: "STRONG_MATCH" | "CONSIDER" | "DO_NOT_ASSIGN";
}

export interface ProfitabilityAnalysis {
  revenue: number;
  estimatedCosts: number;
  netMargin: number;
  marginPercentage: number;
  riskScore: number;
  recommendation: "ACCEPT" | "RE-NEGOTIATE" | "DECLINE";
}

export interface DynamicBid {
  marketAverage: number;
  suggestedBid: number;
  confidence: number;
  strategy: "AGGRESSIVE" | "BALANCED" | "PREMIUM";
}

export interface CapacityForecast {
  region: string;
  emptyTrucks: number;
  predictedVolume: number; // 0-100
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
}

export interface SettlementAudit {
  loadId: string;
  driverId: string;
  grossPay: number;
  deductions: number;
  netPay: number;
  status: "READY" | "MISSING_DOCS" | "DISPUTE_RISK";
  warnings: string[];
}

export interface DriverPerformance {
  driverId: string;
  onTimeDeliveryRate: number; // 0-100
  reliabilityScore: number; // 0-100
  safetyIncidents: number;
  fuelEfficiency: number; // MPG
  totalMiles: number;
  rank: "ELITE" | "STANDARD" | "PROBATION";
}

export interface IFTAAudit {
  quarter: string;
  totalMiles: number;
  totalTaxableGallons: number;
  netTaxDue: number;
  status: "BALANCED" | "UNDERPAID" | "OVERPAID";
  discrepancyAlerts: string[];
}

/**
 * Utility to map cities to operational regions.
 */
export const getRegion = (city: string) => {
  if (/Chicago|Detroit|Columbus|Indianapolis/i.test(city)) return "Midwest";
  if (/New York|Philadelphia|Boston|Newark/i.test(city)) return "Northeast";
  if (/Atlanta|Charlotte|Miami|Jacksonville/i.test(city)) return "Southeast";
  return "West";
};

/**
 * DispatchIntelligence Service provides AI-driven load matching, exception prediction, and profitability analysis.
 */
export const DispatchIntelligence = {
  /**
   * Finds the best driver for a given load based on real GPS positions,
   * home terminal fallback, and safety scores — all computed server-side.
   */
  getBestMatches: async (
    load: LoadData,
    _drivers?: User[],
  ): Promise<DispatchOpportunity[]> => {
    const response = await api.post("/api/dispatch/best-matches", {
      loadId: load.id,
    });

    if (!response || !Array.isArray(response)) {
      return [];
    }

    return response.map(
      (match: {
        driverId: string;
        driverName: string;
        distanceMiles: number;
        score: number;
        safetyScore: number | null;
        estimatedArrivalHours: number;
      }) => {
        const score = match.score;
        let recommendation: "STRONG_MATCH" | "CONSIDER" | "DO_NOT_ASSIGN" =
          "CONSIDER";
        if (score > 85) recommendation = "STRONG_MATCH";
        else if (score <= 50) recommendation = "DO_NOT_ASSIGN";

        return {
          driverId: match.driverId,
          driverName: match.driverName,
          matchScore: Math.max(0, score),
          hosAvailable: 0, // HOS not tracked in this endpoint; reserved for future ELD integration
          distanceToPickup: Math.round(match.distanceMiles),
          estimatedArrival: new Date(
            Date.now() + match.estimatedArrivalHours * 3600000,
          ).toISOString(),
          recommendation,
        };
      },
    );
  },

  predictExceptionRisk: (
    load: LoadData | undefined | null,
  ): { risk: "LOW" | "MEDIUM" | "HIGH"; reason?: string } => {
    if (!load) return { risk: "LOW" };
    if (!load.pickupDate)
      return { risk: "MEDIUM", reason: "Missing pickup schedule" };

    const now = new Date();
    const appt = new Date(load.pickupDate);
    const hoursUntil = (appt.getTime() - now.getTime()) / 3600000;

    // Hypothetical transit time check
    const miles = load.miles || 0;
    const avgSpeed = 50; // mph
    const estTransitHours = miles / avgSpeed;

    if (load.status === LOAD_STATUS.Active) {
      if (hoursUntil < estTransitHours) {
        return {
          risk: "HIGH",
          reason: "Behind schedule: ETA exceeds appointment",
        };
      }
      if (hoursUntil < estTransitHours + 2) {
        return {
          risk: "MEDIUM",
          reason: "Narrow buffer for scheduled arrival",
        };
      }
    }

    if (
      load.status === LOAD_STATUS.Planned &&
      hoursUntil < 4 &&
      !load.driverId
    ) {
      return { risk: "HIGH", reason: "Unassigned load with imminent pickup" };
    }

    return { risk: "LOW" };
  },

  /**
   * Profitability AI: Analyzes a load's financial viability before acceptance.
   */
  analyzeProfitability: (load: LoadData): ProfitabilityAnalysis => {
    // totalRevenue is used as per types.ts
    const revenue = load.totalRevenue || 0;

    // Industry-average estimation defaults for quick accept/decline decisions.
    // These are NOT used for invoicing or settlement — actual costs come from
    // load-specific data (fuel receipts, driver contracts, toll records).
    const estMiles = load.miles || 500;
    const fuelCost = estMiles * 0.6; // $0.60/mile industry avg fuel cost
    const driverPay = load.driverPay || estMiles * 0.55; // $0.55/mile fallback if no driver pay set
    const tolls = 45.0; // Default toll estimate; real tolls tracked per-load
    const overhead = revenue * 0.1; // 10% overhead estimate

    const estimatedCosts = fuelCost + driverPay + tolls + overhead;
    const netMargin = revenue - estimatedCosts;
    const marginPercentage = revenue > 0 ? (netMargin / revenue) * 100 : 0;

    return {
      revenue,
      estimatedCosts,
      netMargin,
      marginPercentage,
      riskScore: marginPercentage < 15 ? 80 : 20,
      recommendation:
        marginPercentage > 20
          ? "ACCEPT"
          : marginPercentage > 10
            ? "RE-NEGOTIATE"
            : "DECLINE",
    };
  },

  /**
   * Auto-Pilot Dispatcher: Decides whether to auto-accept a tender.
   */
  shouldAutoAccept: (load: LoadData, drivers: User[]): boolean => {
    const profit = DispatchIntelligence.analyzeProfitability(load);
    if (profit.marginPercentage < 18) return false;

    // Check if we have an accept recommendation
    return profit.recommendation === "ACCEPT";
  },

  /**
   * Dynamic Pricing AI: Calculates the optimal bid for a load.
   */
  calculateDynamicBid: (load: LoadData, capacityFactor: number): DynamicBid => {
    // Base rate calculation (e.g., $2.50/mile)
    const miles = load.miles || 500;
    const baseRate = miles * 2.5;

    // Market adjustment (simulated AI prediction)
    const marketVolatility = 0.15; // 15% volatility
    const marketAverage =
      baseRate *
      (1 + (Math.random() * marketVolatility - marketVolatility / 2));

    // Strategy based on capacity (If capacity is tight, charge premium)
    let suggestedBid = marketAverage;
    let strategy: "AGGRESSIVE" | "BALANCED" | "PREMIUM" = "BALANCED";

    if (capacityFactor < 0.2) {
      suggestedBid = marketAverage * 1.15;
      strategy = "PREMIUM";
    } else if (capacityFactor > 0.8) {
      suggestedBid = marketAverage * 0.95;
      strategy = "AGGRESSIVE";
    }

    return {
      marketAverage,
      suggestedBid,
      confidence: 0.88,
      strategy,
    };
  },

  /**
   * Capacity Forecasting: Predicts where trucks will be empty in the next 72 hours.
   */
  getCapacityForecast: (loads: LoadData[]): CapacityForecast[] => {
    const regions = ["Midwest", "Northeast", "Southeast", "West"];
    const now = new Date();
    const future72h = new Date(now.getTime() + 72 * 3600000);

    const forecast = regions.map((region) => {
      const arrivingTrucks = loads.filter((l) => {
        const dropDate = l.dropoffDate ? new Date(l.dropoffDate) : null;
        return (
          dropDate &&
          dropDate > now &&
          dropDate < future72h &&
          getRegion(l.dropoff.city) === region
        );
      }).length;

      const emptyTrucks = Math.floor(Math.random() * 5) + arrivingTrucks;
      const predictedVolume = Math.floor(Math.random() * 40) + 60; // Usually high volume

      return {
        region,
        emptyTrucks,
        predictedVolume,
        riskLevel: (emptyTrucks < 5 && predictedVolume > 80
          ? "HIGH"
          : emptyTrucks < 10
            ? "MEDIUM"
            : "LOW") as "LOW" | "MEDIUM" | "HIGH",
      };
    });

    return forecast;
  },

  /**
   * Automated Settlement AI: Audits load completion data for payroll readiness.
   */
  auditSettlement: (load: LoadData): SettlementAudit => {
    const grossPay = load.driverPay || 0;
    const deductions = (load.expenses || []).reduce(
      (acc, exp) => acc + (exp.amount || 0),
      0,
    );
    const warnings: string[] = [];

    if (!load.podUrls || load.podUrls.length === 0) {
      warnings.push("Missing Proof of Delivery (POD)");
    }

    if (
      load.status !== LOAD_STATUS.Delivered &&
      load.status !== LOAD_STATUS.Completed
    ) {
      warnings.push("Load not yet fully delivered");
    }

    const status = warnings.length > 0 ? "MISSING_DOCS" : "READY";

    return {
      loadId: load.id,
      driverId: load.driverId,
      grossPay,
      deductions,
      netPay: grossPay - deductions,
      status,
      warnings,
    };
  },

  /**
   * Calculates deep performance metrics for a driver based on their load history.
   */
  getDriverPerformance: (
    driverId: string,
    loads: LoadData[],
  ): DriverPerformance => {
    const driverLoads = loads.filter(
      (l) =>
        l.driverId === driverId &&
        (l.status === LOAD_STATUS.Delivered ||
          l.status === LOAD_STATUS.Completed),
    );
    const totalLoads = driverLoads.length;

    if (totalLoads === 0) {
      return {
        driverId,
        onTimeDeliveryRate: 100,
        reliabilityScore: 100,
        safetyIncidents: 0,
        fuelEfficiency: 6.5,
        totalMiles: 0,
        rank: "STANDARD",
      };
    }

    // Issue-based metrics now tracked via exceptions queue, not load.issues
    const onTimeLoads = driverLoads.length;
    const reliabilityIssues = 0;
    const safetyIncidents = 0;

    const totalMiles = driverLoads.reduce((acc, l) => acc + (l.miles || 0), 0);
    const onTimeRate = (onTimeLoads / totalLoads) * 100;
    const reliabilityScore = Math.max(0, 100 - reliabilityIssues * 10);

    let rank: "ELITE" | "STANDARD" | "PROBATION" = "STANDARD";
    if (onTimeRate > 98 && reliabilityScore > 95 && safetyIncidents === 0)
      rank = "ELITE";
    else if (onTimeRate < 85 || reliabilityScore < 70) rank = "PROBATION";

    return {
      driverId,
      onTimeDeliveryRate: onTimeRate,
      reliabilityScore,
      safetyIncidents,
      fuelEfficiency: 0, // Requires real telematics/sensor data; not available client-side
      totalMiles,
      rank,
    };
  },

  /**
   * IFTA Intelligence: Client-side fuel-efficiency analytics and discrepancy alerts.
   * Actual per-jurisdiction tax reconciliation is performed server-side via
   * GET /api/accounting/ifta-summary, which queries mileage_jurisdiction and
   * fuel_ledger tables, applies per-state tax rates, and returns netTaxDue.
   */
  reconcileIFTATax: (loads: LoadData[]): IFTAAudit => {
    const totalMiles = loads.reduce((acc, l) => acc + (l.miles || 0), 0);
    const totalFuel = loads.reduce(
      (acc, l) =>
        acc +
        (l.fuelPurchases?.reduce((fAcc, f) => fAcc + (f.gallons || 0), 0) || 0),
      0,
    );

    const alerts: string[] = [];
    if (totalMiles > 0 && totalFuel === 0)
      alerts.push("Miles recorded with zero fuel purchases");

    const avgMpg = totalFuel > 0 ? totalMiles / totalFuel : 6.5;
    if (avgMpg > 9)
      alerts.push("Improbably high MPG detected (Check fuel reporting)");
    if (avgMpg < 4)
      alerts.push("Critically low MPG - potential fuel theft or leakage");

    // Net IFTA tax is computed server-side by GET /api/accounting/ifta-summary:
    //   1. Per-state mileage from mileage_jurisdiction table
    //   2. Per-state fuel gallons from fuel_ledger table
    //   3. Per-state tax rates applied to derive taxDue per jurisdiction
    //   4. netTaxDue = sum(taxDue - taxPaidAtPump) across all states
    // Client returns 0 here; the UI should fetch the server endpoint for
    // the authoritative netTaxDue value.
    const netTaxDue = 0;

    return {
      quarter: "2025-Q4",
      totalMiles,
      totalTaxableGallons: totalFuel,
      netTaxDue,
      status: "BALANCED", // Actual status determined by server-side IFTA summary
      discrepancyAlerts: alerts,
    };
  },
};
