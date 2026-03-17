// Tests R-P4-02, R-P4-03
import { describe, it, expect, vi, beforeEach, type MockedFunction } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { DriverMobileHome } from "../../../components/DriverMobileHome";
import type { LoadData, User, Company } from "../../../types";

// Mock Scanner so it renders a test-visible sentinel
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

// Mock GlobalMapViewEnhanced to avoid canvas errors
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

describe("DriverMobileHome Scanner integration (R-P4-02, R-P4-03)", () => {
  let onSaveLoad: MockedFunction<(load: LoadData) => Promise<void>>;
  let onLogout: MockedFunction<() => void>;
  let onOpenHub: MockedFunction<(tab?: "feed" | "messaging" | "intelligence" | "reports") => void>;

  beforeEach(() => {
    onSaveLoad = vi.fn().mockResolvedValue(undefined) as unknown as MockedFunction<(load: LoadData) => Promise<void>>;
    onLogout = vi.fn() as unknown as MockedFunction<() => void>;
    onOpenHub = vi.fn() as unknown as MockedFunction<(tab?: "feed" | "messaging" | "intelligence" | "reports") => void>;
    localStorage.clear();
  });

  it("R-P4-02: clicking Upload button opens Scanner modal", async () => {
    render(
      <DriverMobileHome
        user={mockUser}
        loads={[mockLoad]}
        onLogout={onLogout}
        onSaveLoad={onSaveLoad}
        onOpenHub={onOpenHub}
      />,
    );

    // Click the load card to enter detail view
    fireEvent.click(screen.getByText("Dallas → Houston"));

    // Click Upload button in document checklist
    const uploadBtn = screen.getByText("Upload");
    fireEvent.click(uploadBtn);

    await waitFor(() => {
      expect(screen.getByTestId("scanner-mock")).toBeInTheDocument();
    });
  });

  it("R-P4-03: when Scanner calls onDataExtracted, calls onSaveLoad with updated load", async () => {
    render(
      <DriverMobileHome
        user={mockUser}
        loads={[mockLoad]}
        onLogout={onLogout}
        onSaveLoad={onSaveLoad}
        onOpenHub={onOpenHub}
      />,
    );

    // Enter detail view
    fireEvent.click(screen.getByText("Dallas → Houston"));

    // Open scanner
    fireEvent.click(screen.getByText("Upload"));

    await waitFor(() => {
      expect(screen.getByTestId("scanner-mock")).toBeInTheDocument();
    });

    // Trigger extraction
    fireEvent.click(screen.getByTestId("scanner-extract"));

    await waitFor(() => {
      expect(onSaveLoad).toHaveBeenCalled();
    });

    const savedLoad = onSaveLoad.mock.calls[0][0] as LoadData;
    expect(savedLoad.id).toBe(mockLoad.id);
  });

  it("Scanner modal closes when cancel is clicked", async () => {
    render(
      <DriverMobileHome
        user={mockUser}
        loads={[mockLoad]}
        onLogout={onLogout}
        onSaveLoad={onSaveLoad}
        onOpenHub={onOpenHub}
      />,
    );

    fireEvent.click(screen.getByText("Dallas → Houston"));
    fireEvent.click(screen.getByText("Upload"));

    await waitFor(() => {
      expect(screen.getByTestId("scanner-mock")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("scanner-cancel"));

    await waitFor(() => {
      expect(screen.queryByTestId("scanner-mock")).not.toBeInTheDocument();
    });
  });
});
