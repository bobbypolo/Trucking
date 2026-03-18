// Tests R-P4-07, R-P4-08
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { DriverMobileHome } from "../../../components/DriverMobileHome";
import type { LoadData, User, Company } from "../../../types";

// Mock Scanner
vi.mock("../../../components/Scanner", () => ({
  Scanner: () => <div data-testid="scanner-mock" />,
}));

// Mock GlobalMapViewEnhanced
vi.mock("../../../components/GlobalMapViewEnhanced", () => ({
  GlobalMapViewEnhanced: () => <div data-testid="map-mock" />,
}));

const mockUser: User = {
  id: "driver-1",
  name: "Test Driver",
  email: "driver@test.com",
  role: "driver",
  companyId: "company-1",
  onboardingStatus: "Completed",
  safetyScore: 100,
};

const mockLoad: LoadData = {
  id: "load-1",
  loadNumber: "LD-001",
  companyId: "company-1",
  driverId: "driver-1",
  status: "planned",
  carrierRate: 2500,
  driverPay: 1500,
  pickup: { city: "Dallas", state: "TX" },
  dropoff: { city: "Houston", state: "TX" },
  pickupDate: "2024-06-01",
};

// Use type assertion for partial Company fixture
const companyWithPhone = {
  id: "company-1",
  name: "Test Trucking",
  phone: "555-123-4567",
} as unknown as Company;

const companyNoPhone = {
  id: "company-1",
  name: "Test Trucking",
} as unknown as Company;

describe("DriverMobileHome messaging (R-P4-07, R-P4-08)", () => {
  let onSaveLoad: (load: LoadData) => Promise<void>;
  let onLogout: () => void;
  let onOpenHub: (
    tab?: "feed" | "messaging" | "intelligence" | "reports",
  ) => void;

  beforeEach(() => {
    onSaveLoad = vi.fn().mockResolvedValue(undefined) as unknown as (
      load: LoadData,
    ) => Promise<void>;
    onLogout = vi.fn() as unknown as () => void;
    onOpenHub = vi.fn() as unknown as (
      tab?: "feed" | "messaging" | "intelligence" | "reports",
    ) => void;
    localStorage.clear();
  });

  it("R-P4-07: Message Dispatch button is visible on Today tab when activeLoads.length > 0", () => {
    render(
      <DriverMobileHome
        user={mockUser}
        company={companyWithPhone}
        loads={[mockLoad]}
        onLogout={onLogout}
        onSaveLoad={onSaveLoad}
        onOpenHub={onOpenHub}
      />,
    );

    expect(screen.getByText("Message Dispatch")).toBeInTheDocument();
  });

  it("R-P4-07: clicking Message Dispatch calls onOpenHub('messaging')", async () => {
    const user = userEvent.setup();
    render(
      <DriverMobileHome
        user={mockUser}
        company={companyWithPhone}
        loads={[mockLoad]}
        onLogout={onLogout}
        onSaveLoad={onSaveLoad}
        onOpenHub={onOpenHub}
      />,
    );

    await user.click(screen.getByText("Message Dispatch"));
    expect(onOpenHub).toHaveBeenCalledWith("messaging");
  });

  it("R-P4-07: Message Dispatch button is NOT visible when no active loads", () => {
    render(
      <DriverMobileHome
        user={mockUser}
        company={companyWithPhone}
        loads={[]}
        onLogout={onLogout}
        onSaveLoad={onSaveLoad}
        onOpenHub={onOpenHub}
      />,
    );

    expect(screen.queryByText("Message Dispatch")).not.toBeInTheDocument();
  });

  it("R-P4-08: phone icon link with tel: href visible when company has phone", () => {
    render(
      <DriverMobileHome
        user={mockUser}
        company={companyWithPhone}
        loads={[mockLoad]}
        onLogout={onLogout}
        onSaveLoad={onSaveLoad}
        onOpenHub={onOpenHub}
      />,
    );

    const telLink = document.querySelector("a[href^='tel:']");
    expect(telLink).not.toBeNull();
    expect(telLink).toHaveAttribute("href", "tel:555-123-4567");
  });

  it("R-P4-08: phone link NOT visible when company has no phone", () => {
    render(
      <DriverMobileHome
        user={mockUser}
        company={companyNoPhone}
        loads={[mockLoad]}
        onLogout={onLogout}
        onSaveLoad={onSaveLoad}
        onOpenHub={onOpenHub}
      />,
    );

    const telLinks = document.querySelectorAll("a[href^='tel:']");
    expect(telLinks).toHaveLength(0);
  });
});
