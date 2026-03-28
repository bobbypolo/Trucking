import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
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

const adminUser: User = {
  id: "user-1",
  companyId: "company-1",
  email: "admin@test.com",
  name: "Admin User",
  role: "admin",
  onboardingStatus: "Completed",
  safetyScore: 100,
};

const payrollUser: User = {
  ...adminUser,
  id: "user-2",
  role: "payroll_manager",
  name: "Payroll Manager",
};

const driverUser: User = {
  ...adminUser,
  id: "user-3",
  role: "driver",
  name: "Driver User",
};

// Exception using the unified API shape (not load.issues)
const openPayrollException: Exception = {
  id: "exc-payroll-1",
  tenantId: "company-1",
  type: "billing",
  severity: 3,
  status: "OPEN",
  entityType: "LOAD",
  entityId: "load-1",
  description: "Pay discrepancy found",
  createdAt: "2026-01-15T10:00:00Z",
  updatedAt: "2026-01-15T10:00:00Z",
};

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
];

const actionRequiredLoads: LoadData[] = [
  {
    ...mockLoads[0],
    isActionRequired: true,
    actionSummary: "Needs manager approval",
  },
];

describe("IssueSidebar permission explanation UX (H-504)", () => {
  const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    onViewLoad: vi.fn(),
    onRefresh: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: return the open payroll exception so cards render
    mockGetExceptions.mockResolvedValue([openPayrollException]);
  });

  describe("R-W4-04a: resolve button visibility by role", () => {
    it("does not show resolve button for payroll_manager (canResolve is false)", async () => {
      render(
        <IssueSidebar
          {...baseProps}
          loads={mockLoads}
          currentUser={payrollUser}
        />,
      );
      await waitFor(() => {
        expect(screen.getByText("Pay discrepancy found")).toBeInTheDocument();
      });
      // payroll_manager is not in canResolve roles — resolve button is not rendered at all
      expect(
        screen.queryByRole("button", { name: "Resolve issue" }),
      ).not.toBeInTheDocument();
    });

    it("shows enabled resolve button for admin", async () => {
      render(
        <IssueSidebar
          {...baseProps}
          loads={mockLoads}
          currentUser={adminUser}
        />,
      );
      await waitFor(() => {
        expect(screen.getByText("Pay discrepancy found")).toBeInTheDocument();
      });
      const resolveBtn = screen.getByRole("button", { name: "Resolve issue" });
      expect(resolveBtn).not.toBeDisabled();
    });

    it("shows disabled approve/reject buttons with title for non-admin", () => {
      render(
        <IssueSidebar
          {...baseProps}
          loads={actionRequiredLoads}
          currentUser={payrollUser}
        />,
      );
      const approveBtn = screen.getByRole("button", { name: /approve/i });
      const rejectBtn = screen.getByRole("button", { name: /reject/i });
      expect(approveBtn).toBeDisabled();
      expect(rejectBtn).toBeDisabled();
      expect(approveBtn).toHaveAttribute(
        "title",
        "Only administrators can approve actions",
      );
      expect(rejectBtn).toHaveAttribute(
        "title",
        "Only administrators can reject actions",
      );
    });

    it("shows enabled approve/reject buttons for admin", () => {
      render(
        <IssueSidebar
          {...baseProps}
          loads={actionRequiredLoads}
          currentUser={adminUser}
        />,
      );
      const approveBtn = screen.getByRole("button", { name: /approve/i });
      const rejectBtn = screen.getByRole("button", { name: /reject/i });
      expect(approveBtn).not.toBeDisabled();
      expect(rejectBtn).not.toBeDisabled();
    });
  });

  describe("R-W4-04b: info banner for non-admin role-mapped users", () => {
    it("shows info banner for payroll_manager", async () => {
      render(
        <IssueSidebar
          {...baseProps}
          loads={mockLoads}
          currentUser={payrollUser}
        />,
      );
      await waitFor(() => {
        expect(
          screen.getByText(/Some actions require administrator privileges/i),
        ).toBeInTheDocument();
      });
    });

    it("does not show info banner for admin", async () => {
      render(
        <IssueSidebar
          {...baseProps}
          loads={mockLoads}
          currentUser={adminUser}
        />,
      );
      await waitFor(() => {
        expect(screen.getByText("Pay discrepancy found")).toBeInTheDocument();
      });
      expect(
        screen.queryByText(/Some actions require administrator privileges/i),
      ).not.toBeInTheDocument();
    });

    it("shows role-specific empty state for unmapped roles", async () => {
      mockGetExceptions.mockResolvedValue([]);
      render(
        <IssueSidebar
          {...baseProps}
          loads={mockLoads}
          currentUser={driverUser}
        />,
      );
      await waitFor(() => {
        expect(
          screen.getByText("No actions available for your role"),
        ).toBeInTheDocument();
      });
      expect(
        screen.getByText("Contact an administrator for access"),
      ).toBeInTheDocument();
    });
  });
});
