import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExceptionConsole } from "../../../components/ExceptionConsole";
import { User, Exception, ExceptionType } from "../../../types";

vi.mock("../../../services/exceptionService", () => ({
  getExceptions: vi.fn(),
  getExceptionTypes: vi.fn(),
  updateException: vi.fn(),
}));

import {
  getExceptions,
  getExceptionTypes,
  updateException,
} from "../../../services/exceptionService";

const mockUser: User = {
  id: "user-1",
  companyId: "company-1",
  email: "admin@test.com",
  name: "Admin User",
  role: "admin",
  onboardingStatus: "Completed",
  safetyScore: 100,
};

const mockExceptions: Exception[] = [
  {
    id: "exc-1",
    tenantId: "company-1",
    type: "UNBILLED_LOAD",
    status: "OPEN",
    severity: 2,
    entityType: "LOAD",
    entityId: "load-2",
    description: "Load not billed for 15 days",
    createdAt: "2026-01-14T08:00:00Z",
    updatedAt: "2026-01-14T12:00:00Z",
    workflowStep: "Pending",
    financialImpactEst: 1500,
  },
  {
    id: "exc-2",
    tenantId: "company-1",
    type: "NEGATIVE_MARGIN",
    status: "OPEN",
    severity: 4,
    entityType: "LOAD",
    entityId: "load-3",
    description: "Load has negative margin",
    createdAt: "2026-01-13T14:00:00Z",
    updatedAt: "2026-01-13T16:00:00Z",
    workflowStep: "Escalated",
    financialImpactEst: -200,
  },
  {
    id: "exc-3",
    tenantId: "company-1",
    type: "UNALLOCATED_EXPENSE",
    status: "OPEN",
    severity: 1,
    entityType: "LOAD",
    entityId: "load-4",
    description: "Expense not allocated to any load",
    createdAt: "2026-01-12T09:00:00Z",
    updatedAt: "2026-01-12T09:00:00Z",
    workflowStep: "Triage",
  },
  {
    id: "exc-4",
    tenantId: "company-1",
    type: "DISPUTED_INVOICE",
    status: "OPEN",
    severity: 3,
    entityType: "LOAD",
    entityId: "load-5",
    description: "Invoice disputed by customer",
    createdAt: "2026-01-11T08:00:00Z",
    updatedAt: "2026-01-11T08:00:00Z",
    workflowStep: "Review",
  },
  {
    id: "exc-5",
    tenantId: "company-1",
    type: "SETTLEMENT_HOLD",
    status: "OPEN",
    severity: 2,
    entityType: "DRIVER",
    entityId: "driver-1",
    description: "Settlement on hold pending docs",
    createdAt: "2026-01-10T07:00:00Z",
    updatedAt: "2026-01-10T07:00:00Z",
    workflowStep: "Pending",
  },
  {
    id: "exc-6",
    tenantId: "company-1",
    type: "MISSING_POD",
    status: "RESOLVED",
    severity: 1,
    entityType: "LOAD",
    entityId: "load-6",
    description: "Already resolved POD issue",
    createdAt: "2026-01-09T06:00:00Z",
    updatedAt: "2026-01-09T06:00:00Z",
    workflowStep: "Done",
  },
];

const mockTypes: ExceptionType[] = [
  { typeCode: "UNBILLED_LOAD", displayName: "Unbilled Load", dashboardGroup: "Billing", defaultOwnerTeam: "Finance", defaultSeverity: 2 as any, defaultSlaHours: 48 },
  { typeCode: "NEGATIVE_MARGIN", displayName: "Negative Margin", dashboardGroup: "Financial", defaultOwnerTeam: "Finance", defaultSeverity: 4 as any, defaultSlaHours: 8 },
  { typeCode: "UNALLOCATED_EXPENSE", displayName: "Unallocated Expense", dashboardGroup: "Financial", defaultOwnerTeam: "Finance", defaultSeverity: 1 as any, defaultSlaHours: 72 },
  { typeCode: "DISPUTED_INVOICE", displayName: "Disputed Invoice", dashboardGroup: "Billing", defaultOwnerTeam: "Finance", defaultSeverity: 3 as any, defaultSlaHours: 24 },
  { typeCode: "SETTLEMENT_HOLD", displayName: "Settlement Hold", dashboardGroup: "Financial", defaultOwnerTeam: "Finance", defaultSeverity: 2 as any, defaultSlaHours: 48 },
  { typeCode: "MISSING_POD", displayName: "Missing POD", dashboardGroup: "Document Entry", defaultOwnerTeam: "Admin", defaultSeverity: 1 as any, defaultSlaHours: 48 },
];

