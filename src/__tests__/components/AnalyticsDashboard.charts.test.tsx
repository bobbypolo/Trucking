import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AnalyticsDashboard } from "../../../components/AnalyticsDashboard";
import { LoadData, User, Broker, LOAD_STATUS } from "../../../types";

// Tests R-P6-05, R-P6-06

// Mock recharts to render testable output in jsdom
vi.mock("recharts", () => {
  const OrigReact = require("react");
  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
      OrigReact.createElement(
        "div",
        { "data-testid": "responsive-container" },
        children,
      ),
    BarChart: ({
      children,
      data,
    }: {
      children: React.ReactNode;
      data: unknown[];
    }) =>
      OrigReact.createElement(
        "div",
        { "data-testid": "bar-chart", "data-count": data?.length ?? 0 },
        children,
      ),
    PieChart: ({ children }: { children: React.ReactNode }) =>
      OrigReact.createElement("div", { "data-testid": "pie-chart" }, children),
    Bar: ({ dataKey }: { dataKey: string }) =>
      OrigReact.createElement("div", { "data-testid": `bar-${dataKey}` }),
    Pie: ({ dataKey, data }: { dataKey: string; data?: unknown[] }) =>
      OrigReact.createElement("div", {
        "data-testid": `pie-${dataKey}`,
        "data-count": data?.length ?? 0,
      }),
    XAxis: () => OrigReact.createElement("div", { "data-testid": "x-axis" }),
    YAxis: () => OrigReact.createElement("div", { "data-testid": "y-axis" }),
    Tooltip: () => OrigReact.createElement("div", { "data-testid": "tooltip" }),
    Cell: ({ fill }: { fill: string }) =>
      OrigReact.createElement("div", {
        "data-testid": "cell",
        "data-fill": fill,
      }),
    CartesianGrid: () =>
      OrigReact.createElement("div", { "data-testid": "cartesian-grid" }),
    Legend: () => OrigReact.createElement("div", { "data-testid": "legend" }),
  };
});

const mockUser: User = {
  id: "user-1",
  companyId: "company-1",
  email: "admin@test.com",
  name: "Test Admin",
  role: "admin",
  onboardingStatus: "Completed",
  safetyScore: 100,
};

// Use today's date so loads always fall in the current quarter
// (AnalyticsDashboard filters lane data by selectedQuarter, default = current quarter).
const TODAY_ISO = new Date().toISOString().slice(0, 10);

function makeLoad(id: string, overrides: Partial<LoadData> = {}): LoadData {
  return {
    id,
    companyId: "company-1",
    driverId: "driver-1",
    loadNumber: `LN-${id}`,
    status: LOAD_STATUS.Delivered,
    carrierRate: 2000,
    driverPay: 1200,
    miles: 500,
    pickupDate: TODAY_ISO,
    pickup: { city: "Chicago", state: "IL" },
    dropoff: { city: "Dallas", state: "TX" },
    ...overrides,
  };
}

const mockBrokers: Broker[] = [
  {
    id: "broker-1",
    name: "Alpha Logistics",
    mcNumber: "MC-100",
    isShared: true,
    clientType: "Broker",
    approvedChassis: [],
  },
  {
    id: "broker-2",
    name: "Beta Freight",
    mcNumber: "MC-200",
    isShared: false,
    clientType: "Broker",
    approvedChassis: [],
  },
];

