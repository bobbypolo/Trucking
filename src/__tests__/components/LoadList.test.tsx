import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoadList } from "../../../components/LoadList";
import { LoadData, User, LOAD_STATUS } from "../../../types";

// Mock services used by LoadList
vi.mock("../../../services/storageService", () => ({
  generateInvoicePDF: vi.fn(),
  saveLoad: vi.fn(),
}));

vi.mock("../../../services/authService", () => ({
  getCompany: vi.fn().mockReturnValue(null),
  getCurrentUser: vi.fn().mockReturnValue({
    id: "user-1",
    role: "admin",
    companyId: "company-1",
  }),
}));

const mockLoads: LoadData[] = [
  {
    id: "load-1",
    companyId: "company-1",
    driverId: "driver-1",
    loadNumber: "LN-001",
    status: LOAD_STATUS.Planned,
    carrierRate: 1500,
    driverPay: 900,
    pickupDate: "2025-12-01",
    pickup: { city: "Chicago", state: "IL" },
    dropoff: { city: "Dallas", state: "TX" },
  },
  {
    id: "load-2",
    companyId: "company-1",
    driverId: "driver-2",
    loadNumber: "LN-002",
    status: LOAD_STATUS.Delivered,
    carrierRate: 2000,
    driverPay: 1200,
    pickupDate: "2025-12-02",
    pickup: { city: "Atlanta", state: "GA" },
    dropoff: { city: "Miami", state: "FL" },
  },
  {
    id: "load-3",
    companyId: "company-1",
    driverId: "driver-1",
    loadNumber: "LN-003",
    status: LOAD_STATUS.In_Transit,
    carrierRate: 1800,
    driverPay: 1100,
    pickupDate: "2025-12-03",
    pickup: { city: "Houston", state: "TX" },
    dropoff: { city: "Phoenix", state: "AZ" },
  },
];

describe("LoadList component", () => {
  const defaultProps = {
    loads: mockLoads,
    onView: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    render(<LoadList {...defaultProps} />);
    expect(screen.getByText(/LN-001/i)).toBeInTheDocument();
  });

  it("renders with empty loads array", () => {
    render(<LoadList {...defaultProps} loads={[]} />);
    expect(screen.queryByText(/LN-001/i)).not.toBeInTheDocument();
  });

  it("renders load numbers in the list", () => {
    render(<LoadList {...defaultProps} />);
    expect(screen.getByText(/LN-001/i)).toBeInTheDocument();
    expect(screen.getByText(/LN-002/i)).toBeInTheDocument();
    expect(screen.getByText(/LN-003/i)).toBeInTheDocument();
  });

  it("displays pickup city for each load", () => {
    render(<LoadList {...defaultProps} />);
    expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    expect(screen.getByText(/Atlanta/)).toBeInTheDocument();
    expect(screen.getByText(/Houston/)).toBeInTheDocument();
  });

  it("filters loads by search term", async () => {
    const user = userEvent.setup();
    render(<LoadList {...defaultProps} />);
    const searchInputs = screen.getAllByRole("textbox");
    const searchInput = searchInputs[0];
    await user.clear(searchInput);
    await user.type(searchInput, "LN-001");
    expect(screen.getByText(/LN-001/i)).toBeInTheDocument();
  });
});