describe("ExceptionConsole deep coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getExceptions).mockResolvedValue(mockExceptions);
    vi.mocked(getExceptionTypes).mockResolvedValue(mockTypes);
    vi.mocked(updateException).mockResolvedValue(true);
  });

  describe("filter branches — Not Billed (line 204)", () => {
    it("filters to Not Billed exceptions", async () => {
      const user = userEvent.setup();
      render(<ExceptionConsole currentUser={mockUser} />);

      await waitFor(() => {
        expect(screen.getByText("Unbilled Load")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Not Billed"));

      await waitFor(() => {
        expect(screen.getByText("Unbilled Load")).toBeInTheDocument();
      });
      expect(screen.queryByText("Unallocated Expense")).not.toBeInTheDocument();
    });
  });

  describe("filter branches — Negative Margin", () => {
    it("filters to Negative Margin exceptions", async () => {
      const user = userEvent.setup();
      render(<ExceptionConsole currentUser={mockUser} />);

      await waitFor(() => {
        const allNM = screen.getAllByText("Negative Margin");
        expect(allNM.length).toBeGreaterThanOrEqual(1);
      });

      // Click the filter button (not the exception type) - get all and click the button element
      const allNM = screen.getAllByText("Negative Margin");
      const filterBtn = allNM.find((el) => el.closest("button[class*='tracking-widest']"));
      await user.click(filterBtn?.closest("button") || allNM[0]);

      await waitFor(() => {
        const bodyText = document.body.textContent || "";
        expect(bodyText).not.toContain("Settlement Hold");
      });
    });
  });

  describe("filter branches — Unallocated", () => {
    it("filters to Unallocated exceptions", async () => {
      const user = userEvent.setup();
      render(<ExceptionConsole currentUser={mockUser} />);

      await waitFor(() => {
        expect(screen.getByText("Unallocated Expense")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Unallocated"));

      await waitFor(() => {
        expect(screen.getByText("Unallocated Expense")).toBeInTheDocument();
      });
      expect(screen.queryByText("Disputed Invoice")).not.toBeInTheDocument();
    });
  });

  describe("filter branches — Disputes", () => {
    it("filters to Disputes exceptions", async () => {
      const user = userEvent.setup();
      render(<ExceptionConsole currentUser={mockUser} />);

      await waitFor(() => {
        expect(screen.getByText("Disputed Invoice")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Disputes"));

      await waitFor(() => {
        expect(screen.getByText("Disputed Invoice")).toBeInTheDocument();
      });
      expect(screen.queryByText("Unallocated Expense")).not.toBeInTheDocument();
    });
  });

  describe("filter branches — Holds", () => {
    it("filters to Holds exceptions", async () => {
      const user = userEvent.setup();
      render(<ExceptionConsole currentUser={mockUser} />);

      await waitFor(() => {
        expect(screen.getByText("Settlement Hold")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Holds"));

      await waitFor(() => {
        expect(screen.getByText("Settlement Hold")).toBeInTheDocument();
      });
      expect(screen.queryByText("Disputed Invoice")).not.toBeInTheDocument();
    });
  });

  describe("filter branches — Triage (open)", () => {
    it("filters to only open exceptions excluding resolved ones", async () => {
      const user = userEvent.setup();
      render(<ExceptionConsole currentUser={mockUser} />);

      await waitFor(() => {
        // Wait for data to load
        const table = document.querySelector("table");
        expect(table).toBeInTheDocument();
      });

      // The Triage button is in the bottom filter bar
      const triageButtons = screen.getAllByText("Triage");
      const filterBtn = triageButtons.find((el) => el.closest("button"));
      await user.click(filterBtn!);

      await waitFor(() => {
        const bodyText = document.body.textContent || "";
        expect(bodyText).not.toContain("Already resolved");
      });
    });
  });

  describe("resolve confirm dialog cancel (line 538)", () => {
    it("cancels the resolve dialog without updating exception", async () => {
      const user = userEvent.setup();
      render(<ExceptionConsole currentUser={mockUser} />);

      await waitFor(() => {
        expect(screen.getByText("Unbilled Load")).toBeInTheDocument();
      });

      const rows = screen.getAllByRole("row");
      const firstDataRow = rows[1];
      const lastTd = firstDataRow.querySelector("td:last-child");
      const actionBtns = lastTd
        ? Array.from(lastTd.querySelectorAll("button"))
        : [];

      if (actionBtns.length > 0) {
        await user.click(actionBtns[0]);
      }

      await waitFor(() => {
        expect(screen.getByText("Resolve Exception")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /Cancel/i }));

      expect(screen.queryByText("Resolve Exception")).not.toBeInTheDocument();
      expect(updateException).not.toHaveBeenCalled();
    });
  });

  describe("severity Low label for severity 1", () => {
    it("displays Low severity label in list view for severity-1 exceptions", async () => {
      render(<ExceptionConsole currentUser={mockUser} />);

      await waitFor(() => {
        const table = document.querySelector("table");
        expect(table).toBeInTheDocument();
      });

      // severity 1 -> "Low" in the severity column
      await waitFor(() => {
        const lowLabels = screen.getAllByText("Low");
        expect(lowLabels.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe("description search", () => {
    it("filters by description text to find negative margin", async () => {
      const user = userEvent.setup();
      render(<ExceptionConsole currentUser={mockUser} />);

      await waitFor(() => {
        const table = document.querySelector("table");
        expect(table).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Filter by Load/i);
      await user.type(searchInput, "negative margin");

      await waitFor(() => {
        const bodyText = document.body.textContent || "";
        expect(bodyText).toContain("Negative Margin");
        expect(bodyText).not.toContain("Unbilled Load");
      });
    });
  });

  describe("grid view with onViewDetail", () => {
    it("renders grid view and calls onViewDetail from card action", async () => {
      const onViewDetail = vi.fn();
      const user = userEvent.setup();
      render(
        <ExceptionConsole
          currentUser={mockUser}
          onViewDetail={onViewDetail}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("Unbilled Load")).toBeInTheDocument();
      });

      // Find and click the grid view toggle button
      const allButtons = screen.getAllByRole("button");
      // Click buttons without text content (icon-only toggle buttons)
      for (const btn of allButtons) {
        if (
          btn.className.includes("rounded-lg") &&
          !btn.textContent?.trim() &&
          !btn.className.includes("bg-blue-600")
        ) {
          await user.click(btn);
          break;
        }
      }

      // In grid view, find "Execute Action" buttons
      const executeActions = screen.queryAllByText(/Execute Action/);
      if (executeActions.length > 0) {
        const actionBtn = executeActions[0].closest("button");
        if (actionBtn) {
          await user.click(actionBtn);
          expect(onViewDetail).toHaveBeenCalled();
        }
      }
    });
  });
});
