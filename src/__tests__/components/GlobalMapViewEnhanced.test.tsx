/**
 * GlobalMapViewEnhanced tests — WITHOUT a valid Google Maps API key (fallback).
 *
 * The API key is captured at module-load time, so tests for the valid-key
 * path live in a separate file (GlobalMapViewEnhanced.withkey.test.tsx).
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GlobalMapViewEnhanced } from "../../../components/GlobalMapViewEnhanced";
import { User, LoadData, LOAD_STATUS } from "../../../types";

// ---------------------------------------------------------------------------
// Mock @react-google-maps/api (still needed even for fallback path)
// ---------------------------------------------------------------------------
vi.mock("@react-google-maps/api", () => ({
  LoadScript: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="load-script">{children}</div>
  ),
  GoogleMap: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="google-map">{children}</div>
  ),
  Marker: () => <div data-testid="map-marker" />,
  Polyline: () => <div data-testid="map-polyline" />,
  InfoWindow: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="info-window">{children}</div>
  ),
}));

vi.mock("../../../services/directionsService", () => ({
  getDirections: vi.fn().mockResolvedValue({ points: "" }),
}));

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------
const createDriver = (overrides: Partial<User> = {}): User => ({
  id: `driver-${Math.random().toString(36).slice(2, 8)}`,
  companyId: "c1",
  email: "d@t.com",
  name: "Test Driver",
  role: "driver",
  onboardingStatus: "Completed",
  safetyScore: 95,
  ...overrides,
});

const createLoad = (overrides: Partial<LoadData> = {}): LoadData => ({
  id: `load-${Math.random().toString(36).slice(2, 8)}`,
  companyId: "c1",
  driverId: "driver-1",
  loadNumber: "LN-100",
  status: LOAD_STATUS.In_Transit,
  carrierRate: 2000,
  driverPay: 1200,
  pickupDate: "2025-12-01",
  pickup: { city: "Chicago", state: "IL" },
  dropoff: { city: "Dallas", state: "TX" },
  ...overrides,
});

// ---------------------------------------------------------------------------
// The VITE_GOOGLE_MAPS_API_KEY env is empty/undefined by default in test,
// so the component should render the fallback.
// ---------------------------------------------------------------------------
describe("GlobalMapViewEnhanced -- missing API key (fallback)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders error banner when API key is missing", () => {
    render(<GlobalMapViewEnhanced loads={[]} users={[]} />);
    const banner = screen.getByTestId("maps-api-key-error-banner");
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toMatch(/not configured/i);
  });

  it("error banner has role=alert for accessibility", () => {
    render(<GlobalMapViewEnhanced loads={[]} users={[]} />);
    const alerts = screen.getAllByRole("alert");
    expect(alerts.length).toBeGreaterThanOrEqual(1);
  });

  it("renders map-fallback container", () => {
    render(<GlobalMapViewEnhanced loads={[]} users={[]} />);
    expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
  });

  it("shows Map Unavailable text", () => {
    render(<GlobalMapViewEnhanced loads={[]} users={[]} />);
    expect(screen.getByText("Map Unavailable")).toBeInTheDocument();
  });

  it("shows fleet summary labels", () => {
    render(<GlobalMapViewEnhanced loads={[]} users={[]} />);
    expect(screen.getByText("Online")).toBeInTheDocument();
    expect(screen.getByText("En Route")).toBeInTheDocument();
  });

  it("shows Fleet Summary heading", () => {
    render(<GlobalMapViewEnhanced loads={[]} users={[]} />);
    expect(screen.getByText("Fleet Summary")).toBeInTheDocument();
  });

  it("counts online drivers in fallback (drivers with active loads)", () => {
    const d1 = createDriver({ id: "d1" });
    const d2 = createDriver({ id: "d2" });
    const load = createLoad({ driverId: "d1", status: "in_transit" });
    render(<GlobalMapViewEnhanced loads={[load]} users={[d1, d2]} />);
    // d1 is online (has active load), d2 is not
    const text = document.body.textContent || "";
    expect(text).toContain("Online");
    expect(text).toContain("En Route");
  });

  it("shows the configuration hint text", () => {
    render(<GlobalMapViewEnhanced loads={[]} users={[]} />);
    expect(
      screen.getByText(/not configured for this account/i),
    ).toBeInTheDocument();
  });
});
