import React from "react";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { IssueSidebar } from "../../../components/IssueSidebar";
import { LoadData, User, LOAD_STATUS, Exception } from "../../../types";

vi.mock("../../../services/storageService", () => ({
  saveLoad: vi.fn().mockResolvedValue(undefined),
}));

const mockGetExceptions = vi.fn().mockResolvedValue([]);
const mockUpdateException = vi.fn().mockResolvedValue(true);

vi.mock("../../../services/exceptionService", () => ({
  getExceptions: (...args: unknown[]) => mockGetExceptions(...args),
  updateException: (...args: unknown[]) => mockUpdateException(...args),
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

// Mock exceptions using the Exception type (from unified exceptions API)
const mockExceptions: Exception[] = [
  {
    id: "exc-1",
    tenantId: "company-1",
    type: "dispatch",
    severity: 3,
    status: "OPEN",
    entityType: "LOAD",
    entityId: "load-1",
    description: "Driver delayed at pickup",
    createdAt: "2026-01-15T10:00:00Z",
    updatedAt: "2026-01-15T10:00:00Z",
  },
  {
    id: "exc-2",
    tenantId: "company-1",
    type: "safety",
    severity: 4,
    status: "OPEN",
    entityType: "LOAD",
    entityId: "load-1",
    description: "Trailer tire blowout",
    createdAt: "2026-01-14T08:00:00Z",
    updatedAt: "2026-01-14T08:00:00Z",
  },
  {
    id: "exc-3",
    tenantId: "company-1",
    type: "billing",
    severity: 2,
    status: "RESOLVED",
    entityType: "LOAD",
    entityId: "load-2",
    description: "Driver pay discrepancy",
    createdAt: "2026-01-13T14:00:00Z",
    updatedAt: "2026-01-14T08:00:00Z",
    resolvedAt: "2026-01-14T08:00:00Z",
  },
  {
    id: "exc-4",
    tenantId: "company-1",
    type: "handoff",
    severity: 2,
    status: "OPEN",
    entityType: "LOAD",
    entityId: "load-1",
    description: "Missing handoff documentation",
    createdAt: "2026-01-15T12:00:00Z",
    updatedAt: "2026-01-15T12:00:00Z",
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
    // Default: return open exceptions only (exc-1, exc-2, exc-4); exc-3 is RESOLVED
    mockGetExceptions.mockResolvedValue([
      mockExceptions[0],
      mockExceptions[1],
      mockExceptions[2],
      mockExceptions[3],
    ]);
  });

  it("renders the Issues & Alerts header when open", async () => {
    render(<IssueSidebar {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Issues & Alerts/)).toBeInTheDocument();
    });
  });

  it("returns null when isOpen is false", () => {
    const { container } = render(
      <IssueSidebar {...defaultProps} isOpen={false} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("displays active (non-resolved) exceptions", async () => {
    render(<IssueSidebar {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Driver delayed at pickup")).toBeInTheDocument();
    });
    expect(screen.getByText("Trailer tire blowout")).toBeInTheDocument();
    expect(
      screen.getByText("Missing handoff documentation"),
    ).toBeInTheDocument();
  });

  it("does not display resolved exceptions", async () => {
    render(<IssueSidebar {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Driver delayed at pickup")).toBeInTheDocument();
    });
    expect(
      screen.queryByText("Driver pay discrepancy"),
    ).not.toBeInTheDocument();
  });

  it("shows the issue count badge with correct number of open exceptions", async () => {
    render(<IssueSidebar {...defaultProps} />);
    // 3 open exceptions (exc-1, exc-2, exc-4); exc-3 is RESOLVED and filtered out
    await waitFor(() => {
      expect(screen.getByText("3")).toBeInTheDocument();
    });
  });

  it("shows all open exceptions for safety_manager role", async () => {
    const safetyUser = { ...mockUser, role: "safety_manager" as const };
    render(<IssueSidebar {...defaultProps} currentUser={safetyUser} />);
    // All open exceptions are shown regardless of role (role filtering removed)
    await waitFor(() => {
      expect(screen.getByText("Trailer tire blowout")).toBeInTheDocument();
    });
    expect(screen.getByText("Driver delayed at pickup")).toBeInTheDocument();
    expect(
      screen.getByText("Missing handoff documentation"),
    ).toBeInTheDocument();
  });

  it("shows all open exceptions for dispatcher role", async () => {
    const dispatcherUser = { ...mockUser, role: "dispatcher" as const };
    render(<IssueSidebar {...defaultProps} currentUser={dispatcherUser} />);
    await waitFor(() => {
      expect(screen.getByText("Driver delayed at pickup")).toBeInTheDocument();
    });
    expect(screen.getByText("Trailer tire blowout")).toBeInTheDocument();
    expect(
      screen.getByText("Missing handoff documentation"),
    ).toBeInTheDocument();
  });

  it("shows all open exceptions for payroll_manager role", async () => {
    const payrollUser = { ...mockUser, role: "payroll_manager" as const };
    render(<IssueSidebar {...defaultProps} currentUser={payrollUser} />);
    await waitFor(() => {
      expect(screen.getByText("Driver delayed at pickup")).toBeInTheDocument();
    });
    // Resolved exception still not shown
    expect(
      screen.queryByText("Driver pay discrepancy"),
    ).not.toBeInTheDocument();
  });

  it("shows no-access message for driver role", async () => {
    mockGetExceptions.mockResolvedValue([]);
    const driverUser = { ...mockUser, role: "driver" as const };
    render(<IssueSidebar {...defaultProps} currentUser={driverUser} />);
    // Driver role is not in the role-mapped list, so shows the non-mapped message
    await waitFor(() => {
      expect(
        screen.getByText("No actions available for your role"),
      ).toBeInTheDocument();
    });
  });

  it("calls onClose when the close button is clicked", async () => {
    const user = userEvent.setup();
    render(<IssueSidebar {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Issues & Alerts/)).toBeInTheDocument();
    });
    const closeButton = screen.getByRole("button", { name: "Close sidebar" });
    await user.click(closeButton);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("calls updateException when admin clicks the resolve button on an exception", async () => {
    const user = userEvent.setup();
    render(<IssueSidebar {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Driver delayed at pickup")).toBeInTheDocument();
    });
    const resolveButtons = screen.getAllByRole("button", {
      name: "Resolve issue",
    });
    await user.click(resolveButtons[0]);
    expect(mockUpdateException).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ status: "RESOLVED" }),
    );
  });

  it("does not render resolve buttons for payroll_manager (no canResolve)", async () => {
    const payrollUser = { ...mockUser, role: "payroll_manager" as const };
    render(<IssueSidebar {...defaultProps} currentUser={payrollUser} />);
    await waitFor(() => {
      expect(screen.getByText("Driver delayed at pickup")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: "Resolve issue" }),
    ).not.toBeInTheDocument();
  });

  it("saveLoad is NOT called when resolving exceptions (legacy behavior removed)", async () => {
    const user = userEvent.setup();
    render(<IssueSidebar {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Driver delayed at pickup")).toBeInTheDocument();
    });
    const resolveButtons = screen.getAllByRole("button", {
      name: "Resolve issue",
    });
    await user.click(resolveButtons[0]);
    expect(saveLoad).not.toHaveBeenCalled();
  });

  it("switches between All Issues and Calls tabs", async () => {
    const user = userEvent.setup();
    render(<IssueSidebar {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("All Issues")).toBeInTheDocument();
    });
    expect(screen.getByText("Call Matrix")).toBeInTheDocument();

    await user.click(screen.getByText("Call Matrix"));
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

  it("shows the No Active Issues empty state when exceptions API returns no open issues", async () => {
    mockGetExceptions.mockResolvedValue([]);
    render(<IssueSidebar {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("No Active Issues")).toBeInTheDocument();
    });
  });

  it("calls onViewLoad from the call log view button", async () => {
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
    const viewBtn = screen.getByRole("button", { name: /view/i });
    await user.click(viewBtn);
    expect(defaultProps.onViewLoad).toHaveBeenCalledWith(loadsWithCalls[0]);
  });
});
