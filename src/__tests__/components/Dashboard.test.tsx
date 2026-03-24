import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Dashboard } from "../../../components/Dashboard";
import { LoadData, User, LOAD_STATUS } from "../../../types";

// Tests R-P3-04
// Dashboard has been consolidated into Operations Center (IntelligenceHub).
// It now renders a simple redirect page with heading, message, and navigation button.

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
    miles: 800,
    pickupDate: "2025-12-01",
    pickup: { city: "Chicago", state: "IL" },
    dropoff: { city: "Dallas", state: "TX" },
  },
];

describe("Dashboard component (redirect page)", () => {
  const defaultProps = {
    user: mockUser,
    loads: mockLoads,
    onViewLoad: vi.fn(),
    onNavigate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Heading ---

  it("renders the Operations Dashboard heading", () => {
    render(<Dashboard {...defaultProps} />);
    expect(screen.getByText("Operations Dashboard")).toBeInTheDocument();
  });

  // --- Consolidation message ---

  it("renders the consolidation message", () => {
    render(<Dashboard {...defaultProps} />);
    expect(
      screen.getByText(
        "The operations dashboard has been consolidated into Operations Center.",
      ),
    ).toBeInTheDocument();
  });

  // --- Navigation button ---

  it("renders the Go to Operations Center button", () => {
    render(<Dashboard {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: /Go to Operations Center/i }),
    ).toBeInTheDocument();
  });

  it("calls onNavigate with 'operations-hub' when button is clicked", async () => {
    const user = userEvent.setup();
    render(<Dashboard {...defaultProps} />);
    await user.click(
      screen.getByRole("button", { name: /Go to Operations Center/i }),
    );
    expect(defaultProps.onNavigate).toHaveBeenCalledWith("operations-hub");
  });

  // --- Minimal rendering sanity checks ---

  it("does not render error alerts (no API calls)", () => {
    render(<Dashboard {...defaultProps} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not render KPI cards (no longer present)", () => {
    render(<Dashboard {...defaultProps} />);
    expect(screen.queryByText("Open Exceptions")).not.toBeInTheDocument();
    expect(screen.queryByText("SLA Breaches")).not.toBeInTheDocument();
    expect(screen.queryByText("Fleet Overview")).not.toBeInTheDocument();
  });

  it("does not render Action Items (no longer present)", () => {
    render(<Dashboard {...defaultProps} />);
    expect(screen.queryByText("Action Items")).not.toBeInTheDocument();
  });

  it("renders correctly with empty loads array", () => {
    render(<Dashboard {...defaultProps} loads={[]} />);
    expect(screen.getByText("Operations Dashboard")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Go to Operations Center/i }),
    ).toBeInTheDocument();
  });

  it("renders correctly regardless of user role", () => {
    const ownerOperator: User = {
      ...mockUser,
      id: "user-2",
      role: "owner_operator",
    };
    render(<Dashboard {...defaultProps} user={ownerOperator} />);
    expect(screen.getByText("Operations Dashboard")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Go to Operations Center/i }),
    ).toBeInTheDocument();
  });
});
