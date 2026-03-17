import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AccountingView } from "../../../components/AccountingView";
import { LoadData, User, LOAD_STATUS } from "../../../types";

// Recharts renders SVG in real DOM but jsdom has limited SVG support.
// Provide a thin shim for ResponsiveContainer which needs offsetWidth/offsetHeight.
vi.mock("recharts", async () => {
  const Original = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...Original,
    ResponsiveContainer: ({ children }: any) => (
      <div data-testid="responsive-container" style={{ width: 500, height: 300 }}>
        {children}
      </div>
    ),
  };
});

const mockUsers: User[] = [
  {
    id: "user-1",
    companyId: "company-1",
    email: "admin@test.com",
    name: "Admin",
    role: "admin",
    onboardingStatus: "Completed",
    safetyScore: 100,
  },
];

const mockLoads: LoadData[] = [
  {
    id: "load-1",
    companyId: "company-1",
    driverId: "driver-1",
    loadNumber: "LN-001",
    status: LOAD_STATUS.In_Transit,
    carrierRate: 3000,
    driverPay: 1800,
    pickupDate: new Date().toISOString().split("T")[0],
    pickup: { city: "Chicago", state: "IL" },
    dropoff: { city: "Dallas", state: "TX" },
  },
  {
    id: "load-2",
    companyId: "company-1",
    driverId: "driver-2",
    loadNumber: "LN-002",
    status: LOAD_STATUS.Delivered,
    carrierRate: 2500,
    driverPay: 1500,
    pickupDate: "2025-12-02",
    pickup: { city: "Atlanta", state: "GA" },
    dropoff: { city: "Miami", state: "FL" },
  },
  {
    id: "load-3",
    companyId: "company-1",
    driverId: "driver-1",
    loadNumber: "LN-003",
    status: LOAD_STATUS.Completed,
    carrierRate: 4000,
    driverPay: 2400,
    pickupDate: "2025-11-28",
    pickup: { city: "Houston", state: "TX" },
    dropoff: { city: "Phoenix", state: "AZ" },
  },
  {
    id: "load-4",
    companyId: "company-1",
    driverId: "driver-2",
    loadNumber: "LN-004",
    status: LOAD_STATUS.Cancelled,
    carrierRate: 1000,
    driverPay: 600,
    pickupDate: "2025-12-03",
    pickup: { city: "NY", state: "NY" },
    dropoff: { city: "Boston", state: "MA" },
  },
];