describe("AnalyticsDashboard Charts — R-P6-05", () => {
  it("renders a recharts BarChart for broker RPM comparison", () => {
    const loads = [
      makeLoad("1", { brokerId: "broker-1", carrierRate: 3000, miles: 1000 }),
      makeLoad("2", { brokerId: "broker-2", carrierRate: 2000, miles: 800 }),
    ];
    render(
      <AnalyticsDashboard
        user={mockUser}
        loads={loads}
        brokers={mockBrokers}
      />,
    );
    const barCharts = screen.getAllByTestId("bar-chart");
    expect(barCharts.length).toBeGreaterThanOrEqual(1);
  });

  it("renders a recharts PieChart for lane revenue distribution", () => {
    const loads = [
      makeLoad("1", {
        pickup: { city: "Chicago", state: "IL" },
        dropoff: { city: "Dallas", state: "TX" },
        carrierRate: 3000,
        miles: 1000,
      }),
      makeLoad("2", {
        pickup: { city: "Atlanta", state: "GA" },
        dropoff: { city: "Miami", state: "FL" },
        carrierRate: 2000,
        miles: 600,
      }),
    ];
    render(<AnalyticsDashboard user={mockUser} loads={loads} brokers={[]} />);
    const pieCharts = screen.getAllByTestId("pie-chart");
    expect(pieCharts.length).toBeGreaterThanOrEqual(1);
  });

  it("BarChart data is derived from broker RPM (not hardcoded)", () => {
    const loads = [
      makeLoad("1", { brokerId: "broker-1", carrierRate: 3000, miles: 1000 }),
      makeLoad("2", { brokerId: "broker-2", carrierRate: 2000, miles: 800 }),
    ];
    render(
      <AnalyticsDashboard
        user={mockUser}
        loads={loads}
        brokers={mockBrokers}
      />,
    );
    const barCharts = screen.getAllByTestId("bar-chart");
    // BarChart with broker data should have data entries matching number of brokers
    const brokerChart = barCharts.find(
      (c) => parseInt(c.getAttribute("data-count") || "0") === 2,
    );
    expect(brokerChart).toBeTruthy();
  });

  it("PieChart data is derived from lane revenue (not hardcoded)", () => {
    const loads = [
      makeLoad("1", {
        pickup: { city: "Chicago", state: "IL" },
        dropoff: { city: "Dallas", state: "TX" },
        carrierRate: 3000,
        miles: 1000,
      }),
      makeLoad("2", {
        pickup: { city: "Atlanta", state: "GA" },
        dropoff: { city: "Miami", state: "FL" },
        carrierRate: 2000,
        miles: 600,
      }),
    ];
    render(<AnalyticsDashboard user={mockUser} loads={loads} brokers={[]} />);
    // PieChart should contain pie data with 2 lane entries
    const pies = screen.getAllByTestId("pie-revenue");
    expect(pies.length).toBeGreaterThanOrEqual(1);
    const pieDataCount = parseInt(pies[0].getAttribute("data-count") || "0");
    expect(pieDataCount).toBe(2);
  });
});

describe("AnalyticsDashboard Drill-Down — R-P6-06", () => {
  it("clicking a broker card calls onNavigate with broker filter", () => {
    const onNavigate = vi.fn();
    const loads = [
      makeLoad("1", { brokerId: "broker-1", carrierRate: 3000, miles: 1000 }),
    ];
    render(
      <AnalyticsDashboard
        user={mockUser}
        loads={loads}
        brokers={mockBrokers}
        onNavigate={onNavigate}
      />,
    );
    // Click on a broker scorecard row
    fireEvent.click(screen.getByText("Alpha Logistics"));
    expect(onNavigate).toHaveBeenCalledWith("loads", "broker:broker-1");
  });

  it("clicking a lane card calls onNavigate with lane filter", () => {
    const onNavigate = vi.fn();
    const loads = [
      makeLoad("1", {
        pickup: { city: "Chicago", state: "IL" },
        dropoff: { city: "Dallas", state: "TX" },
        carrierRate: 3000,
        driverPay: 1500,
        miles: 1000,
      }),
    ];
    render(
      <AnalyticsDashboard
        user={mockUser}
        loads={loads}
        brokers={[]}
        onNavigate={onNavigate}
      />,
    );
    // Click on a lane card row
    const laneCard =
      screen.getByText(/Chicago, IL/).closest("[data-lane-id]") ||
      screen.getByText(/Chicago, IL/).closest(".cursor-pointer");
    expect(laneCard).toBeTruthy();
    fireEvent.click(laneCard!);
    expect(onNavigate).toHaveBeenCalledWith(
      "loads",
      expect.stringContaining("lane:"),
    );
  });
});
