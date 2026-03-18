import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoadList } from "../../../components/LoadList";
import { LoadData, User, LOAD_STATUS } from "../../../types";

vi.mock("../../../services/storageService", () => ({
  generateInvoicePDF: vi.fn(),
  saveLoad: vi.fn(),
}));

vi.mock("../../../services/authService", () => ({
  getCompany: vi.fn().mockReturnValue(null),
  getCurrentUser: vi.fn().mockReturnValue({
    id: "disp-1",
    role: "dispatcher",
    companyId: "company-1",
  }),
}));

const mockUsers: User[] = [
  {
    id: "driver-1",
    name: "John Driver",
    role: "driver",
    companyId: "company-1",
    email: "j@t.com",
    onboardingStatus: "Completed",
    safetyScore: 90,
  },
];

const mockLoads: LoadData[] = [
  {
    id: "load-1",
    companyId: "company-1",
    driverId: "driver-1",
    dispatcherId: "disp-1",
    loadNumber: "LN-001",
    status: LOAD_STATUS.Planned,
    carrierRate: 1500,
    driverPay: 900,
    pickupDate: "2025-12-01",
    pickup: { city: "Chicago", state: "IL", facilityName: "WH-A" },
    dropoff: { city: "Dallas", state: "TX", facilityName: "Depot-B" },
    freightType: "Dry Van",
    isActionRequired: true,
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
    freightType: "Intermodal",
    containerNumber: "CTR-123",
    chassisNumber: "CHS-456",
  },
];

describe("LoadList coverage — lines 82-86, 100, 160-165", () => {
  const defaultProps = {
    loads: mockLoads,
    onView: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    users: mockUsers,
    canViewRates: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders dispatcher scope toggle with 'Assigned Deck' and 'Fleet Network' buttons", () => {
    render(<LoadList {...defaultProps} />);
    expect(screen.getByText("Assigned Deck")).toBeInTheDocument();
    expect(screen.getByText("Fleet Network")).toBeInTheDocument();
  });

  it("toggles between Assigned Deck and Fleet Network views", async () => {
    const user = userEvent.setup();
    render(<LoadList {...defaultProps} />);

    // Default is 'my' (Assigned Deck) for dispatcher
    // In 'my' scope, only loads with dispatcherId=disp-1 are shown
    await user.click(screen.getByText("Fleet Network"));
    // Now both loads should be visible
    expect(screen.getByText(/LN-001/)).toBeInTheDocument();
    expect(screen.getByText(/LN-002/)).toBeInTheDocument();

    // Switch back to Assigned Deck
    await user.click(screen.getByText("Assigned Deck"));
    // Only load-1 (dispatcherId=disp-1) should be visible
    expect(screen.getByText(/LN-001/)).toBeInTheDocument();
  });

  it("toggles sort direction when filter button is clicked", async () => {
    const user = userEvent.setup();
    render(<LoadList {...defaultProps} />);
    // Find the sort toggle button (Filter icon button)
    const filterBtns = screen.getAllByRole("button");
    const sortBtn = filterBtns.find(
      (b) =>
        b.className.includes("bg-slate-900") &&
        b.className.includes("border-slate-800") &&
        b.querySelector("svg"),
    );
    expect(sortBtn).toBeTruthy();
    await user.click(sortBtn!);
    // Sorts should have toggled — no crash
  });

  it("renders Action Required badge for loads with isActionRequired", () => {
    render(<LoadList {...defaultProps} />);
    expect(screen.getByText("Action Required")).toBeInTheDocument();
  });

  it("calls onView when a load card is clicked", async () => {
    const user = userEvent.setup();
    render(<LoadList {...defaultProps} />);
    // Switch to fleet view to see all loads
    await user.click(screen.getByText("Fleet Network"));
    // Click on the load card for LN-001
    const loadCard = screen.getByText(/LN-001/).closest("[class*='cursor-pointer']");
    expect(loadCard).toBeInTheDocument();
    await user.click(loadCard!);
    expect(defaultProps.onView).toHaveBeenCalled();
  });

  it("renders Call and Modify buttons for each load", async () => {
    const user = userEvent.setup();
    render(<LoadList {...defaultProps} />);
    await user.click(screen.getByText("Fleet Network"));
    const callBtns = screen.getAllByText("Call");
    expect(callBtns.length).toBeGreaterThanOrEqual(1);
    const modifyBtns = screen.getAllByText("Modify");
    expect(modifyBtns.length).toBeGreaterThanOrEqual(1);
  });

  it("calls onOpenHub when Call button is clicked (stopPropagation prevents onView)", async () => {
    const onOpenHub = vi.fn();
    const user = userEvent.setup();
    render(<LoadList {...defaultProps} onOpenHub={onOpenHub} />);
    await user.click(screen.getByText("Fleet Network"));
    const callBtns = screen.getAllByText("Call");
    await user.click(callBtns[0]);
    expect(onOpenHub).toHaveBeenCalledWith("messaging", true);
    // onView should NOT have been called because stopPropagation
    expect(defaultProps.onView).not.toHaveBeenCalled();
  });

  it("calls onEdit when Modify button is clicked", async () => {
    const user = userEvent.setup();
    render(<LoadList {...defaultProps} />);
    await user.click(screen.getByText("Fleet Network"));
    const modifyBtns = screen.getAllByText("Modify");
    await user.click(modifyBtns[0]);
    expect(defaultProps.onEdit).toHaveBeenCalled();
  });

  it("renders container and chassis numbers for intermodal loads", async () => {
    const user = userEvent.setup();
    render(<LoadList {...defaultProps} />);
    await user.click(screen.getByText("Fleet Network"));
    expect(screen.getByText("CTR-123")).toBeInTheDocument();
    expect(screen.getByText("CHS-456")).toBeInTheDocument();
  });

  it("shows CONFIDENTIAL when canViewRates is false", () => {
    render(<LoadList {...defaultProps} canViewRates={false} />);
    const text = document.body.textContent || "";
    expect(text).toContain("CONFIDENTIAL");
  });

  it("renders driver name from users prop", () => {
    render(<LoadList {...defaultProps} />);
    expect(screen.getByText("John Driver")).toBeInTheDocument();
  });

  it("shows UNASSIGNED when driver is not in users list", async () => {
    const user = userEvent.setup();
    render(<LoadList {...defaultProps} />);
    await user.click(screen.getByText("Fleet Network"));
    expect(screen.getByText("UNASSIGNED")).toBeInTheDocument();
  });

  it("renders empty state when no loads match filter", async () => {
    const user = userEvent.setup();
    render(<LoadList {...defaultProps} />);
    const searchInput = screen.getAllByRole("textbox")[0];
    await user.type(searchInput, "ZZZZNONEXISTENT");
    expect(screen.getByText("No loads to show")).toBeInTheDocument();
  });
});
