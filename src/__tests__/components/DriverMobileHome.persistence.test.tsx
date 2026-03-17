// Tests R-P4-09, R-P4-10
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { DriverMobileHome } from "../../../components/DriverMobileHome";
import type { LoadData, User } from "../../../types";

// Mock Scanner
vi.mock("../../../components/Scanner", () => ({
  Scanner: () => <div data-testid="scanner-mock" />,
}));

// Mock GlobalMapViewEnhanced
vi.mock("../../../components/GlobalMapViewEnhanced", () => ({
  GlobalMapViewEnhanced: () => <div data-testid="map-mock" />,
}));

const mockUser: User = {
  id: "driver-99",
  name: "Persistent Driver",
  email: "persistent@test.com",
  role: "driver",
  companyId: "company-1",
  onboardingStatus: "Completed",
  safetyScore: 100,
};

const makeLoad = (overrides: Partial<LoadData> = {}): LoadData => ({
  id: "load-1",
  loadNumber: "LD-001",
  companyId: "company-1",
  driverId: "driver-99",
  status: "planned",
  carrierRate: 2500,
  driverPay: 1500,
  pickup: { city: "Dallas", state: "TX" },
  dropoff: { city: "Houston", state: "TX" },
  pickupDate: "2024-06-01",
  ...overrides,
});

describe("DriverMobileHome localStorage persistence (R-P4-09, R-P4-10)", () => {
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

  it("R-P4-09: restores activeTab from localStorage on mount", () => {
    localStorage.setItem("driver_driver-99_activeTab", "loads");

    render(
      <DriverMobileHome
        user={mockUser}
        loads={[makeLoad()]}
        onLogout={onLogout}
        onSaveLoad={onSaveLoad}
        onOpenHub={onOpenHub}
      />,
    );

    // "Load History" heading is only visible when loads tab is active
    expect(screen.getByText("Load History")).toBeInTheDocument();
  });

  it("R-P4-09: restores selectedLoadId from localStorage on mount", async () => {
    localStorage.setItem("driver_driver-99_selectedLoadId", "load-1");

    render(
      <DriverMobileHome
        user={mockUser}
        loads={[makeLoad()]}
        onLogout={onLogout}
        onSaveLoad={onSaveLoad}
        onOpenHub={onOpenHub}
      />,
    );

    // When selectedLoadId is set, we see the detail view with "Job Detail"
    await waitFor(() => {
      expect(screen.getByText("Job Detail")).toBeInTheDocument();
    });
  });

  it("R-P4-10: writes activeTab to localStorage on tab change", () => {
    render(
      <DriverMobileHome
        user={mockUser}
        loads={[makeLoad()]}
        onLogout={onLogout}
        onSaveLoad={onSaveLoad}
        onOpenHub={onOpenHub}
      />,
    );

    // Click the "Loads" tab nav button (text "Loads" in nav)
    const loadsNavBtn = screen.getByText("Loads").closest("button");
    expect(loadsNavBtn).not.toBeNull();
    fireEvent.click(loadsNavBtn!);

    expect(localStorage.getItem("driver_driver-99_activeTab")).toBe("loads");
  });

  it("R-P4-10: writes correct tab value for docs tab change", () => {
    render(
      <DriverMobileHome
        user={mockUser}
        loads={[makeLoad()]}
        onLogout={onLogout}
        onSaveLoad={onSaveLoad}
        onOpenHub={onOpenHub}
      />,
    );

    // Go to docs tab
    const docsBtn = screen.getByText("Docs").closest("button");
    fireEvent.click(docsBtn!);
    expect(localStorage.getItem("driver_driver-99_activeTab")).toBe(
      "documents",
    );
  });
});
