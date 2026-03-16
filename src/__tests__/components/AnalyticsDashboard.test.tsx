// Tests R-P3-02, R-P3-03, R-P3-04
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { AnalyticsDashboard } from "../../../components/AnalyticsDashboard";
import { LoadData, User, LOAD_STATUS } from "../../../types";

const mockUser: User = {
  id: "user-1",
  companyId: "company-1",
  email: "admin@test.com",
  name: "Test Admin",
  role: "admin",
  onboardingStatus: "Completed",
  safetyScore: 100,
};

function makeLoad(
  id: string,
  carrierRate: number,
  miles: number,
  driverPay = 0,
): LoadData {
  return {
    id,
    companyId: "company-1",
    driverId: "driver-1",
    loadNumber: `LN-${id}`,
    status: LOAD_STATUS.Delivered,
    carrierRate,
    driverPay,
    miles,
    pickupDate: "2025-01-01",
    pickup: { city: "Chicago", state: "IL" },
    dropoff: { city: "Dallas", state: "TX" },
  };
}

describe("AnalyticsDashboard: no hardcoded mock data (R-P3-02)", () => {
  it("does not contain Global Logistics, FastTrack Freight, Blue Sky Carriers, Midwest Brokerage, Chicago IL -> Detroit MI, 4.2% increase in Midwest reefer demand", () => {
    const { container } = render(
      <AnalyticsDashboard
        user={mockUser}
        loads={[makeLoad("1", 1500, 600)]}
        brokers={[]}
      />,
    );
    const html = container.innerHTML;
    expect(html).not.toContain("Global Logistics");
    expect(html).not.toContain("FastTrack Freight");
    expect(html).not.toContain("Blue Sky Carriers");
    expect(html).not.toContain("Midwest Brokerage");
    expect(html).not.toContain("Chicago, IL -> Detroit, MI");
    expect(html).not.toContain("4.2% increase in Midwest reefer demand");
  });
});

describe("AnalyticsDashboard: EmptyState for empty loads (R-P3-03)", () => {
  it("renders EmptyState with completed loads message when given empty loads array", () => {
    render(<AnalyticsDashboard user={mockUser} loads={[]} brokers={[]} />);
    // Should contain message about completed loads
    const text = document.body.textContent || "";
    expect(text.toLowerCase()).toContain("completed loads");
  });
});

describe("AnalyticsDashboard: RPM calculation from real data (R-P3-04)", () => {
  it("calculates RPM as carrierRate/totalMiles from real load data", () => {
    // 10 loads, each with carrierRate=2000 and miles=500 => RPM = 2000/500 = $4.00
    const loads = Array.from({ length: 10 }, (_, i) =>
      makeLoad(`load-${i}`, 2000, 500),
    );

    render(<AnalyticsDashboard user={mockUser} loads={loads} brokers={[]} />);

    // RPM = total revenue / total miles = (10*2000)/(10*500) = 20000/5000 = 4.00
    expect(screen.getByText("$4.00")).toBeTruthy();
  });

  it("calculates RPM correctly with known values (carrierRate=3000, miles=1000 per load)", () => {
    const loads = Array.from({ length: 10 }, (_, i) =>
      makeLoad(`load-${i}`, 3000, 1000),
    );

    render(<AnalyticsDashboard user={mockUser} loads={loads} brokers={[]} />);

    // RPM = 3000/1000 = $3.00
    expect(screen.getByText("$3.00")).toBeTruthy();
  });
});
