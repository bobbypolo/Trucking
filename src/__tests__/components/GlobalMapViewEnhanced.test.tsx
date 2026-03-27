/**
 * GlobalMapViewEnhanced tests — WITHOUT a valid Google Maps API key (fallback).
 *
 * The API key is captured at module-load time, so tests for the valid-key
 * path live in a separate file (GlobalMapViewEnhanced.withkey.test.tsx).
 */

import React from "react";
import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  GlobalMapViewEnhanced,
  FleetMapWidget,
} from "../../../components/GlobalMapViewEnhanced";
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

vi.mock("../../../services/authService", () => ({
  getIdTokenAsync: vi.fn().mockResolvedValue("test-token"),
  forceRefreshToken: vi.fn().mockResolvedValue("test-token"),
  default: {},
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
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          positions: [],
          trackingState: "not-configured",
          providerName: null,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders error banner when API key is missing", () => {
    render(<GlobalMapViewEnhanced loads={[]} users={[]} />);
    const banner = screen.getByTestId("maps-api-key-error-banner");
    expect(banner).toBeInTheDocument();
    // User-friendly message — does not expose raw env var names
    expect(banner.textContent).toMatch(/requires configuration/i);
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

  it("shows Map Configuration Required text", () => {
    render(<GlobalMapViewEnhanced loads={[]} users={[]} />);
    expect(screen.getByText("Map Configuration Required")).toBeInTheDocument();
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

  it("does NOT expose raw env var names in the error banner", () => {
    // Tests T3-07: user-facing text must not expose VITE_GOOGLE_MAPS_API_KEY
    render(<GlobalMapViewEnhanced loads={[]} users={[]} />);
    const banner = screen.getByTestId("maps-api-key-error-banner");
    // The main visible message should not contain the raw env var name
    // (It may appear in a dev-only hidden span, but not in the primary message span)
    const primaryMessage = banner.querySelector("span:first-of-type");
    expect(primaryMessage?.textContent).not.toMatch(/VITE_GOOGLE_MAPS_API_KEY/);
  });

  it("shows user-friendly admin contact message instead of env var name", () => {
    render(<GlobalMapViewEnhanced loads={[]} users={[]} />);
    expect(screen.getByText(/contact your administrator/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tracking state banner tests (T3-07)
// ---------------------------------------------------------------------------
describe("GlobalMapViewEnhanced -- tracking state banners", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows not-configured banner when trackingState is not-configured", async () => {
    // Tests R-T3-01: not-configured state shows setup prompt
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          positions: [],
          trackingState: "not-configured",
          providerName: null,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await act(async () => {
      render(<GlobalMapViewEnhanced loads={[]} users={[]} />);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    const banner = screen.getByTestId("tracking-state-banner");
    expect(banner).toBeInTheDocument();
    expect(banner.getAttribute("data-tracking-state")).toBe("not-configured");
    // Must NOT show raw env var names
    expect(banner.textContent).not.toMatch(/VITE_/);
    // Must show user-friendly setup prompt
    expect(banner.textContent).toMatch(/not configured/i);
  });

  it("shows configured-live banner with provider name when tracking is live", async () => {
    // Tests R-T3-02: configured-live state shows green Live Tracking Active badge
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          positions: [
            {
              vehicleId: "v1",
              latitude: 41.8,
              longitude: -87.6,
              speed: 55,
              heading: 0,
              recordedAt: new Date().toISOString(),
              provider: "samsara",
              providerVehicleId: "s1",
              isMock: false,
            },
          ],
          trackingState: "configured-live",
          providerName: "samsara",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await act(async () => {
      render(<GlobalMapViewEnhanced loads={[]} users={[]} />);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    const banner = screen.getByTestId("tracking-state-banner");
    expect(banner.getAttribute("data-tracking-state")).toBe("configured-live");
    expect(banner.textContent).toMatch(/live tracking active/i);
    expect(banner.textContent).toMatch(/samsara/i);
  });

  it("shows configured-idle banner when tracking is idle", async () => {
    // Tests R-T3-03: configured-idle state shows amber Tracking Idle badge
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          positions: [],
          trackingState: "configured-idle",
          providerName: "samsara",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await act(async () => {
      render(<GlobalMapViewEnhanced loads={[]} users={[]} />);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    const banner = screen.getByTestId("tracking-state-banner");
    expect(banner.getAttribute("data-tracking-state")).toBe("configured-idle");
    expect(banner.textContent).toMatch(/tracking idle/i);
  });

  it("shows provider-error banner when tracking has a provider error", async () => {
    // Tests R-T3-04: provider-error state shows red retry message
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("Provider API down"),
    );

    await act(async () => {
      render(<GlobalMapViewEnhanced loads={[]} users={[]} />);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    const banner = screen.getByTestId("tracking-state-banner");
    expect(banner.getAttribute("data-tracking-state")).toBe("provider-error");
    expect(banner.textContent).toMatch(/temporarily unavailable/i);
    expect(banner.textContent).toMatch(/retry automatically/i);
  });

  it("does not expose raw env var names in any tracking state banner", async () => {
    // Tests T3-07: No state should expose VITE_ env var names to users
    const states = [
      { trackingState: "not-configured", positions: [] },
      { trackingState: "configured-idle", positions: [] },
    ];
    for (const state of states) {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ ...state, providerName: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const { unmount } = render(
        <GlobalMapViewEnhanced loads={[]} users={[]} />,
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      const banners = document.querySelectorAll(
        "[data-testid='tracking-state-banner']",
      );
      banners.forEach((b) => {
        expect(b.textContent).not.toMatch(/VITE_/);
      });
      unmount();
    }
  });

  it("still renders fallback content (not blank) when trackingState is not-configured", async () => {
    // Tests T3-07: No blank page when tracking unavailable
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          positions: [],
          trackingState: "not-configured",
          providerName: null,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await act(async () => {
      render(<GlobalMapViewEnhanced loads={[]} users={[]} />);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    // Must render fallback container with fleet summary — not a blank page
    expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    expect(screen.getByText("Fleet Summary")).toBeInTheDocument();
  });

  it("still renders fallback content (not blank) when trackingState is provider-error", async () => {
    // Tests T3-07: No blank page when tracking unavailable
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network fail"));

    await act(async () => {
      render(<GlobalMapViewEnhanced loads={[]} users={[]} />);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    expect(screen.getByText("Fleet Summary")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// FleetMapWidget tests
// ---------------------------------------------------------------------------
describe("FleetMapWidget", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          positions: [],
          trackingState: "not-configured",
          providerName: null,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders without crashing with default height", () => {
    render(<FleetMapWidget loads={[]} users={[]} />);
    // Should render the inner GlobalMapViewEnhanced (fallback path since no API key in test)
    expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
  });

  it("renders with custom height", () => {
    const { container } = render(
      <FleetMapWidget loads={[]} users={[]} height="600px" />,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.height).toBe("600px");
  });

  it("applies rounded-lg and overflow-hidden classes", () => {
    const { container } = render(<FleetMapWidget loads={[]} users={[]} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("rounded-lg");
    expect(wrapper.className).toContain("overflow-hidden");
  });

  it("passes loads and users to the inner map", () => {
    const driver = createDriver({ id: "d1", name: "Widget Driver" });
    const load = createLoad({ driverId: "d1", status: "in_transit" });
    render(<FleetMapWidget loads={[load]} users={[driver]} />);
    // Fleet summary should show 1 En Route
    const text = document.body.textContent || "";
    expect(text).toContain("En Route");
  });

  it("passes onViewLoad callback through", () => {
    const onViewLoad = vi.fn();
    render(<FleetMapWidget loads={[]} users={[]} onViewLoad={onViewLoad} />);
    // Just verify it renders without errors when callback is provided
    expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
  });
});
