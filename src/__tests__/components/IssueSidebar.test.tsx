import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { IssueSidebar } from "../../../components/IssueSidebar";
import { LoadData, User, LOAD_STATUS, Issue } from "../../../types";

vi.mock("../../../services/storageService", () => ({
  saveLoad: vi.fn().mockResolvedValue(undefined),
}));

import { saveLoad } from "../../../services/storageService";

const mockUser: User = {
  id: "user-1",
  companyId: "company-1",
  email: "admin@test.com",
  name: "Admin User",
  role: "admin",
  onboardingStatus: "Completed",
  safetyScore: 100,
};

const mockIssues: Issue[] = [
  {
    id: "issue-1",
    loadId: "load-1",
    type: "delay",
    category: "Dispatch",
    severity: "high",
    status: "Open",
    description: "Driver delayed at pickup",
    createdAt: "2026-01-15T10:00:00Z",
    createdBy: "admin",
    reportedAt: "2026-01-15T10:00:00Z",
    reportedBy: "admin",
  },
  {
    id: "issue-2",
    loadId: "load-1",
    type: "damage",
    category: "Safety",
    severity: "critical",
    status: "Open",
    description: "Trailer tire blowout",
    createdAt: "2026-01-14T08:00:00Z",
    createdBy: "driver",
    reportedAt: "2026-01-14T08:00:00Z",
    reportedBy: "driver",
  },
  {
    id: "issue-3",
    loadId: "load-2",
    type: "payment",
    category: "Payroll",
    severity: "medium",
    status: "Resolved",
    description: "Driver pay discrepancy",
    createdAt: "2026-01-13T14:00:00Z",
    createdBy: "payroll",
    resolvedAt: "2026-01-14T08:00:00Z",
    reportedAt: "2026-01-13T14:00:00Z",
    reportedBy: "payroll",
  },
  {
    id: "issue-4",
    loadId: "load-1",
    type: "handoff",
    category: "Handoff",
    severity: "medium",
    status: "Open",
    description: "Missing handoff documentation",
    createdAt: "2026-01-15T12:00:00Z",
    createdBy: "dispatcher",
    reportedAt: "2026-01-15T12:00:00Z",
    reportedBy: "dispatcher",
  },
];

const mockLoads: LoadData[] = [
  {
    id: "load-1",
    companyId: "company-1",
    driverId: "driver-1",
    loadNumber: "LN-001",
    status: LOAD_STATUS.In_Transit,
    carrierRate: 1500,
    driverPay: 900,
    pickupDate: "2026-01-15",
    pickup: { city: "Chicago", state: "IL" },
    dropoff: { city: "Dallas", state: "TX" },
    issues: [mockIssues[0], mockIssues[1], mockIssues[3]],
  },
  {
    id: "load-2",
    companyId: "company-1",
    driverId: "driver-2",
    loadNumber: "LN-002",
    status: LOAD_STATUS.Delivered,
    carrierRate: 2000,
    driverPay: 1200,
    pickupDate: "2026-01-14",
    pickup: { city: "Atlanta", state: "GA" },
    dropoff: { city: "Miami", state: "FL" },
    issues: [mockIssues[2]],
  },
];

