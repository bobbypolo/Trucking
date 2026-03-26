import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoadBoardEnhanced } from "../../../components/LoadBoardEnhanced";
import { LoadData, User, Broker, LOAD_STATUS } from "../../../types";

// Tests R-P6-04

// Mock authService since LoadList (child) calls getCurrentUser
vi.mock("../../../services/authService", () => ({
  getCurrentUser: vi.fn().mockReturnValue({
    id: "user-1",
    role: "admin",
    companyId: "company-1",
  }),
  getCompany: vi.fn().mockResolvedValue({ id: "company-1", name: "Test Co" }),
  getCompanyUsers: vi.fn().mockResolvedValue([]),
  onUserChange: vi.fn(() => () => {}),
}));

// Mock storageService since LoadList uses generateInvoicePDF/saveLoad
vi.mock("../../../services/storageService", () => ({
  generateInvoicePDF: vi.fn(),
  saveLoad: vi.fn().mockResolvedValue(undefined),
  generateNextLoadNumber: vi.fn().mockReturnValue("LP-100"),
}));

// Mock brokerService for LoadSetupModal
vi.mock("../../../services/brokerService", () => ({
  getBrokers: vi.fn().mockResolvedValue([]),
}));

const mockUsers: User[] = [
  {
    id: "driver-1",
    name: "John Driver",
    role: "driver",
    companyId: "c1",
    email: "j@t.com",
    onboardingStatus: "Completed",
    safetyScore: 90,
  },
];

const mockBrokers: Broker[] = [
  {
    id: "broker-1",
    name: "Alpha Logistics",
    mcNumber: "MC-123",
    isShared: true,
    clientType: "Broker",
    approvedChassis: [],
  },
];

const createLoad = (overrides: Partial<LoadData> = {}): LoadData => ({
  id: `load-${Math.random().toString(36).slice(2)}`,
  companyId: "c1",
  driverId: "driver-1",
  loadNumber: "LN-100",
  status: LOAD_STATUS.Planned,
  carrierRate: 2000,
  driverPay: 1200,
  pickupDate: "2025-12-01",
  pickup: { city: "Chicago", state: "IL" },
  dropoff: { city: "Dallas", state: "TX" },
  ...overrides,
});

const mockLoads: LoadData[] = [
  createLoad({ id: "load-1", loadNumber: "LN-100" }),
  createLoad({ id: "load-2", loadNumber: "LN-101" }),
];

describe("LoadBoardEnhanced +New button z-index (R-P6-04)", () => {
  const onCreateLoad = vi.fn();
  const defaultProps = {
    loads: mockLoads,
    users: mockUsers,
    brokers: mockBrokers,
    onView: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    canViewRates: true,
    onCreateLoad,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Create Load button when loads exist and onCreateLoad is provided", () => {
    render(<LoadBoardEnhanced {...defaultProps} />);
    const newButton = screen.getByRole("button", { name: /create load/i });
    expect(newButton).toBeInTheDocument();
  });

  it("Create Load button has z-index higher than sidebar toggle (z-20) and bottom panel (z-30)", () => {
    render(<LoadBoardEnhanced {...defaultProps} />);
    const newButton = screen.getByRole("button", { name: /create load/i });
    // The button or its container should have z-40 or higher class
    const buttonOrParent = newButton.closest("[class*='z-']") || newButton;
    const classes = buttonOrParent.className;
    // Should have z-40 (higher than z-20 sidebar toggle and z-30 bottom panel)
    expect(classes).toMatch(/z-40/);
  });

  it("Create Load button opens internal setup modal when clicked", async () => {
    const user = userEvent.setup();
    render(<LoadBoardEnhanced {...defaultProps} />);
    const newButton = screen.getByRole("button", { name: /create load/i });
    await user.click(newButton);
    // Modal should appear instead of directly calling onCreateLoad
    expect(screen.getByText("Setup New Load")).toBeInTheDocument();
  });

  it("Create Load button is NOT rendered when onCreateLoad is not provided", () => {
    const { onCreateLoad: _, ...propsWithout } = defaultProps;
    render(<LoadBoardEnhanced {...propsWithout} />);
    const newButton = screen.queryByRole("button", { name: /create load/i });
    expect(newButton).not.toBeInTheDocument();
  });

  it("sidebar toggle has z-20 (lower than +New button)", () => {
    render(<LoadBoardEnhanced {...defaultProps} />);
    const sidebarToggle = document.querySelector('[class*="absolute right-0"]');
    expect(sidebarToggle).toBeTruthy();
    expect(sidebarToggle!.className).toMatch(/z-20/);
  });

  it("bottom panel has z-30 (lower than +New button)", () => {
    render(<LoadBoardEnhanced {...defaultProps} />);
    // The bottom panel is the element with "Detailed Load Table" text and z-30
    const bottomPanel = screen
      .getByText("Detailed Load Table")
      .closest('[class*="z-30"]');
    expect(bottomPanel).toBeTruthy();
  });
});
