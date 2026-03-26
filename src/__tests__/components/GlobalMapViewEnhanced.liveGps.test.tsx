/**
 * GlobalMapViewEnhanced -- Live GPS polling tests (S-403)
 *
 * R-P4-10: Map shows live GPS positions when API returns data, updates every 30s
 * R-P4-11: Fallback to static data when GPS provider not configured (no visual regression)
 * R-P4-12: Polling stops on component unmount (cleanup — no memory leak)
 *
 * NOTE: VITE_GOOGLE_MAPS_API_KEY is empty in test env, so the component
 * renders the fallback path. Live GPS polling still runs (useEffect is
 * declared before the early return). We test the polling, cleanup, and
 * fallback behaviors through fetch spy assertions and indicator test-ids.
 */

import React from "react";
import { render, screen, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock @react-google-maps/api (needed even for fallback path)
// ---------------------------------------------------------------------------
vi.mock("@react-google-maps/api", () => ({
  LoadScript: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="load-script">{children}</div>
  ),
  GoogleMap: ({
    children,
    onLoad,
  }: {
    children?: React.ReactNode;
    onLoad?: (map: any) => void;
  }) => {
    React.useEffect(() => {
      if (onLoad)
        onLoad({ getCenter: () => null, panTo: vi.fn(), setZoom: vi.fn() });
    }, [onLoad]);
    return <div data-testid="google-map">{children}</div>;
  },
  Marker: (props: any) => <div data-testid="map-marker" />,
  Polyline: () => <div data-testid="map-polyline" />,
  InfoWindow: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="info-window">{children}</div>
  ),
}));

vi.mock("../../../services/directionsService", () => ({
  getDirections: vi.fn().mockResolvedValue({ points: "" }),
}));

vi.mock("../../../services/authService", () => ({
  getIdTokenAsync: vi.fn().mockResolvedValue("test-token"),
  forceRefreshToken: vi.fn().mockResolvedValue("test-token"),
  default: {},
}));