describe("AccountingView component", () => {
  const defaultProps = {
    loads: mockLoads,
    users: mockUsers,
    onNavigate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    const { container } = render(<AccountingView {...defaultProps} />);
    expect(container).toBeTruthy();
  });

  it("renders the Accounting Terminal header", () => {
    render(<AccountingView {...defaultProps} />);
    expect(screen.getByText("Accounting Terminal")).toBeTruthy();
  });

  it("renders Fleet Financial Operations subtitle", () => {
    render(<AccountingView {...defaultProps} />);
    expect(screen.getByText("Fleet Financial Operations")).toBeTruthy();
  });

  it("displays LIVE status indicator", () => {
    render(<AccountingView {...defaultProps} />);
    expect(screen.getByText("LIVE")).toBeTruthy();
  });

  it("renders the Detailed Settlements navigation button", () => {
    render(<AccountingView {...defaultProps} />);
    const btn = screen.getByRole("button", { name: /Detailed Settlements/i });
    expect(btn).toBeTruthy();
  });

  it("calls onNavigate with 'finance' when settlements button is clicked", () => {
    render(<AccountingView {...defaultProps} />);
    const btn = screen.getByRole("button", { name: /Detailed Settlements/i });
    fireEvent.click(btn);
    expect(defaultProps.onNavigate).toHaveBeenCalledWith("finance");
  });

  it("renders all 4 top KPI cards", () => {
    render(<AccountingView {...defaultProps} />);
    expect(screen.getByText("GROSS REVENUE")).toBeTruthy();
    expect(screen.getByText("OPERATIONAL COST")).toBeTruthy();
    expect(screen.getByText("NET OVERRIDE")).toBeTruthy();
    expect(screen.getByText("ACCOUNTS RECEIVABLE")).toBeTruthy();
  });

  it("computes and displays gross revenue correctly", () => {
    render(<AccountingView {...defaultProps} />);
    // Total = 3000 + 2500 + 4000 + 1000 = $10,500
    expect(screen.getByText("$10,500")).toBeTruthy();
  });

  it("computes and displays operational cost (driver pay) correctly", () => {
    render(<AccountingView {...defaultProps} />);
    // Total driver pay = 1800 + 1500 + 2400 + 600 = $6,300
    expect(screen.getByText("$6,300")).toBeTruthy();
  });

  it("computes and displays net margin correctly", () => {
    render(<AccountingView {...defaultProps} />);
    // Net = 10500 - 6300 = $4,200
    expect(screen.getByText("$4,200")).toBeTruthy();
  });

  it("shows pending loads count for in-progress statuses", () => {
    render(<AccountingView {...defaultProps} />);
    // in_transit + delivered = 2 pending (not completed, not cancelled)
    expect(screen.getByText(/2 Loads Pending/)).toBeTruthy();
  });

  it("shows accounts receivable from completed/delivered loads", () => {
    render(<AccountingView {...defaultProps} />);
    // delivered: 2500, completed: 4000 = $6,500
    expect(screen.getByText("$6,500")).toBeTruthy();
  });

  it("shows margin percentage", () => {
    render(<AccountingView {...defaultProps} />);
    // marginPercent = (4200 / 10500) * 100 = 40.0%
    expect(screen.getByText("40.0% Avg Margin")).toBeTruthy();
  });

  it("renders the chart section", () => {
    render(<AccountingView {...defaultProps} />);
    expect(screen.getByText("Performance Intelligence")).toBeTruthy();
    expect(screen.getByText(/7-Day Revenue & Profit Logic/)).toBeTruthy();
  });

  it("renders Cash Flow Projection section", () => {
    render(<AccountingView {...defaultProps} />);
    expect(screen.getByText("Cash Flow Projection")).toBeTruthy();
    expect(screen.getByText("Net Yield")).toBeTruthy();
  });

  it("shows the margin donut chart percentage", () => {
    render(<AccountingView {...defaultProps} />);
    // 40% margin
    expect(screen.getByText("40%")).toBeTruthy();
  });

  it("renders with empty loads array showing $0 values", () => {
    render(<AccountingView {...defaultProps} loads={[]} />);
    // All currency values should be $0
    const allZero = screen.getAllByText("$0");
    expect(allZero.length).toBeGreaterThanOrEqual(4);
  });

  it("renders with zero-rate loads correctly", () => {
    const zeroLoads: LoadData[] = [
      {
        id: "z-1",
        companyId: "company-1",
        driverId: "d-1",
        loadNumber: "LN-Z1",
        status: LOAD_STATUS.Delivered,
        carrierRate: 0,
        driverPay: 0,
        pickupDate: "2025-12-01",
        pickup: { city: "A", state: "TX" },
        dropoff: { city: "B", state: "OK" },
      },
    ];
    render(<AccountingView {...defaultProps} loads={zeroLoads} />);
    expect(screen.getByText("0.0% Avg Margin")).toBeTruthy();
  });

  it("renders Scaling Growth and Efficiency cards", () => {
    render(<AccountingView {...defaultProps} />);
    expect(screen.getByText("Scaling Growth")).toBeTruthy();
    expect(screen.getByText("Efficiency")).toBeTruthy();
    expect(screen.getByText("+12%")).toBeTruthy();
    expect(screen.getByText("98.4%")).toBeTruthy();
  });

  it("renders chart container element", () => {
    render(<AccountingView {...defaultProps} />);
    expect(screen.getByTestId("responsive-container")).toBeTruthy();
  });
});
