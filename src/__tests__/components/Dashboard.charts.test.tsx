import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Dashboard } from "../../../components/Dashboard";
import { LoadData, User, LOAD_STATUS } from "../../../types";

// Tests R-P6-01, R-P6-02, R-P6-03
// Dashboard has been consolidated into Operations Center (IntelligenceHub).
// Charts are no longer rendered in Dashboard — it is now a redirect page.

const mockUser: User = {
  id: "user-1",
  companyId: "company-1",
  email: "admin@test.com",
  name: "Test Admin",
  role: "owner_operator",
  onboardingStatus: "Completed",
  safetyScore: 100,
};

const mockLoads: LoadData[] = [
  {
    id: "load-1",
    companyId: "c1",
    driverId: "d1",
    loadNumber: "LN-001",
    status: LOAD_STATUS.Delivered,
    carrierRate: 2000,
    driverPay: 1200,
    miles: 800,
    pickupDate: "2026-03-20",
    pickup: { city: "Chicago", state: "IL" },
    dropoff: { city: "Dallas", state: "TX" },
  },
];

const defaultProps = {
  user: mockUser,
  loads: mockLoads,
  onViewLoad: vi.fn(),
  onNavigate: vi.fn(),
};

describe("Dashboard Charts — R-P6-01, R-P6-02, R-P6-03 (post-consolidation)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // R-P6-01: Charts no longer rendered in Dashboard (moved to IntelligenceHub)
  it("does not render any recharts components (charts moved to Operations Center)", () => {
    render(<Dashboard {...defaultProps} />);
    expect(screen.queryByTestId("bar-chart")).toBeNull();
    expect(screen.queryByTestId("line-chart")).toBeNull();
  });

  it("does not render RPM by Day chart section", () => {
    render(<Dashboard {...defaultProps} />);
    expect(screen.queryByText(/RPM by Day/i)).not.toBeInTheDocument();
  });

  it("does not render Exception Trend chart section", () => {
    render(<Dashboard {...defaultProps} />);
    expect(screen.queryByText(/Exception.*Trend/i)).not.toBeInTheDocument();
  });

  it("does not render Revenue vs Cost chart section", () => {
    render(<Dashboard {...defaultProps} />);
    expect(screen.queryByText(/Revenue.*Cost/i)).not.toBeInTheDocument();
  });

  // R-P6-02: No chart data computation in Dashboard
  it("does not compute or display chart data (consolidated to Operations Center)", () => {
    render(<Dashboard {...defaultProps} />);
    // Only the redirect content should be present
    expect(screen.getByText("Operations Dashboard")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The operations dashboard has been consolidated into Operations Center.",
      ),
    ).toBeInTheDocument();
  });

  // R-P6-03: No empty state messages for charts
  it("does not show 'No data for this period' message (no charts to show empty state for)", () => {
    render(<Dashboard {...defaultProps} loads={[]} />);
    expect(
      screen.queryByText(/No data for this period/i),
    ).not.toBeInTheDocument();
  });

  it("renders redirect button regardless of loads data", () => {
    render(<Dashboard {...defaultProps} loads={[]} />);
    expect(
      screen.getByRole("button", { name: /Go to Operations Center/i }),
    ).toBeInTheDocument();
  });

  it("navigates to operations-hub when button is clicked", async () => {
    const user = userEvent.setup();
    render(<Dashboard {...defaultProps} />);
    await user.click(
      screen.getByRole("button", { name: /Go to Operations Center/i }),
    );
    expect(defaultProps.onNavigate).toHaveBeenCalledWith("operations-hub");
  });
});
