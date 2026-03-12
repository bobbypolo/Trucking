import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Dashboard } from "../../../components/Dashboard";
import { LoadData, User, LOAD_STATUS } from "../../../types";
import * as exceptionService from "../../../services/exceptionService";

// Tests R-P3-04
// Mock services that make network calls
vi.mock("../../../services/exceptionService", () => ({
  getExceptions: vi.fn().mockResolvedValue([]),
  getDashboardCards: vi.fn().mockResolvedValue([]),
}));

const mockUser: User = {
  id: "user-1",
  companyId: "company-1",
  email: "admin@test.com",
  name: "Test Admin",
  role: "admin",
  onboardingStatus: "Completed",
  safetyScore: 100,
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
    pickupDate: "2025-12-01",
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
    pickupDate: "2025-12-02",
    pickup: { city: "Atlanta", state: "GA" },
    dropoff: { city: "Miami", state: "FL" },
  },
];

describe("Dashboard component", () => {
  const defaultProps = {
    user: mockUser,
    loads: mockLoads,
    onViewLoad: vi.fn(),
    onNavigate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to success defaults
    vi.mocked(exceptionService.getExceptions).mockResolvedValue([]);
    vi.mocked(exceptionService.getDashboardCards).mockResolvedValue([]);
  });

  it("renders without crashing", async () => {
    render(<Dashboard {...defaultProps} />);
    await waitFor(() => {
      expect(document.body).toBeTruthy();
    });
  });

  it("renders with empty loads array", async () => {
    render(<Dashboard {...defaultProps} loads={[]} />);
    await waitFor(() => {
      expect(document.body).toBeTruthy();
    });
  });

  it("accepts user prop with admin role", () => {
    const { unmount } = render(<Dashboard {...defaultProps} />);
    unmount();
  });

  it("accepts optional brokers prop", async () => {
    render(<Dashboard {...defaultProps} brokers={[]} />);
    await waitFor(() => {
      expect(document.body).toBeTruthy();
    });
  });

  it("accepts optional users prop", async () => {
    render(<Dashboard {...defaultProps} users={[mockUser]} />);
    await waitFor(() => {
      expect(document.body).toBeTruthy();
    });
  });

  it("shows error banner when API call fails", async () => {
    vi.mocked(exceptionService.getExceptions).mockRejectedValue(
      new Error("Network error"),
    );
    vi.mocked(exceptionService.getDashboardCards).mockRejectedValue(
      new Error("Network error"),
    );

    render(<Dashboard {...defaultProps} />);

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toBeTruthy();
    });

    // The error message should say Unable to load
    const alertEl = screen.getByRole("alert");
    expect(alertEl.textContent).toContain("Unable to load");
  });

  it("shows retry button in error banner", async () => {
    vi.mocked(exceptionService.getExceptions).mockRejectedValue(
      new Error("Network error"),
    );
    vi.mocked(exceptionService.getDashboardCards).mockRejectedValue(
      new Error("Network error"),
    );

    render(<Dashboard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });

    // Should have a retry button
    const retryBtn = screen.getByRole("button", { name: /retry/i });
    expect(retryBtn).toBeTruthy();
  });

  it("clears error and reloads when retry button is clicked", async () => {
    vi.mocked(exceptionService.getExceptions).mockRejectedValue(
      new Error("Network error"),
    );
    vi.mocked(exceptionService.getDashboardCards).mockRejectedValue(
      new Error("Network error"),
    );

    render(<Dashboard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });

    // Now mock success for the retry
    vi.mocked(exceptionService.getExceptions).mockResolvedValue([]);
    vi.mocked(exceptionService.getDashboardCards).mockResolvedValue([]);

    const retryBtn = screen.getByRole("button", { name: /retry/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  it("does not show error banner when API succeeds", async () => {
    vi.mocked(exceptionService.getExceptions).mockResolvedValue([]);
    vi.mocked(exceptionService.getDashboardCards).mockResolvedValue([]);

    render(<Dashboard {...defaultProps} />);

    await waitFor(() => {
      // loading should finish
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });
});
