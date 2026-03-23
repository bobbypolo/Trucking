import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { IssueSidebar } from "../../../components/IssueSidebar";
import { LoadData, User, LOAD_STATUS, Issue } from "../../../types";

vi.mock("../../../services/storageService", () => ({
  saveLoad: vi.fn().mockResolvedValue(undefined),
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

const mockIssues: Issue[] = [
  {
    id: "issue-1",
    loadId: "load-1",
    type: "payment",
    category: "Payroll",
    severity: "high",
    status: "Open",
    description: "Pay discrepancy found",
    createdAt: "2026-01-15T10:00:00Z",
    createdBy: "payroll",
    reportedAt: "2026-01-15T10:00:00Z",
    reportedBy: "payroll",
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
    issues: mockIssues,
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
  });

  describe("R-W4-04a: disabled buttons have explanatory title", () => {
    it("shows disabled resolve button with title for payroll_manager", () => {
      render(
        <IssueSidebar
          {...baseProps}
          loads={mockLoads}
          currentUser={payrollUser}
        />,
      );
      // Payroll manager can see payroll issues but cannot resolve them
      const issueText = screen.getByText("Pay discrepancy found");
      const card = issueText.closest(
        "div[class*='rounded-xl']",
      ) as HTMLElement;
      const buttons = within(card).getAllByRole("button");
      // Second button is the resolve button (first is view)
      const resolveBtn = buttons[1];
      expect(resolveBtn).toBeDisabled();
      expect(resolveBtn).toHaveAttribute(
        "title",
        "Only admins, safety managers, and dispatchers can resolve issues",
      );
    });

    it("shows enabled resolve button for admin", () => {
      render(
        <IssueSidebar
          {...baseProps}
          loads={mockLoads}
          currentUser={adminUser}
        />,
      );
      const issueText = screen.getByText("Pay discrepancy found");
      const card = issueText.closest(
        "div[class*='rounded-xl']",
      ) as HTMLElement;
      const buttons = within(card).getAllByRole("button");
      const resolveBtn = buttons[1];
      expect(resolveBtn).not.toBeDisabled();
      expect(resolveBtn).not.toHaveAttribute("title");
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
    it("shows info banner for payroll_manager", () => {
      render(
        <IssueSidebar
          {...baseProps}
          loads={mockLoads}
          currentUser={payrollUser}
        />,
      );
      expect(
        screen.getByText(
          /Some actions require administrator privileges/i,
        ),
      ).toBeInTheDocument();
    });

    it("does not show info banner for admin", () => {
      render(
        <IssueSidebar
          {...baseProps}
          loads={mockLoads}
          currentUser={adminUser}
        />,
      );
      expect(
        screen.queryByText(
          /Some actions require administrator privileges/i,
        ),
      ).not.toBeInTheDocument();
    });

    it("shows role-specific empty state for unmapped roles", () => {
      render(
        <IssueSidebar
          {...baseProps}
          loads={mockLoads}
          currentUser={driverUser}
        />,
      );
      expect(
        screen.getByText("No actions available for your role"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Contact an administrator for access"),
      ).toBeInTheDocument();
    });
  });
});
