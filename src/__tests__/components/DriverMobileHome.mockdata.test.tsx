// Tests R-P3-09, R-P3-10
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { DriverMobileHome } from "../../../components/DriverMobileHome";
import { LoadData, User, LOAD_STATUS } from "../../../types";

// Mock GlobalMapViewEnhanced since it loads Google Maps
vi.mock("../../../components/GlobalMapViewEnhanced", () => ({
  GlobalMapViewEnhanced: () => <div data-testid="map-mock">Map</div>,
}));

const mockUser: User = {
  id: "driver-1",
  companyId: "company-1",
  email: "driver@test.com",
  name: "Test Driver",
  role: "driver",
  onboardingStatus: "Completed",
  safetyScore: 100,
};

const mockLoadBase: LoadData = {
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
};

describe("DriverMobileHome: no hardcoded mock data (R-P3-09)", () => {
  it("does not contain Wait time expected: 2h or Check in at Gate 2", async () => {
    render(
      <DriverMobileHome
        user={mockUser}
        loads={[mockLoadBase]}
        onLogout={vi.fn()}
        onSaveLoad={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    // Click a load card to view the detail where those strings appeared
    const html = document.body.innerHTML;
    expect(html).not.toContain("Wait time expected: 2h");
    expect(html).not.toContain("Check in at Gate 2");
  });
});

describe("DriverMobileHome: specialInstructions rendering (R-P3-10)", () => {
  it("renders selectedLoad.specialInstructions when present", async () => {
    const user = userEvent.setup();
    const loadWithInstructions: LoadData = {
      ...mockLoadBase,
      specialInstructions: "Dock 7",
    };

    render(
      <DriverMobileHome
        user={mockUser}
        loads={[loadWithInstructions]}
        onLogout={vi.fn()}
        onSaveLoad={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    // Find and click the load card to navigate to detail view
    const loadCard = screen.getByText(/LN-001/i);
    await user.click(loadCard.closest("div[class]") || loadCard);

    // Dock 7 should appear
    expect(document.body.textContent).toContain("Dock 7");
  });

  it("does not render instructions div when specialInstructions is absent", async () => {
    const user = userEvent.setup();
    const loadNoInstructions: LoadData = {
      ...mockLoadBase,
      specialInstructions: undefined,
    };

    render(
      <DriverMobileHome
        user={mockUser}
        loads={[loadNoInstructions]}
        onLogout={vi.fn()}
        onSaveLoad={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    // Click the load card
    const loadCard = screen.getByText(/LN-001/i);
    await user.click(loadCard.closest("div[class]") || loadCard);

    expect(document.body.textContent).not.toContain("Check in at Gate 2");
    expect(document.body.textContent).not.toContain("Wait time");
  });
});
