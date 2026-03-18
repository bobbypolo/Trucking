import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { Intelligence } from "../../../components/Intelligence";
import { LoadData, Broker } from "../../../types";

// Mock recharts to avoid SVG rendering issues in jsdom
vi.mock("recharts", () => ({
  BarChart: ({ children }: any) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
}));

function makeLoad(overrides: Partial<LoadData> = {}): LoadData {
  return {
    id: "load-1",
    companyId: "co-1",
    driverId: "drv-1",
    brokerId: "broker-1",
    loadNumber: "LD-100",
    status: "delivered",
    carrierRate: 2500,
    driverPay: 1200,
    pickupDate: "2026-03-10",
    pickup: { city: "Dallas", state: "TX", facilityName: "Acme Warehouse" },
    dropoff: { city: "Houston", state: "TX", facilityName: "Beta Dock" },
    onboardingStatus: "Completed",
    safetyScore: 95,
    ...overrides,
  } as LoadData;
}

function makeBroker(overrides: Partial<Broker> = {}): Broker {
  return {
    id: "broker-1",
    name: "FastFreight Inc",
    mcNumber: "MC-12345",
    isShared: false,
    clientType: "Broker",
    approvedChassis: [],
    ...overrides,
  } as Broker;
}

describe("Intelligence", () => {
  let user: ReturnType<typeof userEvent.setup>;
  const loads = [
    makeLoad({
      id: "1",
      brokerId: "broker-1",
      pickupDate: "2026-01-15",
      carrierRate: 2000,
    }),
    makeLoad({
      id: "2",
      brokerId: "broker-1",
      pickupDate: "2026-02-10",
      carrierRate: 2200,
      pickup: { city: "Austin", state: "TX", facilityName: "Acme Warehouse" },
    }),
    makeLoad({
      id: "3",
      brokerId: "broker-2",
      pickupDate: "2026-03-05",
      carrierRate: 3000,
      pickup: { city: "San Antonio", state: "TX", facilityName: "Gamma Yard" },
      dropoff: { city: "El Paso", state: "TX", facilityName: "Delta Center" },
    }),
  ];
  const brokers = [
    makeBroker({
      id: "broker-1",
      name: "FastFreight Inc",
      mcNumber: "MC-12345",
    }),
    makeBroker({ id: "broker-2", name: "QuickHaul LLC", mcNumber: "MC-67890" }),
  ];

  beforeEach(() => {
    user = userEvent.setup();
  });

  it("renders the Business Insights header", () => {
    render(<Intelligence loads={loads} brokers={brokers} />);
    expect(screen.getByText("Business Insights")).toBeInTheDocument();
  });

  it("renders three tab navigation buttons", () => {
    render(<Intelligence loads={loads} brokers={brokers} />);
    expect(screen.getByText("Seasonal Trends")).toBeInTheDocument();
    expect(screen.getByText("Facility IQ")).toBeInTheDocument();
    expect(screen.getByText("Broker Perf")).toBeInTheDocument();
  });

  it("shows market tab by default with charts", () => {
    render(<Intelligence loads={loads} brokers={brokers} />);
    expect(screen.getByText("Seasonal Rate Analysis")).toBeInTheDocument();
    expect(screen.getByText("Volume Momentum")).toBeInTheDocument();
    expect(screen.getAllByTestId("bar-chart").length).toBe(2);
  });

  it("switches to Facility IQ tab and shows facility cards", async () => {
    render(<Intelligence loads={loads} brokers={brokers} />);
    await user.click(screen.getByText("Facility IQ"));
    // Should show facility names from the loads (may appear multiple times)
    expect(screen.getAllByText("Acme Warehouse").length).toBeGreaterThanOrEqual(
      1,
    );
    expect(
      screen.getByPlaceholderText("Filter Facilities..."),
    ).toBeInTheDocument();
  });

  it("switches to Broker Perf tab and shows broker cards", async () => {
    render(<Intelligence loads={loads} brokers={brokers} />);
    await user.click(screen.getByText("Broker Perf"));
    expect(screen.getByText("FastFreight Inc")).toBeInTheDocument();
    expect(screen.getByText("QuickHaul LLC")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Filter Brokers..."),
    ).toBeInTheDocument();
  });

  it("filters facility cards by search text", async () => {
    render(<Intelligence loads={loads} brokers={brokers} />);
    await user.click(screen.getByText("Facility IQ"));
    const searchInput = screen.getByPlaceholderText("Filter Facilities...");
    await user.type(searchInput, "Gamma");
    expect(screen.getByText("Gamma Yard")).toBeInTheDocument();
    expect(screen.queryByText("Acme Warehouse")).not.toBeInTheDocument();
  });

  it("filters broker cards by search text", async () => {
    render(<Intelligence loads={loads} brokers={brokers} />);
    await user.click(screen.getByText("Broker Perf"));
    const searchInput = screen.getByPlaceholderText("Filter Brokers...");
    await user.type(searchInput, "Quick");
    expect(screen.getByText("QuickHaul LLC")).toBeInTheDocument();
    expect(screen.queryByText("FastFreight Inc")).not.toBeInTheDocument();
  });

  it("opens entity analysis modal when a facility card is clicked", async () => {
    render(<Intelligence loads={loads} brokers={brokers} />);
    await user.click(screen.getByText("Facility IQ"));
    // Click on the first facility card (Acme Warehouse may appear multiple times)
    const acmeElements = screen.getAllByText("Acme Warehouse");
    await user.click(acmeElements[0]);
    // Should show analysis modal with Diagnosis and Prescriptions
    expect(screen.getByText("Diagnosis")).toBeInTheDocument();
    expect(screen.getByText("Prescriptions")).toBeInTheDocument();
  });

  it("opens entity analysis modal when a broker card is clicked", async () => {
    render(<Intelligence loads={loads} brokers={brokers} />);
    await user.click(screen.getByText("Broker Perf"));
    await user.click(screen.getByText("FastFreight Inc"));
    expect(screen.getByText("Diagnosis")).toBeInTheDocument();
    expect(screen.getByText("Prescriptions")).toBeInTheDocument();
  });

  it("closes entity modal when X is clicked", async () => {
    render(<Intelligence loads={loads} brokers={brokers} />);
    await user.click(screen.getByText("Facility IQ"));
    const acmeElements = screen.getAllByText("Acme Warehouse");
    await user.click(acmeElements[0]);
    expect(screen.getByText("Diagnosis")).toBeInTheDocument();

    // Find the modal overlay and click the close button in its header
    const modal = screen.getByText("Diagnosis").closest(".fixed")!;
    // The close button has a rounded-full class and contains an SVG
    const closeBtn = modal.querySelector("button.rounded-full") as HTMLElement;
    expect(closeBtn).not.toBeNull();
    await user.click(closeBtn);
    // Modal should close - Diagnosis should not be in document
    expect(screen.queryByText("Diagnosis")).not.toBeInTheDocument();
  });

  it("shows Health Score labels on facility cards", async () => {
    render(<Intelligence loads={loads} brokers={brokers} />);
    await user.click(screen.getByText("Facility IQ"));
    expect(screen.getAllByText("Health Score").length).toBeGreaterThanOrEqual(
      1,
    );
  });

  it("shows Visits count on facility cards", async () => {
    render(<Intelligence loads={loads} brokers={brokers} />);
    await user.click(screen.getByText("Facility IQ"));
    expect(screen.getAllByText("Visits").length).toBeGreaterThanOrEqual(1);
  });

  it("shows Avg Rate on broker cards", async () => {
    render(<Intelligence loads={loads} brokers={brokers} />);
    await user.click(screen.getByText("Broker Perf"));
    expect(screen.getAllByText("Avg Rate").length).toBeGreaterThanOrEqual(1);
  });

  it("renders with empty loads without crashing", () => {
    render(<Intelligence loads={[]} brokers={[]} />);
    expect(screen.getByText("Business Insights")).toBeInTheDocument();
  });
});
