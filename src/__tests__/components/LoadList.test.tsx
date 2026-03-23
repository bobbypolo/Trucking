import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
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
  onUserChange: vi.fn(() => () => {}),
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

  it("filters loads by city name search (lines 82-86)", () => {
    render(<LoadList {...defaultProps} />);
    const searchInput = screen.getAllByRole("textbox")[0];
    fireEvent.change(searchInput, { target: { value: "Atlanta" } });
    expect(screen.getByText(/LN-002/i)).toBeTruthy();
    expect(screen.queryByText(/LN-001/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/LN-003/i)).not.toBeInTheDocument();
  });

  it("shows no loads message when search matches nothing (line 100)", () => {
    render(<LoadList {...defaultProps} />);
    const searchInput = screen.getAllByRole("textbox")[0];
    fireEvent.change(searchInput, { target: { value: "NONEXISTENT_LOAD_XYZ" } });
    expect(screen.getByText(/No loads to show/i)).toBeInTheDocument();
  });

  it("toggles sort direction when filter button is clicked (lines 160-165)", () => {
    render(<LoadList {...defaultProps} />);
    // Find the sort/filter button (has Filter icon)
    const buttons = screen.getAllByRole("button");
    const filterBtn = buttons.find((b) =>
      b.querySelector("svg") && !b.textContent?.trim(),
    );
    expect(filterBtn).toBeTruthy();
    fireEvent.click(filterBtn!);
    // Loads should now be in desc order (LN-003 first)
    const loadEls = screen.getAllByText(/Manifest LN-/);
    expect(loadEls[0].textContent).toContain("LN-003");
  });

  it("calls onView when a load card is clicked", () => {
    render(<LoadList {...defaultProps} />);
    const loadCard = screen.getByText(/LN-001/i).closest("[class*='cursor-pointer']");
    expect(loadCard).toBeTruthy();
    fireEvent.click(loadCard!);
    expect(defaultProps.onView).toHaveBeenCalledWith(mockLoads[0]);
  });

  it("calls onEdit when Modify button is clicked", () => {
    render(<LoadList {...defaultProps} />);
    const modifyBtns = screen.getAllByText("Modify");
    fireEvent.click(modifyBtns[0]);
    expect(defaultProps.onEdit).toHaveBeenCalledWith(mockLoads[0]);
  });

  it("hides rates when canViewRates is false", () => {
    render(<LoadList {...defaultProps} canViewRates={false} />);
    expect(screen.getAllByText("CONFIDENTIAL").length).toBeGreaterThan(0);
    expect(screen.queryByText("$1,500")).not.toBeInTheDocument();
  });

  it("shows carrier rates when canViewRates is true", () => {
    render(<LoadList {...defaultProps} canViewRates={true} />);
    expect(screen.getByText("$1,500")).toBeInTheDocument();
    expect(screen.getByText("$2,000")).toBeInTheDocument();
  });

  it("shows Action Required badge for flagged loads", () => {
    const flaggedLoads = [
      { ...mockLoads[0], isActionRequired: true },
    ];
    render(<LoadList {...defaultProps} loads={flaggedLoads} />);
    expect(screen.getByText("Action Required")).toBeInTheDocument();
  });

  it("displays driver name from users prop", () => {
    const singleLoad: LoadData[] = [mockLoads[0]];
    const users = [
      {
        id: "driver-1",
        name: "John Trucker",
        role: "driver" as const,
        companyId: "company-1",
        email: "j@t.com",
        onboardingStatus: "Completed" as const,
        safetyScore: 90,
      },
    ];
    render(<LoadList {...defaultProps} loads={singleLoad} users={users} />);
    expect(screen.getByText("John Trucker")).toBeInTheDocument();
  });

  it("shows UNASSIGNED when driver is not found in users", () => {
    render(<LoadList {...defaultProps} users={[]} />);
    expect(screen.getAllByText("UNASSIGNED").length).toBeGreaterThan(0);
  });
});
