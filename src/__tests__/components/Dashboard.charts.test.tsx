import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Dashboard } from "../../../components/Dashboard";
import { LoadData, User, LOAD_STATUS } from "../../../types";
import * as exceptionService from "../../../services/exceptionService";

// Tests R-P6-01, R-P6-02, R-P6-03

// Mock recharts to render testable output
vi.mock("recharts", () => {
  const OrigReact = require("react");
  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
      OrigReact.createElement("div", { "data-testid": "responsive-container" }, children),
    BarChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) =>
      OrigReact.createElement("div", { "data-testid": "bar-chart", "data-count": data?.length ?? 0 }, children),
    LineChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) =>
      OrigReact.createElement("div", { "data-testid": "line-chart", "data-count": data?.length ?? 0 }, children),
    Bar: ({ dataKey }: { dataKey: string }) =>
      OrigReact.createElement("div", { "data-testid": `bar-${dataKey}` }),
    Line: ({ dataKey }: { dataKey: string }) =>
      OrigReact.createElement("div", { "data-testid": `line-${dataKey}` }),
    XAxis: () => OrigReact.createElement("div", { "data-testid": "x-axis" }),
    YAxis: () => OrigReact.createElement("div", { "data-testid": "y-axis" }),
    Tooltip: () => OrigReact.createElement("div", { "data-testid": "tooltip" }),
    CartesianGrid: () => OrigReact.createElement("div", { "data-testid": "cartesian-grid" }),
    Legend: () => OrigReact.createElement("div", { "data-testid": "legend" }),
  };
});

vi.mock("../../../services/exceptionService", () => ({
  getExceptions: vi.fn().mockResolvedValue([]),
  getDashboardCards: vi.fn().mockResolvedValue([]),
}));

const mockedGetExceptions = vi.mocked(exceptionService.getExceptions);
const mockedGetDashboardCards = vi.mocked(exceptionService.getDashboardCards);

const mockUser: User = {
  id: "user-1",
  companyId: "company-1",
  email: "admin@test.com",
  name: "Test Admin",
  role: "owner_operator",
  onboardingStatus: "Completed",
  safetyScore: 100,
};

