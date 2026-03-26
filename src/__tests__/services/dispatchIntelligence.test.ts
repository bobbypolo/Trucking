import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted so mock fns are available when vi.mock factory runs (hoisted)
const { mockPost } = vi.hoisted(() => ({
  mockPost: vi.fn(),
}));

vi.mock("../../../services/api", () => ({
  api: {
    post: mockPost,
    get: vi.fn(),
  },
}));

import {
  DispatchIntelligence,
  getRegion,
} from "../../../services/dispatchIntelligence";
import type { LoadData, User } from "../../../types";

// Helper to create a minimal LoadData
const makeLoad = (overrides: Partial<LoadData> = {}): LoadData =>
  ({
    id: "load-1",
    companyId: "c1",
    driverId: "drv-1",
    loadNumber: "LD-1000",
    status: "draft",
    carrierRate: 3000,
    driverPay: 1500,
    pickupDate: new Date(Date.now() + 24 * 3600000).toISOString().split("T")[0],
    legs: [],
    pickup: { city: "Chicago", state: "IL", facilityName: "" },
    dropoff: { city: "Detroit", state: "MI", facilityName: "" },
    createdAt: Date.now(),
    version: 1,
    ...overrides,
  }) as LoadData;

const makeDriver = (overrides: Partial<User> = {}): User =>
  ({
    id: "drv-test",
    companyId: "c1",
    email: "driver@test.com",
    name: "Test Driver",
    role: "driver",
    safetyScore: 90,
    ...overrides,
  }) as User;

