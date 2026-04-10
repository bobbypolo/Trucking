import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DriverMobileHome } from "../../../components/DriverMobileHome";
import type { LoadData, User } from "../../../types";

vi.mock("../../../components/Scanner", () => ({
  Scanner: ({
    onDataExtracted,
    onCancel,
  }: {
    onDataExtracted: (data: unknown) => void;
    onCancel: () => void;
  }) => (
    <div data-testid="scanner-mock">
      <button
        data-testid="scanner-extract"
        onClick={() => onDataExtracted({ docType: "BOL", confidence: 0.95 })}
      >
        Extract
      </button>
      <button data-testid="scanner-cancel" onClick={onCancel}>
        Cancel
      </button>
    </div>
  ),
}));

vi.mock("../../../components/GlobalMapViewEnhanced", () => ({
  GlobalMapViewEnhanced: () => <div data-testid="map-mock">Map</div>,
}));

vi.mock("../../../services/api", () => {
  const mockGet = vi.fn().mockImplementation((url: string) => {
    if (url.includes("change-requests"))
      return Promise.resolve({ changeRequests: [] });
    if (url.includes("documents")) return Promise.resolve({ documents: [] });
    return Promise.resolve([]);
  });
  return {
    api: { get: mockGet, post: vi.fn().mockResolvedValue({}), patch: vi.fn(), delete: vi.fn() },
    apiFetch: vi.fn().mockResolvedValue(undefined),
    ForbiddenError: class ForbiddenError extends Error {},
  };
});

const mockUser: User = {
  id: "driver-1",
  name: "Test Driver",
  email: "driver@test.com",
  role: "driver",
  companyId: "company-1",
  onboardingStatus: "Completed",
  safetyScore: 100,
};

const makeLoad = (overrides: Partial<LoadData> = {}): LoadData => ({
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
  ...overrides,
});

describe("DriverMobileHome sales demo intake UX", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("hides the legacy Submit Load Intake tile in sales demo mode", () => {
    vi.stubEnv("VITE_DEMO_NAV_MODE", "sales");

    render(
      <DriverMobileHome
        user={mockUser}
        loads={[makeLoad()]}
        onLogout={vi.fn()}
        onSaveLoad={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.queryByTestId("submit-load-intake-tile")).not.toBeInTheDocument();
    expect(screen.getByText("Certified Demo Path")).toBeInTheDocument();
  });

  it("disables intake submit until the required review fields are filled", async () => {
    const user = userEvent.setup();
    vi.stubEnv("VITE_DEMO_NAV_MODE", "sales");

    render(
      <DriverMobileHome
        user={mockUser}
        loads={[makeLoad()]}
        onLogout={vi.fn()}
        onSaveLoad={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    await user.click(screen.getByTestId("new-intake-today"));
    await user.click(screen.getByTestId("scanner-extract"));

    const submitBtn = await screen.findByTestId("intake-submit");
    expect(submitBtn).toBeDisabled();
    expect(screen.getByTestId("intake-required-warning")).toBeInTheDocument();

    await user.type(screen.getByTestId("intake-pickup-city"), "Dallas");
    await user.type(screen.getByTestId("intake-pickup-state"), "TX");
    await user.type(screen.getByTestId("intake-dropoff-city"), "Houston");
    await user.type(screen.getByTestId("intake-dropoff-state"), "TX");
    await user.type(screen.getByTestId("intake-pickup-date"), "2026-04-09");
    await user.type(screen.getByTestId("intake-commodity"), "Refrigerated Produce");

    expect(submitBtn).toBeEnabled();
  });
});
