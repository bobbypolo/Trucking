// Tests R-P4-05, R-P4-06
import { describe, it, expect, vi, beforeEach, type MockedFunction } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { DriverMobileHome } from "../../../components/DriverMobileHome";
import type { LoadData, User } from "../../../types";

// Mock Scanner
vi.mock("../../../components/Scanner", () => ({
  Scanner: ({
    onCancel,
  }: {
    onDataExtracted: (data: unknown) => void;
    onCancel: () => void;
  }) => (
    <div data-testid="scanner-mock">
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

// Mock GlobalMapViewEnhanced
vi.mock("../../../components/GlobalMapViewEnhanced", () => ({
  GlobalMapViewEnhanced: () => <div data-testid="map-mock" />,
}));

// Mock Toast to prevent auto-dismiss timer interference
vi.mock("../../../components/Toast", () => ({
  Toast: ({
    message,
    type,
  }: {
    message: string;
    type: string;
    onDismiss: () => void;
  }) => (
    <div data-testid="toast-mock" data-type={type}>
      {message}
    </div>
  ),
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

describe("DriverMobileHome status update toasts (R-P4-05, R-P4-06)", () => {
  let onSaveLoad: MockedFunction<(load: LoadData) => Promise<void>>;
  let onLogout: MockedFunction<() => void>;
  let onOpenHub: MockedFunction<(tab?: "feed" | "messaging" | "intelligence" | "reports") => void>;

  beforeEach(() => {
    onSaveLoad = vi.fn();
    onLogout = vi.fn() as unknown as MockedFunction<() => void>;
    onOpenHub = vi.fn() as unknown as MockedFunction<(tab?: "feed" | "messaging" | "intelligence" | "reports") => void>;
    localStorage.clear();
  });

  it("R-P4-05: shows success toast after successful status update", async () => {
    onSaveLoad.mockResolvedValue(undefined);
    const load = makeLoad({ status: "planned" });

    render(
      <DriverMobileHome
        user={mockUser}
        loads={[load]}
        onLogout={onLogout}
        onSaveLoad={onSaveLoad}
        onOpenHub={onOpenHub}
      />,
    );

    // Navigate into detail view
    fireEvent.click(screen.getByText("Dallas → Houston"));

    // Click Start Trip button (planned -> in_transit)
    const startBtn = screen.getByText("Start Trip");
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(screen.getByText(/Status updated to/i)).toBeInTheDocument();
    });

    // Verify it's a success toast
    const toast = screen.getByTestId("toast-mock");
    expect(toast).toHaveAttribute("data-type", "success");
  });

  it("R-P4-06: shows error toast after failed status update", async () => {
    onSaveLoad.mockRejectedValue(new Error("Network error"));
    const load = makeLoad({ status: "planned" });

    render(
      <DriverMobileHome
        user={mockUser}
        loads={[load]}
        onLogout={onLogout}
        onSaveLoad={onSaveLoad}
        onOpenHub={onOpenHub}
      />,
    );

    // Navigate into detail view
    fireEvent.click(screen.getByText("Dallas → Houston"));

    const startBtn = screen.getByText("Start Trip");
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(screen.getByText(/Failed to update status/i)).toBeInTheDocument();
    });

    // Verify it's an error toast
    const toast = screen.getByTestId("toast-mock");
    expect(toast).toHaveAttribute("data-type", "error");
  });
});