describe("dispatchIntelligence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── getRegion ───────────────────────────────────────────────────────
  describe("getRegion", () => {
    it("maps Chicago to Midwest", () => {
      expect(getRegion("Chicago")).toBe("Midwest");
    });

    it("maps Detroit to Midwest", () => {
      expect(getRegion("Detroit")).toBe("Midwest");
    });

    it("maps Columbus to Midwest", () => {
      expect(getRegion("Columbus")).toBe("Midwest");
    });

    it("maps Indianapolis to Midwest", () => {
      expect(getRegion("Indianapolis")).toBe("Midwest");
    });

    it("maps New York to Northeast", () => {
      expect(getRegion("New York")).toBe("Northeast");
    });

    it("maps Philadelphia to Northeast", () => {
      expect(getRegion("Philadelphia")).toBe("Northeast");
    });

    it("maps Boston to Northeast", () => {
      expect(getRegion("Boston")).toBe("Northeast");
    });

    it("maps Newark to Northeast", () => {
      expect(getRegion("Newark")).toBe("Northeast");
    });

    it("maps Atlanta to Southeast", () => {
      expect(getRegion("Atlanta")).toBe("Southeast");
    });

    it("maps Charlotte to Southeast", () => {
      expect(getRegion("Charlotte")).toBe("Southeast");
    });

    it("maps Miami to Southeast", () => {
      expect(getRegion("Miami")).toBe("Southeast");
    });

    it("maps Jacksonville to Southeast", () => {
      expect(getRegion("Jacksonville")).toBe("Southeast");
    });

    it("defaults to West for unknown cities", () => {
      expect(getRegion("Los Angeles")).toBe("West");
      expect(getRegion("Denver")).toBe("West");
      expect(getRegion("Some Random Town")).toBe("West");
    });

    it("is case-insensitive", () => {
      expect(getRegion("chicago")).toBe("Midwest");
      expect(getRegion("MIAMI")).toBe("Southeast");
    });
  });

  // ─── getBestMatches (API-backed) ────────────────────────────────────
  describe("getBestMatches", () => {
    it("calls API with load.id and returns mapped results", async () => {
      mockPost.mockResolvedValueOnce([
        {
          driverId: "drv-1",
          driverName: "Alice Smith",
          distanceMiles: 25.3,
          score: 95,
          safetyScore: 98,
          estimatedArrivalHours: 0.46,
        },
      ]);

      const load = makeLoad({ id: "load-api-1" });
      const matches = await DispatchIntelligence.getBestMatches(load);

      expect(mockPost).toHaveBeenCalledWith("/api/dispatch/best-matches", {
        loadId: "load-api-1",
      });
      expect(matches).toHaveLength(1);
      expect(matches[0].driverId).toBe("drv-1");
      expect(matches[0].driverName).toBe("Alice Smith");
      expect(matches[0].distanceToPickup).toBe(25);
      expect(matches[0].matchScore).toBe(95);
      expect(matches[0].recommendation).toBe("STRONG_MATCH");
    });

    it("returns empty array when API returns null", async () => {
      mockPost.mockResolvedValueOnce(null);

      const load = makeLoad();
      const matches = await DispatchIntelligence.getBestMatches(load);
      expect(matches).toHaveLength(0);
    });

    it("returns empty array when API returns non-array", async () => {
      mockPost.mockResolvedValueOnce({ error: "not found" });

      const load = makeLoad();
      const matches = await DispatchIntelligence.getBestMatches(load);
      expect(matches).toHaveLength(0);
    });

    it("maps CONSIDER recommendation for mid-range scores", async () => {
      mockPost.mockResolvedValueOnce([
        {
          driverId: "drv-2",
          driverName: "Bob Jones",
          distanceMiles: 100,
          score: 70,
          safetyScore: 85,
          estimatedArrivalHours: 1.82,
        },
      ]);

      const load = makeLoad();
      const matches = await DispatchIntelligence.getBestMatches(load);
      expect(matches[0].recommendation).toBe("CONSIDER");
      expect(matches[0].matchScore).toBe(70);
    });

    it("maps DO_NOT_ASSIGN for low scores", async () => {
      mockPost.mockResolvedValueOnce([
        {
          driverId: "drv-3",
          driverName: "Far Driver",
          distanceMiles: 500,
          score: 30,
          safetyScore: 60,
          estimatedArrivalHours: 9.09,
        },
      ]);

      const load = makeLoad();
      const matches = await DispatchIntelligence.getBestMatches(load);
      expect(matches[0].recommendation).toBe("DO_NOT_ASSIGN");
      expect(matches[0].matchScore).toBe(30);
    });

    it("returns estimatedArrival as ISO string", async () => {
      mockPost.mockResolvedValueOnce([
        {
          driverId: "drv-4",
          driverName: "Test D",
          distanceMiles: 50,
          score: 80,
          safetyScore: 90,
          estimatedArrivalHours: 0.91,
        },
      ]);

      const load = makeLoad();
      const matches = await DispatchIntelligence.getBestMatches(load);
      expect(matches[0].estimatedArrival).toMatch(/\d{4}-\d{2}-\d{2}T/);
    });

    it("matchScore is non-negative even for negative API scores", async () => {
      mockPost.mockResolvedValueOnce([
        {
          driverId: "drv-5",
          driverName: "Neg Score",
          distanceMiles: 1000,
          score: -10,
          safetyScore: 50,
          estimatedArrivalHours: 18.18,
        },
      ]);

      const load = makeLoad();
      const matches = await DispatchIntelligence.getBestMatches(load);
      expect(matches[0].matchScore).toBeGreaterThanOrEqual(0);
    });
  });

  // ─── predictExceptionRisk ────────────────────────────────────────────
  describe("predictExceptionRisk", () => {
    it("returns LOW risk for null/undefined load", () => {
      expect(DispatchIntelligence.predictExceptionRisk(null)).toEqual({
        risk: "LOW",
      });
      expect(DispatchIntelligence.predictExceptionRisk(undefined)).toEqual({
        risk: "LOW",
      });
    });

    it("returns MEDIUM risk for missing pickup schedule", () => {
      const load = makeLoad({ pickupDate: undefined as any });
      const result = DispatchIntelligence.predictExceptionRisk(load);
      expect(result.risk).toBe("MEDIUM");
      expect(result.reason).toContain("Missing pickup schedule");
    });

    it("returns HIGH risk for unassigned load with imminent pickup", () => {
      const load = makeLoad({
        status: "planned",
        pickupDate: new Date(Date.now() + 2 * 3600000).toISOString(),
        driverId: "",
      });
      const result = DispatchIntelligence.predictExceptionRisk(load);
      expect(result.risk).toBe("HIGH");
      expect(result.reason).toContain("Unassigned load with imminent pickup");
    });

    it("returns LOW risk for well-scheduled load", () => {
      const load = makeLoad({
        status: "draft",
        pickupDate: new Date(Date.now() + 72 * 3600000)
          .toISOString()
          .split("T")[0],
        driverId: "drv-1",
      });
      const result = DispatchIntelligence.predictExceptionRisk(load);
      expect(result.risk).toBe("LOW");
    });

    it("returns HIGH for active load behind schedule", () => {
      const load = makeLoad({
        status: "in_transit",
        pickupDate: new Date(Date.now() + 1 * 3600000).toISOString(),
        miles: 500,
      });
      const result = DispatchIntelligence.predictExceptionRisk(load);
      // 500 miles / 50mph = 10 hours, but only 1 hour until pickup
      expect(result.risk).toBe("HIGH");
      expect(result.reason).toContain("Behind schedule");
    });

    it("returns MEDIUM for active load with narrow buffer", () => {
      const load = makeLoad({
        status: "in_transit",
        pickupDate: new Date(Date.now() + 11 * 3600000).toISOString(),
        miles: 500,
      });
      const result = DispatchIntelligence.predictExceptionRisk(load);
      // 500/50 = 10h transit, 11h available = narrow buffer
      expect(result.risk).toBe("MEDIUM");
      expect(result.reason).toContain("Narrow buffer");
    });
  });

  // ─── analyzeProfitability ────────────────────────────────────────────
  describe("analyzeProfitability", () => {
    it("returns DECLINE for zero-revenue load", () => {
      const load = makeLoad({ totalRevenue: 0 } as any);
      const result = DispatchIntelligence.analyzeProfitability(load);
      expect(result.revenue).toBe(0);
      expect(result.recommendation).toBe("DECLINE");
    });

    it("returns ACCEPT for high-margin load", () => {
      const load = makeLoad({
        totalRevenue: 10000,
        miles: 200,
        driverPay: 500,
      } as any);
      const result = DispatchIntelligence.analyzeProfitability(load);
      expect(result.revenue).toBe(10000);
      expect(result.netMargin).toBeGreaterThan(0);
      expect(result.marginPercentage).toBeGreaterThan(20);
      expect(result.recommendation).toBe("ACCEPT");
    });

    it("returns RE-NEGOTIATE for moderate-margin load", () => {
      // Need to engineer a 10-20% margin
      const load = makeLoad({
        totalRevenue: 2000,
        miles: 500,
        driverPay: 275,
      } as any);
      const result = DispatchIntelligence.analyzeProfitability(load);
      // Costs: fuel=500*0.6=300, driverPay=275, tolls=45, overhead=200 = 820
      // Net margin: 2000 - 820 = 1180, %=59% -> ACCEPT
      // Let's adjust to get ~15% margin
      const load2 = makeLoad({
        totalRevenue: 1000,
        miles: 500,
        driverPay: 275,
      } as any);
      const result2 = DispatchIntelligence.analyzeProfitability(load2);
      // Costs: 300+275+45+100 = 720, margin = 280/1000 = 28% -> still ACCEPT

      // For RE-NEGOTIATE we need ~10-20%
      const load3 = makeLoad({
        totalRevenue: 800,
        miles: 500,
        driverPay: 275,
      } as any);
      const result3 = DispatchIntelligence.analyzeProfitability(load3);
      // Costs: 300+275+45+80 = 700, margin = 100/800 = 12.5% -> RE-NEGOTIATE
      expect(result3.recommendation).toBe("RE-NEGOTIATE");
    });

    it("calculates high riskScore for low margins", () => {
      const load = makeLoad({
        totalRevenue: 700,
        miles: 500,
        driverPay: 275,
      } as any);
      const result = DispatchIntelligence.analyzeProfitability(load);
      // Margin < 15% -> riskScore should be 80
      expect(result.riskScore).toBe(80);
    });

    it("calculates low riskScore for healthy margins", () => {
      const load = makeLoad({
        totalRevenue: 5000,
        miles: 200,
        driverPay: 500,
      } as any);
      const result = DispatchIntelligence.analyzeProfitability(load);
      expect(result.riskScore).toBe(20);
    });

    it("uses fallback costs when miles not provided", () => {
      const load = makeLoad({ totalRevenue: 5000 } as any);
      const result = DispatchIntelligence.analyzeProfitability(load);
      // Default miles = 500, fuelCost = 300, driverPay = load.driverPay(1500), tolls=45, overhead=500
      expect(result.estimatedCosts).toBeGreaterThan(0);
    });
  });

  // ─── shouldAutoAccept ────────────────────────────────────────────────
  describe("shouldAutoAccept", () => {
    it("returns true for high-margin load", () => {
      const load = makeLoad({
        totalRevenue: 10000,
        miles: 200,
        driverPay: 500,
      } as any);
      const drivers = [makeDriver()];
      expect(DispatchIntelligence.shouldAutoAccept(load, drivers)).toBe(true);
    });

    it("returns false for low-margin load", () => {
      const load = makeLoad({
        totalRevenue: 500,
        miles: 500,
        driverPay: 275,
      } as any);
      const drivers = [makeDriver()];
      expect(DispatchIntelligence.shouldAutoAccept(load, drivers)).toBe(false);
    });

    it("returns false for zero-revenue load", () => {
      const load = makeLoad({ totalRevenue: 0 } as any);
      const drivers = [makeDriver()];
      expect(DispatchIntelligence.shouldAutoAccept(load, drivers)).toBe(false);
    });
  });

  // ─── calculateDynamicBid ─────────────────────────────────────────────
  describe("calculateDynamicBid", () => {
    it("returns PREMIUM strategy for low capacity", () => {
      const load = makeLoad({ miles: 500 } as any);
      const bid = DispatchIntelligence.calculateDynamicBid(load, 0.1);
      expect(bid.strategy).toBe("PREMIUM");
      expect(bid.suggestedBid).toBeGreaterThan(bid.marketAverage);
    });

    it("returns AGGRESSIVE strategy for high capacity", () => {
      const load = makeLoad({ miles: 500 } as any);
      const bid = DispatchIntelligence.calculateDynamicBid(load, 0.9);
      expect(bid.strategy).toBe("AGGRESSIVE");
      expect(bid.suggestedBid).toBeLessThan(bid.marketAverage);
    });

    it("returns BALANCED strategy for moderate capacity", () => {
      const load = makeLoad({ miles: 500 } as any);
      const bid = DispatchIntelligence.calculateDynamicBid(load, 0.5);
      expect(bid.strategy).toBe("BALANCED");
    });

    it("uses default 500 miles when load.miles is undefined", () => {
      const load = makeLoad();
      const bid = DispatchIntelligence.calculateDynamicBid(load, 0.5);
      expect(bid.marketAverage).toBeGreaterThan(0);
    });

    it("confidence is 0.88", () => {
      const load = makeLoad({ miles: 300 } as any);
      const bid = DispatchIntelligence.calculateDynamicBid(load, 0.5);
      expect(bid.confidence).toBe(0.88);
    });
  });

  // ─── getCapacityForecast ─────────────────────────────────────────────
  describe("getCapacityForecast", () => {
    it("returns forecasts for all 4 regions", () => {
      const forecast = DispatchIntelligence.getCapacityForecast([]);
      expect(forecast).toHaveLength(4);
      const regions = forecast.map((f) => f.region);
      expect(regions).toContain("Midwest");
      expect(regions).toContain("Northeast");
      expect(regions).toContain("Southeast");
      expect(regions).toContain("West");
    });

    it("each forecast has required fields", () => {
      const forecast = DispatchIntelligence.getCapacityForecast([]);
      forecast.forEach((f) => {
        expect(f.region).toBeDefined();
        expect(typeof f.emptyTrucks).toBe("number");
        expect(typeof f.predictedVolume).toBe("number");
        expect(["LOW", "MEDIUM", "HIGH"]).toContain(f.riskLevel);
      });
    });

    it("counts arriving trucks from loads in the next 72 hours", () => {
      const now = new Date();
      const future = new Date(now.getTime() + 24 * 3600000);
      const loads = [
        makeLoad({
          dropoff: { city: "Chicago", state: "IL", facilityName: "" },
          dropoffDate: future.toISOString(),
        } as any),
      ];
      const forecast = DispatchIntelligence.getCapacityForecast(loads);
      const midwest = forecast.find((f) => f.region === "Midwest");
      expect(midwest).toBeDefined();
      expect(midwest!.emptyTrucks).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── auditSettlement ─────────────────────────────────────────────────
  describe("auditSettlement", () => {
    it("returns READY when load is delivered with POD", () => {
      const load = makeLoad({
        status: "delivered",
        driverPay: 1500,
        podUrls: ["pod1.jpg"],
        expenses: [],
      } as any);
      const audit = DispatchIntelligence.auditSettlement(load);
      expect(audit.status).toBe("READY");
      expect(audit.warnings).toHaveLength(0);
      expect(audit.grossPay).toBe(1500);
      expect(audit.netPay).toBe(1500);
    });

    it("returns MISSING_DOCS when no POD", () => {
      const load = makeLoad({
        status: "delivered",
        driverPay: 1500,
        podUrls: [],
        expenses: [],
      } as any);
      const audit = DispatchIntelligence.auditSettlement(load);
      expect(audit.status).toBe("MISSING_DOCS");
      expect(audit.warnings).toContain("Missing Proof of Delivery (POD)");
    });

    it("returns MISSING_DOCS when load not delivered", () => {
      const load = makeLoad({
        status: "in_transit",
        driverPay: 1500,
        podUrls: ["pod.jpg"],
        expenses: [],
      } as any);
      const audit = DispatchIntelligence.auditSettlement(load);
      expect(audit.status).toBe("MISSING_DOCS");
      expect(audit.warnings).toContain("Load not yet fully delivered");
    });

    it("calculates deductions from expenses", () => {
      const load = makeLoad({
        status: "completed",
        driverPay: 2000,
        podUrls: ["pod.jpg"],
        expenses: [
          { amount: 100, description: "Fuel advance" },
          { amount: 50, description: "Insurance" },
        ],
      } as any);
      const audit = DispatchIntelligence.auditSettlement(load);
      expect(audit.grossPay).toBe(2000);
      expect(audit.deductions).toBe(150);
      expect(audit.netPay).toBe(1850);
    });

    it("handles missing expenses gracefully", () => {
      const load = makeLoad({
        status: "delivered",
        driverPay: 1000,
        podUrls: ["pod.jpg"],
      } as any);
      const audit = DispatchIntelligence.auditSettlement(load);
      expect(audit.deductions).toBe(0);
      expect(audit.netPay).toBe(1000);
    });

    it("returns loadId and driverId", () => {
      const load = makeLoad({ driverId: "drv-x" });
      const audit = DispatchIntelligence.auditSettlement(load);
      expect(audit.loadId).toBe("load-1");
      expect(audit.driverId).toBe("drv-x");
    });
  });

  // ─── getDriverPerformance ────────────────────────────────────────────
  describe("getDriverPerformance", () => {
    it("returns STANDARD with 100% rates for driver with no completed loads", () => {
      const perf = DispatchIntelligence.getDriverPerformance("drv-1", []);
      expect(perf.driverId).toBe("drv-1");
      expect(perf.onTimeDeliveryRate).toBe(100);
      expect(perf.reliabilityScore).toBe(100);
      expect(perf.safetyIncidents).toBe(0);
      expect(perf.totalMiles).toBe(0);
      expect(perf.rank).toBe("STANDARD");
    });

    it("calculates on-time rate based on issues", () => {
      const loads = [
        makeLoad({
          id: "l1",
          driverId: "drv-1",
          status: "delivered",
          issues: [],
          miles: 300,
        } as any),
        makeLoad({
          id: "l2",
          driverId: "drv-1",
          status: "delivered",
          issues: [
            {
              id: "i1",
              category: "Dispatch",
              description: "Late delivery",
              status: "open",
            },
          ],
          miles: 200,
        } as any),
      ];
      const perf = DispatchIntelligence.getDriverPerformance("drv-1", loads);
      expect(perf.onTimeDeliveryRate).toBe(50); // 1 out of 2 on time
      expect(perf.totalMiles).toBe(500);
    });

    it("counts safety incidents", () => {
      const loads = [
        makeLoad({
          id: "l1",
          driverId: "drv-1",
          status: "completed",
          issues: [
            {
              id: "i1",
              category: "Safety",
              description: "Speeding",
              status: "open",
            },
            {
              id: "i2",
              category: "Incident",
              description: "Fender bender",
              status: "open",
            },
          ],
          miles: 100,
        } as any),
      ];
      const perf = DispatchIntelligence.getDriverPerformance("drv-1", loads);
      expect(perf.safetyIncidents).toBe(2);
    });

    it("assigns ELITE rank for perfect record", () => {
      const loads = Array.from({ length: 5 }, (_, i) =>
        makeLoad({
          id: `l-${i}`,
          driverId: "drv-1",
          status: "delivered",
          issues: [],
          miles: 100,
        } as any),
      );
      const perf = DispatchIntelligence.getDriverPerformance("drv-1", loads);
      expect(perf.onTimeDeliveryRate).toBe(100);
      expect(perf.reliabilityScore).toBe(100);
      expect(perf.rank).toBe("ELITE");
    });

    it("assigns PROBATION rank for poor performance", () => {
      const loads = Array.from({ length: 5 }, (_, i) =>
        makeLoad({
          id: `l-${i}`,
          driverId: "drv-1",
          status: "delivered",
          issues: [
            {
              id: `i-${i}`,
              category: "Dispatch",
              description: "Late delivery",
              status: "open",
            },
          ],
          miles: 100,
        } as any),
      );
      const perf = DispatchIntelligence.getDriverPerformance("drv-1", loads);
      expect(perf.onTimeDeliveryRate).toBe(0);
      expect(perf.rank).toBe("PROBATION");
    });

    it("only counts delivered/completed loads", () => {
      const loads = [
        makeLoad({
          id: "l1",
          driverId: "drv-1",
          status: "draft",
          issues: [],
          miles: 1000,
        } as any),
        makeLoad({
          id: "l2",
          driverId: "drv-1",
          status: "delivered",
          issues: [],
          miles: 200,
        } as any),
      ];
      const perf = DispatchIntelligence.getDriverPerformance("drv-1", loads);
      expect(perf.totalMiles).toBe(200); // only the delivered load
    });

    it("filters by driverId", () => {
      const loads = [
        makeLoad({
          id: "l1",
          driverId: "drv-1",
          status: "delivered",
          miles: 100,
        } as any),
        makeLoad({
          id: "l2",
          driverId: "drv-2",
          status: "delivered",
          miles: 500,
        } as any),
      ];
      const perf = DispatchIntelligence.getDriverPerformance("drv-1", loads);
      expect(perf.totalMiles).toBe(100);
    });
  });

  // ─── reconcileIFTATax ────────────────────────────────────────────────
  describe("reconcileIFTATax", () => {
    it("returns BALANCED with zeros for empty loads", () => {
      const result = DispatchIntelligence.reconcileIFTATax([]);
      expect(result.totalMiles).toBe(0);
      expect(result.totalTaxableGallons).toBe(0);
      expect(result.netTaxDue).toBe(0);
      expect(result.status).toBe("BALANCED");
      expect(result.quarter).toBe("2025-Q4");
    });

    it("sums miles across loads", () => {
      const loads = [
        makeLoad({ miles: 300 } as any),
        makeLoad({ miles: 200 } as any),
      ];
      const result = DispatchIntelligence.reconcileIFTATax(loads);
      expect(result.totalMiles).toBe(500);
    });

    it("sums fuel purchases across loads", () => {
      const loads = [
        makeLoad({
          miles: 200,
          fuelPurchases: [{ gallons: 30, amount: 100, state: "IL" }],
        } as any),
        makeLoad({
          miles: 300,
          fuelPurchases: [
            { gallons: 20, amount: 70, state: "IN" },
            { gallons: 25, amount: 90, state: "OH" },
          ],
        } as any),
      ];
      const result = DispatchIntelligence.reconcileIFTATax(loads);
      expect(result.totalTaxableGallons).toBe(75);
    });

    it("alerts when miles recorded with zero fuel", () => {
      const loads = [makeLoad({ miles: 500 } as any)];
      const result = DispatchIntelligence.reconcileIFTATax(loads);
      expect(result.discrepancyAlerts).toContain(
        "Miles recorded with zero fuel purchases",
      );
    });

    it("alerts for improbably high MPG", () => {
      const loads = [
        makeLoad({
          miles: 1000,
          fuelPurchases: [{ gallons: 50, amount: 200 }],
        } as any),
      ];
      const result = DispatchIntelligence.reconcileIFTATax(loads);
      // 1000 / 50 = 20 MPG -> improbably high (> 9)
      expect(
        result.discrepancyAlerts.some((a) => a.includes("Improbably high MPG")),
      ).toBe(true);
    });

    it("alerts for critically low MPG", () => {
      const loads = [
        makeLoad({
          miles: 300,
          fuelPurchases: [{ gallons: 200, amount: 800 }],
        } as any),
      ];
      const result = DispatchIntelligence.reconcileIFTATax(loads);
      // 300 / 200 = 1.5 MPG -> critically low (< 4)
      expect(
        result.discrepancyAlerts.some((a) => a.includes("Critically low MPG")),
      ).toBe(true);
    });

    it("no alerts for normal MPG range", () => {
      const loads = [
        makeLoad({
          miles: 500,
          fuelPurchases: [{ gallons: 77, amount: 300 }],
        } as any),
      ];
      const result = DispatchIntelligence.reconcileIFTATax(loads);
      // 500 / 77 = 6.5 MPG -> normal
      expect(result.discrepancyAlerts).toHaveLength(0);
    });
  });
});
