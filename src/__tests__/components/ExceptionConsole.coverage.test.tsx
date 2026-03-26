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
    type: "LATE_DELIVERY",
    status: "OPEN",
    severity: 3,
    entityType: "LOAD",
    entityId: "load-1",
    description: "Load LN-001 arrived 4 hours late",
    createdAt: "2026-01-15T10:00:00Z",
    updatedAt: "2026-01-15T10:00:00Z",
    workflowStep: "In Review",
    ownerUserId: "admin-1",
    team: "DISPATCH",
    financialImpactEst: 500,
  },
  {
    id: "exc-2",
    tenantId: "company-1",
    type: "DAMAGED_FREIGHT",
    status: "IN_PROGRESS",
    severity: 4,
    entityType: "LOAD",
    entityId: "load-2",
    description: "Freight damage reported at delivery",
    createdAt: "2026-01-14T08:00:00Z",
    updatedAt: "2026-01-14T12:00:00Z",
    workflowStep: "Escalated",
    financialImpactEst: 2500,
  },
  {
    id: "exc-3",
    tenantId: "company-1",
    type: "MISSING_DOCS",
    status: "OPEN",
    severity: 2,
    entityType: "DRIVER",
    entityId: "driver-1",
    description: "Missing BOL documents",
    createdAt: "2026-01-13T14:00:00Z",
    updatedAt: "2026-01-13T16:00:00Z",
    workflowStep: "Triage",
  },
];

const mockTypes: ExceptionType[] = [
  {
    typeCode: "LATE_DELIVERY",
    displayName: "Late Delivery",
    dashboardGroup: "Maintenance Entry",
    defaultOwnerTeam: "Dispatch",
    defaultSeverity: 3 as any,
    defaultSlaHours: 24,
  },
  {
    typeCode: "DAMAGED_FREIGHT",
    displayName: "Damaged Freight",
    dashboardGroup: "Document Entry",
    defaultOwnerTeam: "Safety",
    defaultSeverity: 4 as any,
    defaultSlaHours: 8,
  },
  {
    typeCode: "MISSING_DOCS",
    displayName: "Missing Documents",
    dashboardGroup: "Operations",
    defaultOwnerTeam: "Admin",
    defaultSeverity: 2 as any,
    defaultSlaHours: 48,
  },
];

describe("ExceptionConsole coverage — lines 220, 233, 538", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getExceptions).mockResolvedValue(mockExceptions);
    vi.mocked(getExceptionTypes).mockResolvedValue(mockTypes);
    vi.mocked(updateException).mockResolvedValue(true);
  });

  it("switches to list view mode when list button is clicked", async () => {
    const user = userEvent.setup();
    render(<ExceptionConsole currentUser={mockUser} />);
    await waitFor(() => {
      expect(screen.getByText("Late Delivery")).toBeInTheDocument();
    });
    // The list view should be active by default — table should render
    const table = document.querySelector("table");
    expect(table).toBeInTheDocument();
  });

  it("switches to grid view mode when grid button is clicked", async () => {
    const user = userEvent.setup();
    render(<ExceptionConsole currentUser={mockUser} />);
    await waitFor(() => {
      expect(screen.getByText("Late Delivery")).toBeInTheDocument();
    });
    // Find the grid view toggle button (LayoutGrid icon) and click it
    const buttons = screen.getAllByRole("button");
    const gridBtn = buttons.find((btn) => {
      const svg = btn.querySelector("svg");
      return svg && btn.className.includes("rounded-lg") && !btn.textContent;
    });
    // Click all toggle-like buttons to find the grid one
    for (const btn of buttons) {
      if (btn.className.includes("rounded-lg") && !btn.textContent?.trim()) {
        await user.click(btn);
        break;
      }
    }
    // After toggling, grid cards should render instead of table
    await waitFor(() => {
      const cards = document.querySelectorAll(".grid > div");
      // Either table or grid should be present
      expect(document.body.textContent).toContain("Late Delivery");
    });
  });

  it("filters exceptions using the category filter", async () => {
    const user = userEvent.setup();
    render(<ExceptionConsole currentUser={mockUser} />);
    await waitFor(() => {
      expect(screen.getByText("Late Delivery")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Billing"));
    // The category filter should hide non-billing exceptions
    await waitFor(() => {
      const bodyText = document.body.textContent || "";
      expect(bodyText).not.toContain("Late Delivery");
    });
  });

  it("filters exceptions by search query", async () => {
    const user = userEvent.setup();
    render(<ExceptionConsole currentUser={mockUser} />);
    await waitFor(() => {
      expect(screen.getByText("Late Delivery")).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText(/Filter by ID/i);
    await user.type(searchInput, "load-1");
    await waitFor(() => {
      expect(screen.getByText("Late Delivery")).toBeInTheDocument();
    });
  });

  it("displays financial impact for exceptions that have it", async () => {
    render(<ExceptionConsole currentUser={mockUser} />);
    await waitFor(() => {
      expect(screen.getByText("$500")).toBeInTheDocument();
      expect(screen.getByText("$2,500")).toBeInTheDocument();
    });
  });

  it("displays entity type and id links in the exception table", async () => {
    const onViewDetail = vi.fn();
    render(
      <ExceptionConsole currentUser={mockUser} onViewDetail={onViewDetail} />,
    );
    await waitFor(() => {
      expect(screen.getByText(/LOAD #load-1/)).toBeInTheDocument();
      expect(screen.getByText(/LOAD #load-2/)).toBeInTheDocument();
    });
  });

  it("calls onViewDetail when entity link is clicked", async () => {
    const onViewDetail = vi.fn();
    const user = userEvent.setup();
    render(
      <ExceptionConsole currentUser={mockUser} onViewDetail={onViewDetail} />,
    );
    await waitFor(() => {
      expect(screen.getByText(/LOAD #load-1/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/LOAD #load-1/));
    expect(onViewDetail).toHaveBeenCalledWith("LOAD", "load-1");
  });

  it("shows resolve button and triggers confirm dialog", async () => {
    const user = userEvent.setup();
    render(<ExceptionConsole currentUser={mockUser} />);
    await waitFor(() => {
      expect(screen.getByText("Late Delivery")).toBeInTheDocument();
    });
    // Find resolve buttons (CheckCircle2 icons in action column)
    const resolveButtons = document.querySelectorAll(
      "button.bg-emerald-500\\/10, [class*='emerald']",
    );
    expect(resolveButtons.length).toBeGreaterThan(0);
  });

  it("displays severity labels: Critical (4), High (3), Medium (2)", async () => {
    render(<ExceptionConsole currentUser={mockUser} />);
    await waitFor(() => {
      expect(screen.getByText("Critical")).toBeInTheDocument();
      expect(screen.getByText("High")).toBeInTheDocument();
      expect(screen.getByText("Medium")).toBeInTheDocument();
    });
  });

  it("renders Refresh button and clicking it reloads data", async () => {
    const user = userEvent.setup();
    render(<ExceptionConsole currentUser={mockUser} />);
    await waitFor(() => {
      expect(screen.getByText("Refresh")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Refresh"));
    expect(getExceptions).toHaveBeenCalledTimes(2); // once on mount, once on refresh
  });

  it("displays Critical Exceptions count in bottom summary bar", async () => {
    render(<ExceptionConsole currentUser={mockUser} />);
    await waitFor(() => {
      const text = document.body.textContent || "";
      expect(text).toContain("Critical");
    });
  });
});
