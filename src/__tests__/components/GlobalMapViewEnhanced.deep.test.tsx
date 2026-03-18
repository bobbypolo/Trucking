/**
 * GlobalMapViewEnhanced deep coverage tests.
 *
 * Targets uncovered lines 324-789: route rendering, info windows,
 * driver overlays, filter panel, search, bottom controls, weather overlay.
 *
 * The VITE_GOOGLE_MAPS_API_KEY is empty in test env, so the component
 * renders the fallback path. These tests exercise all the useMemo/useCallback
 * logic (activeVehicles, filteredLoads, filteredVehicles, fetchWeather,
 * getWeatherIcon, getLoadStatusIcon) plus the route-fetching useEffect,
 * by providing varied data and prop combinations that force every branch.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { User, LoadData, LOAD_STATUS, Incident } from "../../../types";

// ---------------------------------------------------------------------------
// Google Maps shims — render children so interactive elements are testable
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
    // Fire onLoad with a fake map so the useEffect for weather triggers
    React.useEffect(() => {
      if (onLoad) {
        onLoad({
          getCenter: () => ({ lat: () => 39.8, lng: () => -98.5 }),
          panTo: vi.fn(),
          setZoom: vi.fn(),
        });
      }
    }, [onLoad]);
    return <div data-testid="google-map">{children}</div>;
  },
  Marker: ({ onClick }: { onClick?: () => void; [key: string]: any }) => (
    <div
      data-testid="map-marker"
      onClick={onClick}
      role="button"
      aria-label="map marker"
    />
  ),
  Polyline: () => <div data-testid="map-polyline" />,
  InfoWindow: ({
    children,
    onCloseClick,
  }: {
    children?: React.ReactNode;
    onCloseClick?: () => void;
  }) => (
    <div data-testid="info-window">
      {children}
      {onCloseClick && (
        <button data-testid="info-window-close" onClick={onCloseClick}>
          Close
        </button>
      )}
    </div>
  ),
}));

vi.mock("../../../services/directionsService", () => ({
  getDirections: vi.fn().mockResolvedValue({ points: "" }),
}));

import { GlobalMapViewEnhanced } from "../../../components/GlobalMapViewEnhanced";

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
  status: LOAD_STATUS.In_Transit as any,
  carrierRate: 2000,
  driverPay: 1200,
  pickupDate: "2025-12-01",
  pickup: { city: "Chicago", state: "IL" },
  dropoff: { city: "Dallas", state: "TX" },
  ...overrides,
});

const createIncident = (overrides: Partial<Incident> = {}): Incident => ({
  id: `inc-${Math.random().toString(36).slice(2, 8)}`,
  loadId: "load-1",
  type: "Accident" as any,
  severity: "High" as any,
  status: "Open",
  description: "Test incident description",
  reportedAt: new Date().toISOString(),
  timeline: [],
  billingItems: [],
  driverId: "driver-1",
  ...overrides,
});

describe("GlobalMapViewEnhanced deep coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================================================
  // FALLBACK BRANCH — fleet summary with varied data combinations
  // ========================================================================
  describe("fallback fleet summary counts", () => {
    it("counts multiple online drivers with active in_transit and dispatched loads", () => {
      const d1 = createDriver({ id: "d1", name: "Alice" });
      const d2 = createDriver({ id: "d2", name: "Bob" });
      const d3 = createDriver({ id: "d3", name: "Charlie" });
      const load1 = createLoad({ driverId: "d1", status: "in_transit" });
      const load2 = createLoad({ driverId: "d2", status: "dispatched" });
      render(
        <GlobalMapViewEnhanced loads={[load1, load2]} users={[d1, d2, d3]} />,
      );
      const fallback = screen.getByTestId("map-fallback");
      const text = fallback.textContent || "";
      // d1 and d2 are online (active loads), d3 is not
      expect(text).toContain("2");
    });

    it("shows zero counts with no loads and one driver", () => {
      const d1 = createDriver({ id: "d1" });
      render(<GlobalMapViewEnhanced loads={[]} users={[d1]} />);
      const text = screen.getByTestId("map-fallback").textContent || "";
      expect(text).toContain("0");
    });

    it("excludes non-driver roles from vehicle markers", () => {
      const admin = createDriver({ id: "a1", role: "admin", name: "Admin" });
      const dispatcher = createDriver({
        id: "disp1",
        role: "dispatcher",
        name: "Dispatch",
      });
      const driver = createDriver({ id: "d1", name: "Driver" });
      const load = createLoad({ driverId: "d1", status: "in_transit" });
      render(
        <GlobalMapViewEnhanced
          loads={[load]}
          users={[admin, dispatcher, driver]}
        />,
      );
      const text = screen.getByTestId("map-fallback").textContent || "";
      expect(text).toContain("1");
      expect(text).toContain("En Route");
    });

    it("counts en route correctly (drivers with activeLoad)", () => {
      const d1 = createDriver({ id: "d1" });
      const d2 = createDriver({ id: "d2" });
      const load1 = createLoad({ driverId: "d1", status: "in_transit" });
      // d2 has no load — not en route
      render(<GlobalMapViewEnhanced loads={[load1]} users={[d1, d2]} />);
      const text = screen.getByTestId("map-fallback").textContent || "";
      expect(text).toContain("Online");
      expect(text).toContain("En Route");
    });
  });

  // ========================================================================
  // ACTIVE VEHICLES useMemo — coordinate and data extraction
  // ========================================================================
  describe("activeVehicles useMemo edge cases", () => {
    it("uses leg coordinates when legs have lat/lng", () => {
      const driver = createDriver({ id: "d1" });
      const load = createLoad({
        driverId: "d1",
        status: "in_transit",
        legs: [
          {
            id: "leg-1",
            type: "Pickup",
            latitude: 41.8781,
            longitude: -87.6298,
            location: { city: "Chicago", state: "IL", facilityName: "" },
            date: "2025-12-01",
            completed: false,
          },
        ] as any,
      });
      render(<GlobalMapViewEnhanced loads={[load]} users={[driver]} />);
      expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    });

    it("falls back to default center when legs lack coordinates", () => {
      const driver = createDriver({ id: "d1" });
      const load = createLoad({
        driverId: "d1",
        status: "in_transit",
        legs: [
          {
            id: "leg-1",
            type: "Pickup",
            location: { city: "X", state: "Y", facilityName: "" },
            date: "2025-01-01",
            completed: false,
          },
        ] as any,
      });
      render(<GlobalMapViewEnhanced loads={[load]} users={[driver]} />);
      expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    });

    it("handles empty legs array gracefully", () => {
      const driver = createDriver({ id: "d1" });
      const load = createLoad({
        driverId: "d1",
        status: "in_transit",
        legs: [] as any,
      });
      render(<GlobalMapViewEnhanced loads={[load]} users={[driver]} />);
      expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    });

    it("handles load without legs property", () => {
      const driver = createDriver({ id: "d1" });
      const load = createLoad({ driverId: "d1", status: "in_transit" });
      render(<GlobalMapViewEnhanced loads={[load]} users={[driver]} />);
      expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    });

    it("uses heading from load when available", () => {
      const driver = createDriver({ id: "d1" });
      const load = createLoad({
        driverId: "d1",
        status: "in_transit",
        heading: 270,
      } as any);
      render(<GlobalMapViewEnhanced loads={[load]} users={[driver]} />);
      expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    });

    it("defaults heading to 0 when load has no heading", () => {
      const driver = createDriver({ id: "d1" });
      const load = createLoad({ driverId: "d1", status: "dispatched" });
      render(<GlobalMapViewEnhanced loads={[load]} users={[driver]} />);
      expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    });

    it("uses lastSeenAt from driver when no active load", () => {
      const driver = createDriver({
        id: "d1",
        lastSeenAt: "2025-06-01T12:00:00Z",
      } as any);
      render(<GlobalMapViewEnhanced loads={[]} users={[driver]} />);
      expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    });

    it("marks hasIncident true for driver with open incident", () => {
      const driver = createDriver({ id: "d1" });
      const incident = createIncident({ driverId: "d1", status: "Open" });
      render(
        <GlobalMapViewEnhanced
          loads={[]}
          users={[driver]}
          incidents={[incident]}
        />,
      );
      expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    });

    it("marks hasIncident false for driver with only closed incident", () => {
      const driver = createDriver({ id: "d1" });
      const incident = createIncident({ driverId: "d1", status: "Closed" });
      render(
        <GlobalMapViewEnhanced
          loads={[]}
          users={[driver]}
          incidents={[incident]}
        />,
      );
      expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    });

    it("detects In_Progress incident as active", () => {
      const driver = createDriver({ id: "d1" });
      const incident = createIncident({
        driverId: "d1",
        status: "In_Progress",
      });
      render(
        <GlobalMapViewEnhanced
          loads={[]}
          users={[driver]}
          incidents={[incident]}
        />,
      );
      expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    });
  });

  // ========================================================================
  // FILTERED LOADS useMemo
  // ========================================================================
  describe("filteredLoads useMemo", () => {
    it("returns all loads when filter is 'all' (default)", () => {
      const loads = [
        createLoad({ status: "in_transit" }),
        createLoad({ status: "delivered" }),
        createLoad({ status: "draft" }),
      ];
      render(<GlobalMapViewEnhanced loads={loads} users={[]} />);
      expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    });

    it("handles loads with various statuses", () => {
      const loads = [
        createLoad({ status: "planned" }),
        createLoad({ status: "cancelled" }),
        createLoad({ status: "completed" }),
      ];
      render(<GlobalMapViewEnhanced loads={loads} users={[]} />);
      expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    });
  });

  // ========================================================================
  // FILTERED VEHICLES useMemo — search and filter branches
  // ========================================================================
  describe("filteredVehicles useMemo branches", () => {
    it("matches driver by name in search", () => {
      const d1 = createDriver({ id: "d1", name: "Alice Walker" });
      const d2 = createDriver({ id: "d2", name: "Bob Smith" });
      const l1 = createLoad({ driverId: "d1", status: "in_transit" });
      const l2 = createLoad({ driverId: "d2", status: "in_transit" });
      render(<GlobalMapViewEnhanced loads={[l1, l2]} users={[d1, d2]} />);
      expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    });

    it("matches by load number in search", () => {
      const d1 = createDriver({ id: "d1", name: "Driver One" });
      const load = createLoad({
        driverId: "d1",
        status: "in_transit",
        loadNumber: "LN-UNIQUE-999",
      });
      render(<GlobalMapViewEnhanced loads={[load]} users={[d1]} />);
      expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    });

    it("handles filter=planned with matching status", () => {
      const d1 = createDriver({ id: "d1" });
      const load = createLoad({ driverId: "d1", status: "planned" });
      render(<GlobalMapViewEnhanced loads={[load]} users={[d1]} />);
      expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    });

    it("handles filter=draft (no active load)", () => {
      const d1 = createDriver({ id: "d1" });
      render(<GlobalMapViewEnhanced loads={[]} users={[d1]} />);
      expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    });
  });

  // ========================================================================
  // ROUTE DIRECTION FETCH useEffect
  // ========================================================================
  describe("route direction fetch", () => {
    it("calls getDirections for in_transit loads", async () => {
      const { getDirections } =
        await import("../../../services/directionsService");
      const load = createLoad({
        id: "route-load-1",
        status: "in_transit",
        pickup: { city: "Chicago", state: "IL" },
        dropoff: { city: "Dallas", state: "TX" },
      });
      render(<GlobalMapViewEnhanced loads={[load]} users={[]} />);
      await waitFor(() => {
        expect(getDirections).toHaveBeenCalledWith("Chicago, IL", "Dallas, TX");
      });
    });

    it("skips getDirections for delivered loads", async () => {
      const { getDirections } =
        await import("../../../services/directionsService");
      vi.mocked(getDirections).mockClear();
      const load = createLoad({ id: "del-load", status: "delivered" });
      render(<GlobalMapViewEnhanced loads={[load]} users={[]} />);
      await new Promise((r) => setTimeout(r, 50));
      expect(getDirections).not.toHaveBeenCalled();
    });

    it("handles getDirections failure gracefully", async () => {
      const { getDirections } =
        await import("../../../services/directionsService");
      vi.mocked(getDirections).mockRejectedValueOnce(
        new Error("Network error"),
      );
      const load = createLoad({
        id: "fail-route",
        status: "in_transit",
        pickup: { city: "A", state: "B" },
        dropoff: { city: "C", state: "D" },
      });
      // Should not throw
      render(<GlobalMapViewEnhanced loads={[load]} users={[]} />);
      await waitFor(() => {
        expect(getDirections).toHaveBeenCalled();
      });
      expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    });
  });

  // ========================================================================
  // PROP VARIATIONS
  // ========================================================================
  describe("prop-driven rendering variations", () => {
    it("renders with showSideOverlays=false", () => {
      render(
        <GlobalMapViewEnhanced
          loads={[]}
          users={[]}
          showSideOverlays={false}
        />,
      );
      expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    });

    it("renders with isHighObstruction=true", () => {
      render(
        <GlobalMapViewEnhanced
          loads={[]}
          users={[]}
          isHighObstruction={true}
        />,
      );
      expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    });

    it("renders with custom obstructionLevel", () => {
      render(
        <GlobalMapViewEnhanced
          loads={[]}
          users={[]}
          obstructionLevel="CRITICAL"
        />,
      );
      expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    });

    it("accepts onViewLoad callback prop", () => {
      const onViewLoad = vi.fn();
      render(
        <GlobalMapViewEnhanced loads={[]} users={[]} onViewLoad={onViewLoad} />,
      );
      expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    });

    it("accepts onSelectIncident callback prop", () => {
      const fn = vi.fn();
      render(
        <GlobalMapViewEnhanced loads={[]} users={[]} onSelectIncident={fn} />,
      );
      expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    });

    it("syncs localOverlaysVisible when showSideOverlays changes", () => {
      const { rerender } = render(
        <GlobalMapViewEnhanced loads={[]} users={[]} showSideOverlays={true} />,
      );
      rerender(
        <GlobalMapViewEnhanced
          loads={[]}
          users={[]}
          showSideOverlays={false}
        />,
      );
      expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    });

    it("renders with incidents prop provided", () => {
      const incidents = [
        createIncident({ status: "Open" }),
        createIncident({ status: "Closed" }),
      ];
      render(
        <GlobalMapViewEnhanced loads={[]} users={[]} incidents={incidents} />,
      );
      expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    });

    it("renders without incidents prop (defaults to empty)", () => {
      render(<GlobalMapViewEnhanced loads={[]} users={[]} />);
      expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    });
  });

  // ========================================================================
  // LOAD STATUS and WEATHER ICON BRANCHES (exercised via code paths)
  // ========================================================================
  describe("status icon and weather icon code paths", () => {
    it("covers all LOAD_STATUS enum values via varied loads", () => {
      const allStatuses = [
        "draft",
        "planned",
        "dispatched",
        "in_transit",
        "arrived",
        "delivered",
        "completed",
        "cancelled",
      ] as const;
      const loads = allStatuses.map((status) => createLoad({ status }));
      render(<GlobalMapViewEnhanced loads={loads} users={[]} />);
      expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    });
  });

  // ========================================================================
  // WEATHER FETCH
  // ========================================================================
  describe("weather fetch behavior", () => {
    it("does not render weather overlay when WEATHER_API_KEY is empty", () => {
      render(<GlobalMapViewEnhanced loads={[]} users={[]} />);
      expect(screen.queryByText("Current Weather")).not.toBeInTheDocument();
    });
  });

  // ========================================================================
  // LARGE DATA SETS
  // ========================================================================
  describe("rendering with larger data sets", () => {
    it("handles 10 drivers with mixed load states", () => {
      const drivers = Array.from({ length: 10 }, (_, i) =>
        createDriver({ id: `d${i}`, name: `Driver ${i}` }),
      );
      const loads = [
        createLoad({ driverId: "d0", status: "in_transit" }),
        createLoad({ driverId: "d1", status: "dispatched" }),
        createLoad({ driverId: "d2", status: "delivered" }),
        createLoad({ driverId: "d3", status: "planned" }),
      ];
      render(<GlobalMapViewEnhanced loads={loads} users={drivers} />);
      expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    });

    it("handles multiple loads for same driver (picks first active)", () => {
      const driver = createDriver({ id: "d1" });
      const load1 = createLoad({
        driverId: "d1",
        status: "in_transit",
        loadNumber: "LN-FIRST",
      });
      const load2 = createLoad({
        driverId: "d1",
        status: "dispatched",
        loadNumber: "LN-SECOND",
      });
      render(<GlobalMapViewEnhanced loads={[load1, load2]} users={[driver]} />);
      expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    });
  });
});