import { GlobalMapViewEnhanced } from "../../../components/GlobalMapViewEnhanced";
import { User, LoadData, LOAD_STATUS } from "../../../types";

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
// Live GPS API mock data
// ---------------------------------------------------------------------------
const mockLivePositions = [
  {
    vehicleId: "v-100",
    driverId: "d1",
    latitude: 41.8781,
    longitude: -87.6298,
    speed: 55,
    heading: 180,
    recordedAt: new Date().toISOString(),
    provider: "samsara",
    providerVehicleId: "sam-v-100",
    isMock: false,
  },
  {
    vehicleId: "v-200",
    driverId: "d2",
    latitude: 32.7767,
    longitude: -96.797,
    speed: 62,
    heading: 90,
    recordedAt: new Date().toISOString(),
    provider: "samsara",
    providerVehicleId: "sam-v-200",
    isMock: false,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("GlobalMapViewEnhanced -- Live GPS polling (S-403)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ positions: mockLivePositions }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // R-P4-10: Map shows live GPS positions when API returns data, updates every 30s
  describe("R-P4-10: Live GPS positions display and 30s polling", () => {
    it("fetches /api/tracking/live on mount", async () => {
      const driver = createDriver({ id: "d1" });

      await act(async () => {
        render(<GlobalMapViewEnhanced loads={[]} users={[driver]} />);
      });

      // Flush the initial fetch
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      const trackingCalls = fetchSpy.mock.calls.filter(
        (call) =>
          typeof call[0] === "string" && call[0].includes("/api/tracking/live"),
      );
      expect(trackingCalls.length).toBeGreaterThanOrEqual(1);
    });

    it("shows live indicator when API returns real GPS data", async () => {
      const driver = createDriver({ id: "d1" });

      await act(async () => {
        render(<GlobalMapViewEnhanced loads={[]} users={[driver]} />);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Live indicator should appear in fallback view when API returns real data
      expect(screen.getByTestId("live-gps-indicator")).toBeInTheDocument();
    });

    it("polls every 30 seconds", async () => {
      const driver = createDriver({ id: "d1" });

      await act(async () => {
        render(<GlobalMapViewEnhanced loads={[]} users={[driver]} />);
      });

      // Initial fetch
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      const initialCalls = fetchSpy.mock.calls.filter(
        (call) =>
          typeof call[0] === "string" && call[0].includes("/api/tracking/live"),
      ).length;

      // Advance 30 seconds
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });

      const afterOnePoll = fetchSpy.mock.calls.filter(
        (call) =>
          typeof call[0] === "string" && call[0].includes("/api/tracking/live"),
      ).length;

      expect(afterOnePoll).toBeGreaterThan(initialCalls);

      // Advance another 30 seconds
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });

      const afterTwoPolls = fetchSpy.mock.calls.filter(
        (call) =>
          typeof call[0] === "string" && call[0].includes("/api/tracking/live"),
      ).length;

      expect(afterTwoPolls).toBeGreaterThan(afterOnePoll);
    });
  });

  // R-P4-11: Fallback to static data when GPS provider not configured
  describe("R-P4-11: Fallback to static data", () => {
    it("renders fallback view when API returns error (no visual regression)", async () => {
      fetchSpy.mockRejectedValue(new Error("GPS not configured"));

      const driver = createDriver({ id: "d1" });
      const load = createLoad({ driverId: "d1", status: "in_transit" });

      await act(async () => {
        render(<GlobalMapViewEnhanced loads={[load]} users={[driver]} />);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Fallback view should still render — no visual regression
      expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
      expect(screen.getByText("Fleet Summary")).toBeInTheDocument();
    });

    it("does not show live indicator when API returns empty positions", async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ positions: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const driver = createDriver({ id: "d1" });

      await act(async () => {
        render(<GlobalMapViewEnhanced loads={[]} users={[driver]} />);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(
        screen.queryByTestId("live-gps-indicator"),
      ).not.toBeInTheDocument();
    });

    it("does not show live indicator when API returns error", async () => {
      fetchSpy.mockRejectedValue(new Error("GPS not configured"));

      const driver = createDriver({ id: "d1" });

      await act(async () => {
        render(<GlobalMapViewEnhanced loads={[]} users={[driver]} />);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(
        screen.queryByTestId("live-gps-indicator"),
      ).not.toBeInTheDocument();
    });

    it("shows simulated label for mock positions", async () => {
      const mockPositions = [
        {
          ...mockLivePositions[0],
          isMock: true,
        },
      ];
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ positions: mockPositions }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const driver = createDriver({ id: "d1" });

      await act(async () => {
        render(<GlobalMapViewEnhanced loads={[]} users={[driver]} />);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // The simulated label should appear for mock positions
      expect(screen.getByText(/simulated/i)).toBeInTheDocument();
    });
  });

  // R-P4-12: Polling stops on component unmount
  describe("R-P4-12: Cleanup on unmount (no memory leak)", () => {
    it("stops polling when component is unmounted", async () => {
      const driver = createDriver({ id: "d1" });

      const { unmount } = render(
        <GlobalMapViewEnhanced loads={[]} users={[driver]} />,
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      const callsBeforeUnmount = fetchSpy.mock.calls.filter(
        (call) =>
          typeof call[0] === "string" && call[0].includes("/api/tracking/live"),
      ).length;

      // Unmount the component
      unmount();

      // Advance time well past the polling interval
      await act(async () => {
        await vi.advanceTimersByTimeAsync(90_000);
      });

      const callsAfterUnmount = fetchSpy.mock.calls.filter(
        (call) =>
          typeof call[0] === "string" && call[0].includes("/api/tracking/live"),
      ).length;

      // No new calls should have been made after unmount
      expect(callsAfterUnmount).toBe(callsBeforeUnmount);
    });
  });
});
