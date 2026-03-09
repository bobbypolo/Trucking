import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
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
    const { container } = render(<LoadList {...defaultProps} />);
    expect(container).toBeTruthy();
  });

  it("renders with empty loads array", () => {
    const { container } = render(<LoadList {...defaultProps} loads={[]} />);
    expect(container).toBeTruthy();
  });

  it("renders load numbers in the list", () => {
    render(<LoadList {...defaultProps} />);
    expect(screen.getByText(/LN-001/i)).toBeTruthy();
    expect(screen.getByText(/LN-002/i)).toBeTruthy();
    expect(screen.getByText(/LN-003/i)).toBeTruthy();
  });

  it("displays pickup city for each load", () => {
    render(<LoadList {...defaultProps} />);
    expect(screen.getByText(/Chicago/)).toBeTruthy();
    expect(screen.getByText(/Atlanta/)).toBeTruthy();
    expect(screen.getByText(/Houston/)).toBeTruthy();
  });

  it("filters loads by search term", () => {
    render(<LoadList {...defaultProps} />);
    const searchInputs = screen.getAllByRole("textbox");
    const searchInput = searchInputs[0];
    fireEvent.change(searchInput, { target: { value: "LN-001" } });
    expect(screen.getByText(/LN-001/i)).toBeTruthy();
  });
});