const today = new Date();
function daysAgo(n: number): string {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

const mockLoadsWithDates: LoadData[] = [
  {
    id: "load-1",
    companyId: "c1",
    driverId: "d1",
    loadNumber: "LN-001",
    status: LOAD_STATUS.Delivered,
    carrierRate: 2000,
    driverPay: 1200,
    miles: 800,
    pickupDate: daysAgo(1),
    pickup: { city: "Chicago", state: "IL" },
    dropoff: { city: "Dallas", state: "TX" },
  },
  {
    id: "load-2",
    companyId: "c1",
    driverId: "d2",
    loadNumber: "LN-002",
    status: LOAD_STATUS.Delivered,
    carrierRate: 1500,
    driverPay: 900,
    miles: 600,
    pickupDate: daysAgo(2),
    pickup: { city: "Atlanta", state: "GA" },
    dropoff: { city: "Miami", state: "FL" },
  },
  {
    id: "load-3",
    companyId: "c1",
    driverId: "d3",
    loadNumber: "LN-003",
    status: LOAD_STATUS.In_Transit,
    carrierRate: 1800,
    driverPay: 1000,
    miles: 700,
    pickupDate: daysAgo(3),
    pickup: { city: "LA", state: "CA" },
    dropoff: { city: "Phoenix", state: "AZ" },
  },
];

const mockExceptionsWithDates = [
  {
    id: "ex-1",
    tenantId: "t1",
    type: "POD_MISSING",
    status: "OPEN",
    severity: 3 as const,
    entityId: "load-1",
    createdAt: daysAgo(1) + "T10:00:00Z",
    updatedAt: daysAgo(1) + "T10:00:00Z",
  },
  {
    id: "ex-2",
    tenantId: "t1",
    type: "DETENTION_ELIGIBLE",
    status: "OPEN",
    severity: 2 as const,
    entityId: "load-2",
    createdAt: daysAgo(2) + "T10:00:00Z",
    updatedAt: daysAgo(2) + "T10:00:00Z",
  },
];

const defaultProps = {
  user: mockUser,
  loads: mockLoadsWithDates,
  onViewLoad: vi.fn(),
  onNavigate: vi.fn(),
};

describe("Dashboard Charts — R-P6-01, R-P6-02, R-P6-03", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetExceptions.mockResolvedValue(mockExceptionsWithDates as any);
    mockedGetDashboardCards.mockResolvedValue([]);
  });

  // R-P6-01: 3 recharts components render
  it("renders 3 chart sections — RPM BarChart, Exceptions LineChart, Revenue BarChart", async () => {
    render(<Dashboard {...defaultProps} />);

    await waitFor(() => {
      // Should have bar charts and line chart
      const barCharts = screen.getAllByTestId("bar-chart");
      const lineCharts = screen.getAllByTestId("line-chart");
      // 2 BarCharts (RPM by day + Revenue vs Cost) and 1 LineChart (Exceptions)
      expect(barCharts.length).toBeGreaterThanOrEqual(2);
      expect(lineCharts.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders RPM by Day chart section with heading", async () => {
    render(<Dashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/RPM by Day/i)).toBeInTheDocument();
    });
  });

  it("renders Exception Trend chart section with heading", async () => {
    render(<Dashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Exception.*Trend/i)).toBeInTheDocument();
    });
  });

  it("renders Revenue vs Cost chart section with heading", async () => {
    render(<Dashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Revenue.*Cost/i)).toBeInTheDocument();
    });
  });

  // R-P6-02: Chart data computed from existing props — zero hardcoded data
  it("computes RPM chart data from loads prop (not hardcoded)", async () => {
    render(<Dashboard {...defaultProps} />);
    await waitFor(() => {
      const barCharts = screen.getAllByTestId("bar-chart");
      // At least one bar chart should have data from loads
      const hasData = barCharts.some(
        (chart) => parseInt(chart.getAttribute("data-count") || "0") > 0
      );
      expect(hasData).toBe(true);
    });
  });

  it("computes exception chart data from exceptions state (not hardcoded)", async () => {
    render(<Dashboard {...defaultProps} />);
    await waitFor(() => {
      const lineCharts = screen.getAllByTestId("line-chart");
      const hasData = lineCharts.some(
        (chart) => parseInt(chart.getAttribute("data-count") || "0") > 0
      );
      expect(hasData).toBe(true);
    });
  });

  // R-P6-03: Empty state shown when no loads/exceptions
  it("shows 'No data for this period' when loads array is empty", async () => {
    mockedGetExceptions.mockResolvedValue([]);
    mockedGetDashboardCards.mockResolvedValue([]);

    render(<Dashboard {...defaultProps} loads={[]} />);
    await waitFor(() => {
      const emptyMessages = screen.getAllByText(/No data for this period/i);
      expect(emptyMessages.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows 'No data for this period' for exception chart when no exceptions", async () => {
    mockedGetExceptions.mockResolvedValue([]);
    mockedGetDashboardCards.mockResolvedValue([]);

    render(<Dashboard {...defaultProps} loads={[]} />);
    await waitFor(() => {
      const emptyMessages = screen.getAllByText(/No data for this period/i);
      // Should have empty states for all 3 charts
      expect(emptyMessages.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("does not render charts while loading", () => {
    // Make the promises never resolve during this test
    mockedGetExceptions.mockReturnValue(new Promise(() => {}) as any);
    mockedGetDashboardCards.mockReturnValue(new Promise(() => {}) as any);

    render(<Dashboard {...defaultProps} />);
    // While loading, charts should not be visible (loading skeleton shown)
    expect(screen.queryByTestId("bar-chart")).toBeNull();
    expect(screen.queryByTestId("line-chart")).toBeNull();
  });
});
