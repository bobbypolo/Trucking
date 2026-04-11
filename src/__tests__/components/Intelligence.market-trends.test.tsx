/**
 * Tests R-P11-03, R-P11-04: Intelligence market-trends enhancement
 *
 *  - R-P11-03: Intelligence.tsx renders at least one TrendingUp /
 *              TrendingDown icon with data-testid matching
 *              "trend-indicator-up" or "trend-indicator-down" for each lane
 *  - R-P11-04: Intelligence.tsx fetches /api/analytics/lane-trends and
 *              displays at least one lane row with avgRate and trend
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Intelligence } from "../../../components/Intelligence";
import type { LoadData, Broker } from "../../../types";
import { LOAD_STATUS } from "../../../types";

type LaneTrendRow = {
  lane: string;
  month: string;
  avgRate: number;
  volume: number;
  trend: "up" | "down" | "flat";
};

function makeLoad(id: string): LoadData {
  return {
    id,
    companyId: "company-1",
    driverId: "driver-1",
    loadNumber: `LN-${id}`,
    status: LOAD_STATUS.Delivered,
    carrierRate: 2000,
    driverPay: 0,
    miles: 500,
    pickupDate: "2026-03-15",
    pickup: { city: "Chicago", state: "IL" },
    dropoff: { city: "Dallas", state: "TX" },
  };
}

const LOADS: LoadData[] = [makeLoad("l1")];
const BROKERS: Broker[] = [];

function mockLaneTrendsFetch(rows: LaneTrendRow[]): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : String(input);
    if (url.includes("/api/analytics/lane-trends")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => rows,
      } as unknown as Response);
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => [],
    } as unknown as Response);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("Intelligence — Market Trends Enhancement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Tests R-P11-04 — fetches lane-trends on mount
  it("fetches /api/analytics/lane-trends on mount", async () => {
    const fetchMock = mockLaneTrendsFetch([
      {
        lane: "IL -> TX",
        month: "2026-03",
        avgRate: 2200,
        volume: 6,
        trend: "up",
      },
    ]);

    render(<Intelligence loads={LOADS} brokers={BROKERS} />);

    await waitFor(() => {
      const laneTrendCalls = fetchMock.mock.calls.filter((call) => {
        const url =
          typeof call[0] === "string" ? call[0] : String(call[0] ?? "");
        return url.includes("/api/analytics/lane-trends");
      });
      expect(laneTrendCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // Tests R-P11-04 — uses months=6 when fetching
  it("fetches lane trends with months=6 query", async () => {
    const fetchMock = mockLaneTrendsFetch([]);

    render(<Intelligence loads={LOADS} brokers={BROKERS} />);

    await waitFor(() => {
      const called = fetchMock.mock.calls.some((call) => {
        const url =
          typeof call[0] === "string" ? call[0] : String(call[0] ?? "");
        return (
          url.includes("/api/analytics/lane-trends") && /months=6/.test(url)
        );
      });
      expect(called).toBe(true);
    });
  });

  // Tests R-P11-03 — renders TrendingUp icon with expected data-testid
  it("renders trend-indicator-up for an upward lane", async () => {
    mockLaneTrendsFetch([
      {
        lane: "IL -> TX",
        month: "2026-03",
        avgRate: 2200,
        volume: 6,
        trend: "up",
      },
    ]);

    render(<Intelligence loads={LOADS} brokers={BROKERS} />);

    await waitFor(() => {
      const indicator = screen.getByTestId("trend-indicator-up");
      expect(indicator).toBeInTheDocument();
    });
  });

  // Tests R-P11-03 — renders TrendingDown icon with expected data-testid
  it("renders trend-indicator-down for a downward lane", async () => {
    mockLaneTrendsFetch([
      {
        lane: "CA -> NY",
        month: "2026-03",
        avgRate: 2700,
        volume: 3,
        trend: "down",
      },
    ]);

    render(<Intelligence loads={LOADS} brokers={BROKERS} />);

    await waitFor(() => {
      const indicator = screen.getByTestId("trend-indicator-down");
      expect(indicator).toBeInTheDocument();
    });
  });

  // Tests R-P11-04 — displays a lane row with avgRate and trend
  it("displays at least one lane row with avgRate and trend", async () => {
    mockLaneTrendsFetch([
      {
        lane: "IL -> TX",
        month: "2026-03",
        avgRate: 2200,
        volume: 6,
        trend: "up",
      },
    ]);

    render(<Intelligence loads={LOADS} brokers={BROKERS} />);

    await waitFor(() => {
      const row = screen.getByTestId("lane-trend-row");
      expect(row).toBeInTheDocument();
      expect(row.textContent).toContain("IL -> TX");
      expect(row.textContent).toContain("2200");
      expect(row.textContent).toMatch(/up/i);
    });

    // Check avgRate is rendered via its own test id
    const avg = screen.getByTestId("lane-trend-avg-rate");
    expect(avg.textContent).toContain("2200");
    const trendValue = screen.getByTestId("lane-trend-value");
    expect(trendValue.textContent).toMatch(/up/i);
  });

  // Tests R-P11-03 — renders at least one indicator per lane when many lanes returned
  it("renders one trend indicator per lane for multiple lanes", async () => {
    mockLaneTrendsFetch([
      {
        lane: "IL -> TX",
        month: "2026-03",
        avgRate: 2200,
        volume: 6,
        trend: "up",
      },
      {
        lane: "CA -> NY",
        month: "2026-03",
        avgRate: 2700,
        volume: 3,
        trend: "down",
      },
      {
        lane: "TX -> GA",
        month: "2026-03",
        avgRate: 2050,
        volume: 5,
        trend: "flat",
      },
    ]);

    render(<Intelligence loads={LOADS} brokers={BROKERS} />);

    await waitFor(() => {
      expect(screen.getByTestId("trend-indicator-up")).toBeInTheDocument();
      expect(screen.getByTestId("trend-indicator-down")).toBeInTheDocument();
    });
    const rows = screen.getAllByTestId("lane-trend-row");
    expect(rows.length).toBe(3);
  });

  // Tests R-P11-04 — network failure shows fallback text, no crash
  it("shows fallback message when fetch rejects", async () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error("network down")));
    vi.stubGlobal("fetch", fetchMock);

    render(<Intelligence loads={LOADS} brokers={BROKERS} />);

    await waitFor(() => {
      expect(screen.getByText(/unable to load trends/i)).toBeInTheDocument();
    });
  });
});
