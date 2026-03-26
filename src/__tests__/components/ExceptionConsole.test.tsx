import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
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
    financialImpactEst: 2500,
  },
  {
    id: "exc-3",
    tenantId: "company-1",
    type: "MISSING_POD",
    status: "OPEN",
    severity: 2,
    entityType: "DRIVER",
    entityId: "driver-1",
    description: "Missing BOL documents",
    createdAt: "2026-01-13T14:00:00Z",
    updatedAt: "2026-01-13T16:00:00Z",
  },
];

const mockTypes: ExceptionType[] = [
  {
    typeCode: "LATE_DELIVERY",
    displayName: "Late Delivery",
    dashboardGroup: "Delay Entry",
    defaultOwnerTeam: "Dispatch",
    defaultSeverity: 3 as any,
    defaultSlaHours: 24,
  },
  {
    typeCode: "DAMAGED_FREIGHT",
    displayName: "Damaged Freight",
    dashboardGroup: "Maintenance Entry",
    defaultOwnerTeam: "Safety",
    defaultSeverity: 4 as any,
    defaultSlaHours: 8,
  },
  {
    typeCode: "MISSING_POD",
    displayName: "Missing POD",
    dashboardGroup: "Document Entry",
    defaultOwnerTeam: "Admin",
    defaultSeverity: 2 as any,
    defaultSlaHours: 48,
  },
];

