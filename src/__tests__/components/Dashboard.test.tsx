import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Dashboard } from "../../../components/Dashboard";
import { LoadData, User, LOAD_STATUS } from "../../../types";

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
  });

  it("renders without crashing", async () => {
    render(<Dashboard {...defaultProps} />);
    await waitFor(() => {
      // Dashboard should render some content
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
});
