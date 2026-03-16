// Tests R-P3-05
import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Dashboard } from "../../../components/Dashboard";
import { LoadData, User, LOAD_STATUS } from "../../../types";
import * as exceptionService from "../../../services/exceptionService";

vi.mock("../../../services/exceptionService", () => ({
  getExceptions: vi.fn().mockResolvedValue([]),
  getDashboardCards: vi.fn().mockResolvedValue([]),
}));

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
    companyId: "company-1",
    driverId: "driver-1",
    loadNumber: "LN-001",
    status: LOAD_STATUS.In_Transit,
    carrierRate: 2000,
    driverPay: 1200,
    pickupDate: "2025-12-01",
    pickup: { city: "Chicago", state: "IL" },
    dropoff: { city: "Dallas", state: "TX" },
    miles: 800,
  },
];

describe("Dashboard: no hardcoded mock data (R-P3-05)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(exceptionService.getExceptions).mockResolvedValue([]);
    vi.mocked(exceptionService.getDashboardCards).mockResolvedValue([]);
  });

  it("does not contain $2.45, 72% Done, 14 missing receipts, 412 mi, Insurance Expiry, 12 days, Broker Logistics Group, 94%, SLA: 14m", () => {
    const { container } = render(
      <Dashboard
        user={mockUser}
        loads={mockLoads}
        onViewLoad={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    const html = container.innerHTML;
    expect(html).not.toContain("$2.45");
    expect(html).not.toContain("72% Done");
    expect(html).not.toContain("14 missing receipts");
    expect(html).not.toContain("412 mi");
    expect(html).not.toContain("Insurance Expiry");
    expect(html).not.toContain("Expires in 12 days");
    expect(html).not.toContain("Broker Logistics Group");
    expect(html).not.toContain(">94%<");
    expect(html).not.toContain("SLA: 14m");
  });
});
