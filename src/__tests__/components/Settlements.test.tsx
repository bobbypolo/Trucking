import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Settlements } from "../../../components/Settlements";
import { LoadData, User, LOAD_STATUS } from "../../../types";

// Mock services used by Settlements
vi.mock("../../../services/storageService", () => ({
  generateInvoicePDF: vi.fn(),
  settleLoad: vi.fn(),
}));

vi.mock("../../../services/authService", () => ({
  addDriver: vi.fn(),
  getCurrentUser: vi.fn().mockReturnValue({
    id: "user-1",
    role: "admin",
    companyId: "company-1",
    name: "Test Admin",
  }),
}));

vi.mock("../../../services/financialService", () => ({
  createSettlement: vi.fn(),
  uploadToVault: vi.fn(),
  getSettlements: vi.fn().mockResolvedValue([]),
  getBills: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../services/syncService", () => ({
  generateQBSummaryJournal: vi.fn(),
  exportToCSV: vi.fn(),
}));

vi.mock("../../../services/firebase", () => ({
  DEMO_MODE: false,
}));

const mockUser: User = {
  id: "driver-1",
  companyId: "company-1",
  email: "driver@test.com",
  name: "Test Driver",
  role: "driver",
  payModel: "percent",
  payRate: 500,
  onboardingStatus: "Completed",
  safetyScore: 95,
};

const mockLoads: LoadData[] = [
  {
    id: "load-1",
    companyId: "company-1",
    driverId: "driver-1",
    loadNumber: "LN-001",
    status: LOAD_STATUS.Delivered,
    carrierRate: 1500,
    driverPay: 750,
    pickupDate: "2025-12-01",
    pickup: { city: "Chicago", state: "IL" },
    dropoff: { city: "Dallas", state: "TX" },
  },
  {
    id: "load-2",
    companyId: "company-1",
    driverId: "driver-1",
    loadNumber: "LN-002",
    status: LOAD_STATUS.Completed,
    carrierRate: 2000,
    driverPay: 1000,
    pickupDate: "2025-12-05",
    pickup: { city: "Atlanta", state: "GA" },
    dropoff: { city: "Miami", state: "FL" },
    financialStatus: "Invoiced",
  },
  {
    id: "load-3",
    companyId: "company-1",
    driverId: "driver-2",
    loadNumber: "LN-003",
    status: LOAD_STATUS.In_Transit,
    carrierRate: 1800,
    driverPay: 900,
    pickupDate: "2025-12-10",
    pickup: { city: "Houston", state: "TX" },
    dropoff: { city: "Phoenix", state: "AZ" },
  },
];

describe("Settlements component", () => {
  const defaultProps = {
    loads: mockLoads,
    users: [mockUser],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    const { container } = render(<Settlements {...defaultProps} />);
    expect(container).toBeTruthy();
  });

  it("renders with empty loads and users", () => {
    const { container } = render(
      <Settlements {...defaultProps} loads={[]} users={[]} />,
    );
    expect(container).toBeTruthy();
  });

  it("renders settlement tabs", () => {
    render(<Settlements {...defaultProps} />);
    // Should have payroll, invoices, and P&L tabs
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("shows driver name in payroll section", () => {
    render(<Settlements {...defaultProps} />);
    expect(screen.getByText(/Test Driver/i)).toBeTruthy();
  });

  it("renders in dashboard mode", () => {
    const { container } = render(
      <Settlements {...defaultProps} isDashboardMode={true} />,
    );
    expect(container).toBeTruthy();
  });
});