describe("ExceptionConsole component", () => {
  const defaultProps = {
    currentUser: mockUser,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getExceptions).mockResolvedValue(mockExceptions);
    vi.mocked(getExceptionTypes).mockResolvedValue(mockTypes);
    vi.mocked(updateException).mockResolvedValue(true);
  });

  it("renders the Issues & Alerts heading", async () => {
    render(<ExceptionConsole {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Issues & Alerts")).toBeInTheDocument();
    });
  });

  it("loads and displays exception type display names", async () => {
    render(<ExceptionConsole {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Late Delivery")).toBeInTheDocument();
      expect(screen.getByText("Damaged Freight")).toBeInTheDocument();
      expect(screen.getByText("Missing POD")).toBeInTheDocument();
    });
  });

  it("displays severity labels (Critical, High, Medium)", async () => {
    render(<ExceptionConsole {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Critical")).toBeInTheDocument();
      expect(screen.getByText("High")).toBeInTheDocument();
      expect(screen.getByText("Medium")).toBeInTheDocument();
    });
  });

  it("shows loading state initially before data resolves", () => {
    // Don't resolve the mocks yet
    vi.mocked(getExceptions).mockReturnValue(new Promise(() => {}));
    vi.mocked(getExceptionTypes).mockReturnValue(new Promise(() => {}));
    render(<ExceptionConsole {...defaultProps} />);
    expect(screen.getByText("Synching Issues...")).toBeInTheDocument();
  });

  it("shows empty state when there are no exceptions", async () => {
    vi.mocked(getExceptions).mockResolvedValue([]);
    vi.mocked(getExceptionTypes).mockResolvedValue([]);
    render(<ExceptionConsole {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("No Active Issues")).toBeInTheDocument();
    });
  });

  it("filters exceptions using the search input", async () => {
    const user = userEvent.setup();
    render(<ExceptionConsole {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Late Delivery")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Filter by ID/i);
    await user.type(searchInput, "load-1");
    // Only exception with entityId "load-1" should remain
    expect(screen.getByText("Late Delivery")).toBeInTheDocument();
    expect(screen.queryByText("Damaged Freight")).not.toBeInTheDocument();
  });

  it("filters by the Documents category button", async () => {
    const user = userEvent.setup();
    render(<ExceptionConsole {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Late Delivery")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Documents"));
    // MISSING_POD should match the "documents" filter
    await waitFor(() => {
      expect(screen.getByText("Missing POD")).toBeInTheDocument();
    });
    // Others should be hidden
    expect(screen.queryByText("Late Delivery")).not.toBeInTheDocument();
  });

  it("shows the All Issues filter by default and resets when clicked", async () => {
    const user = userEvent.setup();
    render(<ExceptionConsole {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Late Delivery")).toBeInTheDocument();
    });

    // Click a category filter first
    await user.click(screen.getByText("Documents"));
    // Click All Issues to reset
    await user.click(screen.getByText("All Issues"));
    await waitFor(() => {
      expect(screen.getByText("Late Delivery")).toBeInTheDocument();
      expect(screen.getByText("Damaged Freight")).toBeInTheDocument();
    });
  });

  it("toggles between list and grid view modes", async () => {
    const user = userEvent.setup();
    render(<ExceptionConsole {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Late Delivery")).toBeInTheDocument();
    });

    // Should start in list mode (table visible)
    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();

    // Find all icon-only toggle buttons (no text content) to locate the grid button
    const allButtons = screen.getAllByRole("button");
    const iconOnlyBtns = allButtons.filter(
      (b) => !b.textContent?.trim() && b.className.includes("rounded-lg"),
    );
    // Click the grid view button (second icon-only toggle button)
    expect(iconOnlyBtns.length).toBeGreaterThanOrEqual(2);
    await user.click(iconOnlyBtns[1]);
    // Table should no longer be present in grid mode
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("resolves an exception through the confirm dialog", async () => {
    const user = userEvent.setup();
    render(<ExceptionConsole {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Late Delivery")).toBeInTheDocument();
    });

    // Find the resolve buttons in the actions column (last td of each row)
    // Each data row has buttons: entity link button, resolve button, and more button
    const rows = screen.getAllByRole("row");
    // First data row (index 1, index 0 is header)
    const firstDataRow = rows[1];
    const allBtns = within(firstDataRow).getAllByRole("button");
    // The resolve button is typically the second-to-last in the row
    // It's in a div with flex items-center justify-end gap-2
    // Find buttons in the last td (actions column)
    const lastTd = firstDataRow.querySelector("td:last-child");
    const actionBtns = lastTd
      ? Array.from(lastTd.querySelectorAll("button"))
      : [];
    // First action button is the resolve button (CheckCircle2)
    expect(actionBtns.length).toBeGreaterThan(0);
    await user.click(actionBtns[0]);

    // Confirm dialog should appear
    await waitFor(() => {
      expect(screen.getByText("Resolve Issue")).toBeInTheDocument();
    });
    expect(
      screen.getByText("Mark this issue as resolved?"),
    ).toBeInTheDocument();

    // Click the confirm button in the dialog (labeled "Resolve")
    // Use the ConfirmDialog's confirm button which is inside the dialog panel
    const dialog = screen.getByRole("dialog");
    const resolveDialogBtn = within(dialog)
      .getAllByRole("button")
      .find((btn) => btn.textContent === "Resolve")!;
    await user.click(resolveDialogBtn);
    expect(updateException).toHaveBeenCalledWith("exc-1", {
      status: "RESOLVED",
      actorName: "Admin User",
    });
  });

  it("calls onViewDetail when clicking an entity link", async () => {
    const user = userEvent.setup();
    const onViewDetail = vi.fn();
    render(<ExceptionConsole {...defaultProps} onViewDetail={onViewDetail} />);
    await waitFor(() => {
      expect(screen.getByText("Late Delivery")).toBeInTheDocument();
    });

    // Click the entity link in the first row
    const entityLink = screen.getByText("LOAD #load-1");
    await user.click(entityLink);
    expect(onViewDetail).toHaveBeenCalledWith("LOAD", "load-1");
  });

  it("calls loadData on Refresh button click", async () => {
    const user = userEvent.setup();
    render(<ExceptionConsole {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Late Delivery")).toBeInTheDocument();
    });

    vi.mocked(getExceptions).mockClear();
    await user.click(screen.getByText("Refresh"));
    expect(getExceptions).toHaveBeenCalled();
  });

  it("displays financial impact amounts", async () => {
    render(<ExceptionConsole {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("$500")).toBeInTheDocument();
      expect(screen.getByText("$2,500")).toBeInTheDocument();
    });
  });

  it("shows bottom summary bar with severity counts", async () => {
    render(<ExceptionConsole {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("1 Critical")).toBeInTheDocument();
      expect(screen.getByText("1 High Priority")).toBeInTheDocument();
    });
  });

  it("respects initialView prop for filter state", async () => {
    render(<ExceptionConsole {...defaultProps} initialView="documents" />);
    await waitFor(() => {
      // The documents filter should be active, showing only document-related exceptions
      expect(screen.getByText("Missing POD")).toBeInTheDocument();
      expect(screen.queryByText("Late Delivery")).not.toBeInTheDocument();
    });
  });

  it("renders the Issues & Alerts heading", async () => {
    render(<ExceptionConsole {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Issues & Alerts")).toBeInTheDocument();
    });
  });

  it("shows loading state initially before data resolves", () => {
    vi.mocked(getExceptions).mockReturnValue(new Promise(() => {}));
    vi.mocked(getExceptionTypes).mockReturnValue(new Promise(() => {}));
    render(<ExceptionConsole {...defaultProps} />);
    expect(screen.getByText("Synching Issues...")).toBeInTheDocument();
  });

  it("shows No Active Issues when exceptions list is empty (line 220)", async () => {
    vi.mocked(getExceptions).mockResolvedValue([]);
    vi.mocked(getExceptionTypes).mockResolvedValue([]);
    render(<ExceptionConsole {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("No Active Issues")).toBeInTheDocument();
    });
  });

  it("filters exceptions using the search input (line 233)", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    render(<ExceptionConsole {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Late Delivery")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Filter by ID/i);
    await user.type(searchInput, "load-1");
    expect(screen.getByText("Late Delivery")).toBeInTheDocument();
    expect(screen.queryByText("Damaged Freight")).not.toBeInTheDocument();
  });

  it("renders category filter tabs (line 538)", async () => {
    render(<ExceptionConsole {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Late Delivery")).toBeInTheDocument();
    });
    expect(screen.getByText("All Issues")).toBeInTheDocument();
    expect(screen.getByText("Safety")).toBeInTheDocument();
    expect(screen.getByText("Maintenance")).toBeInTheDocument();
    expect(screen.getByText("Compliance")).toBeInTheDocument();
    expect(screen.getByText("Billing")).toBeInTheDocument();
    expect(screen.getByText("Documents")).toBeInTheDocument();
  });

  it("calls loadData on Refresh button click", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    render(<ExceptionConsole {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Late Delivery")).toBeInTheDocument();
    });
    vi.mocked(getExceptions).mockClear();
    await user.click(screen.getByText("Refresh"));
    expect(getExceptions).toHaveBeenCalled();
  });

  it("shows bottom summary bar with severity counts", async () => {
    render(<ExceptionConsole {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("1 Critical")).toBeInTheDocument();
      expect(screen.getByText("1 High Priority")).toBeInTheDocument();
    });
  });

  it("shows Billing category tab", async () => {
    render(<ExceptionConsole {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Billing")).toBeInTheDocument();
    });
  });

  it("shows Average Resolution metric in footer", async () => {
    render(<ExceptionConsole {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Average Resolution/)).toBeInTheDocument();
    });
  });

  it("renders entity link with type and ID", async () => {
    render(<ExceptionConsole {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("LOAD #load-1")).toBeInTheDocument();
      expect(screen.getByText("LOAD #load-2")).toBeInTheDocument();
    });
  });

  it("calls onViewDetail when entity link is clicked", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    const onViewDetail = vi.fn();
    render(<ExceptionConsole {...defaultProps} onViewDetail={onViewDetail} />);
    await waitFor(() => {
      expect(screen.getByText("LOAD #load-1")).toBeInTheDocument();
    });
    await user.click(screen.getByText("LOAD #load-1"));
    expect(onViewDetail).toHaveBeenCalledWith("LOAD", "load-1");
  });
});