describe("IssueSidebar component", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    loads: mockLoads,
    currentUser: mockUser,
    onViewLoad: vi.fn(),
    onRefresh: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Action Center header when open", () => {
    render(<IssueSidebar {...defaultProps} />);
    expect(screen.getByText("Action Center")).toBeInTheDocument();
  });

  it("returns null when isOpen is false", () => {
    const { container } = render(
      <IssueSidebar {...defaultProps} isOpen={false} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("displays active (non-resolved) issues for admin", () => {
    render(<IssueSidebar {...defaultProps} />);
    expect(screen.getByText("Driver delayed at pickup")).toBeInTheDocument();
    expect(screen.getByText("Trailer tire blowout")).toBeInTheDocument();
    expect(
      screen.getByText("Missing handoff documentation"),
    ).toBeInTheDocument();
  });

  it("does not display resolved issues", () => {
    render(<IssueSidebar {...defaultProps} />);
    expect(screen.queryByText("Driver pay discrepancy")).not.toBeInTheDocument();
  });

  it("shows the issue count badge with correct number", () => {
    render(<IssueSidebar {...defaultProps} />);
    // Admin sees all 3 active issues
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("filters issues for safety_manager role (Safety, Maintenance, Incident)", () => {
    const safetyUser = { ...mockUser, role: "safety_manager" as const };
    render(<IssueSidebar {...defaultProps} currentUser={safetyUser} />);
    expect(screen.getByText("Trailer tire blowout")).toBeInTheDocument();
    expect(
      screen.queryByText("Driver delayed at pickup"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Missing handoff documentation"),
    ).not.toBeInTheDocument();
  });

  it("filters issues for dispatcher role (Dispatch, Handoff)", () => {
    const dispatcherUser = { ...mockUser, role: "dispatcher" as const };
    render(<IssueSidebar {...defaultProps} currentUser={dispatcherUser} />);
    expect(screen.getByText("Driver delayed at pickup")).toBeInTheDocument();
    expect(
      screen.getByText("Missing handoff documentation"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Trailer tire blowout")).not.toBeInTheDocument();
  });

  it("filters issues for payroll_manager role (only Payroll category)", () => {
    const payrollUser = { ...mockUser, role: "payroll_manager" as const };
    render(<IssueSidebar {...defaultProps} currentUser={payrollUser} />);
    // All payroll issues are resolved, so nothing shows
    expect(
      screen.queryByText("Driver delayed at pickup"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Trailer tire blowout")).not.toBeInTheDocument();
  });

  it("shows No Priority Issues for driver role (no access)", () => {
    const driverUser = { ...mockUser, role: "driver" as const };
    render(<IssueSidebar {...defaultProps} currentUser={driverUser} />);
    expect(screen.getByText("No Priority Issues")).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", async () => {
    const user = userEvent.setup();
    render(<IssueSidebar {...defaultProps} />);
    // The close button is the one with the X icon in the header
    const header = screen.getByText("Action Center").closest("div")!;
    const closeButton = within(header).getByRole("button");
    await user.click(closeButton);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onViewLoad when the view-load arrow button is clicked", async () => {
    const user = userEvent.setup();
    render(<IssueSidebar {...defaultProps} />);
    // Find the first issue description, then navigate to its card
    const issueText = screen.getByText("Driver delayed at pickup");
    const card = issueText.closest("div[class*='rounded-xl']") as HTMLElement;
    const viewBtn = within(card).getAllByRole("button")[0];
    await user.click(viewBtn);
    expect(defaultProps.onViewLoad).toHaveBeenCalledWith(mockLoads[0]);
  });

  it("resolves an issue when admin clicks the resolve button", async () => {
    const user = userEvent.setup();
    render(<IssueSidebar {...defaultProps} />);
    // Find the first issue card and its resolve (check) button
    const card = screen
      .getByText("Driver delayed at pickup")
      .closest("div[class*='rounded-xl']") as HTMLElement;
    const buttons = within(card).getAllByRole("button");
    // The resolve button is the second one (after the view button)
    const resolveBtn = buttons[1];
    await user.click(resolveBtn);
    expect(saveLoad).toHaveBeenCalled();
    expect(defaultProps.onRefresh).toHaveBeenCalled();
  });

  it("switches between Issues and Calls tabs", async () => {
    const user = userEvent.setup();
    render(<IssueSidebar {...defaultProps} />);
    expect(screen.getByText("Dept Issues")).toBeInTheDocument();
    expect(screen.getByText("Call Matrix")).toBeInTheDocument();

    await user.click(screen.getByText("Call Matrix"));
    // After switching to Calls tab, the issues should not be visible
    // and we should see the empty comms state
    expect(screen.getByText("No Comm Records")).toBeInTheDocument();
  });

  it("displays call logs under the Calls tab", async () => {
    const user = userEvent.setup();
    const loadsWithCalls: LoadData[] = [
      {
        ...mockLoads[0],
        callLogs: [
          {
            id: "call-1",
            type: "Inbound",
            recordedBy: "Dispatcher Jane",
            timestamp: "2026-01-15T11:00:00Z",
            notes: "Driver called about pickup delay",
          },
        ],
      },
    ];
    render(<IssueSidebar {...defaultProps} loads={loadsWithCalls} />);
    await user.click(screen.getByText("Call Matrix"));
    expect(
      screen.getByText(/Driver called about pickup delay/),
    ).toBeInTheDocument();
    expect(screen.getByText("Dispatcher Jane")).toBeInTheDocument();
  });

  it("shows the No Priority Issues empty state when loads have no issues", () => {
    const loadsNoIssues: LoadData[] = [
      {
        id: "load-x",
        companyId: "company-1",
        driverId: "d-1",
        loadNumber: "LN-X",
        status: LOAD_STATUS.In_Transit,
        carrierRate: 1000,
        driverPay: 600,
        pickupDate: "2026-01-15",
        pickup: { city: "A", state: "TX" },
        dropoff: { city: "B", state: "OK" },
      },
    ];
    render(<IssueSidebar {...defaultProps} loads={loadsNoIssues} />);
    expect(screen.getByText("No Priority Issues")).toBeInTheDocument();
  });
});
