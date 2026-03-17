import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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
  },
  {
    id: "exc-3",
    tenantId: "company-1",
    type: "MISSING_DOCS",
    status: "RESOLVED",
    severity: 1,
    entityType: "DRIVER",
    entityId: "driver-1",
    description: "Missing BOL documents",
    createdAt: "2026-01-13T14:00:00Z",
    updatedAt: "2026-01-13T16:00:00Z",
    resolvedAt: "2026-01-13T16:00:00Z",
  },
];

const mockTypes: ExceptionType[] = [
  {
    typeCode: "LATE_DELIVERY",
    displayName: "Late Delivery",
    dashboardGroup: "Operations",
    defaultOwnerTeam: "Dispatch",
    defaultSeverity: 3 as any,
    defaultSlaHours: 24,
  },
  {
    typeCode: "DAMAGED_FREIGHT",
    displayName: "Damaged Freight",
    dashboardGroup: "Claims",
    defaultOwnerTeam: "Safety",
    defaultSeverity: 4 as any,
    defaultSlaHours: 8,
  },
  {
    typeCode: "MISSING_DOCS",
    displayName: "Missing Documents",
    dashboardGroup: "Compliance",
    defaultOwnerTeam: "Admin",
    defaultSeverity: 1 as any,
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

  it("renders without crashing", async () => {
    const { container } = render(<ExceptionConsole {...defaultProps} />);
    await waitFor(() => expect(container).toBeTruthy());
  });

  it("calls getExceptions on mount", async () => {
    render(<ExceptionConsole {...defaultProps} />);
    await waitFor(() => {
      expect(getExceptions).toHaveBeenCalled();
    });
  });

  it("calls getExceptionTypes on mount", async () => {
    render(<ExceptionConsole {...defaultProps} />);
    await waitFor(() => {
      expect(getExceptionTypes).toHaveBeenCalled();
    });
  });

  it("displays exception type names after load", async () => {
    render(<ExceptionConsole {...defaultProps} />);
    await waitFor(() => {
      // Exception types are shown by displayName from types map
      expect(screen.getByText("Late Delivery")).toBeTruthy();
      expect(screen.getByText("Damaged Freight")).toBeTruthy();
    });
  });

  it("displays exception severity labels", async () => {
    render(<ExceptionConsole {...defaultProps} />);
    await waitFor(() => {
      // severity 3 = "High", severity 4 = "Critical"
      expect(screen.getByText("High")).toBeTruthy();
      expect(screen.getByText("Critical")).toBeTruthy();
    });
  });

  it("renders with initialView prop", async () => {
    const { container } = render(
      <ExceptionConsole {...defaultProps} initialView="OPEN" />,
    );
    await waitFor(() => expect(container).toBeTruthy());
  });

  it("renders with onViewDetail prop", async () => {
    const onViewDetail = vi.fn();
    const { container } = render(
      <ExceptionConsole {...defaultProps} onViewDetail={onViewDetail} />,
    );
    await waitFor(() => expect(container).toBeTruthy());
  });

  it("handles empty exceptions list", async () => {
    vi.mocked(getExceptions).mockResolvedValue([]);
    vi.mocked(getExceptionTypes).mockResolvedValue([]);
    const { container } = render(<ExceptionConsole {...defaultProps} />);
    await waitFor(() => {
      expect(container).toBeTruthy();
    });
  });

  it("renders with non-admin user role", async () => {
    const dispatcherUser = { ...mockUser, role: "dispatcher" as const };
    const { container } = render(
      <ExceptionConsole {...defaultProps} currentUser={dispatcherUser} />,
    );
    await waitFor(() => expect(container).toBeTruthy());
  });
});
