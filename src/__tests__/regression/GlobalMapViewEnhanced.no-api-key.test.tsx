/**
 * Sales-Demo Regression Guard — GlobalMapViewEnhanced fallback DOM
 *
 * Context: A prior demo build exposed the raw environment variable name
 * "VITE_GOOGLE_MAPS_API_KEY" in a user-facing red banner when the API key
 * was missing. The fix in commit 5f19242 (feat(S-6.2): guard Fleet Map
 * against missing API key) replaced the banner with a friendly "Map
 * Configuration Required" card that contacts an administrator instead.
 *
 * This test locks the fix: in the fallback render (no API key), the
 * rendered DOM text must NOT contain the literal string
 * "VITE_GOOGLE_MAPS_API_KEY".
 *
 * Tests R-P5-03
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GlobalMapViewEnhanced } from "../../../components/GlobalMapViewEnhanced";

// Mock @react-google-maps/api — still loaded even in fallback path.
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

describe("GlobalMapViewEnhanced regression guard — no API key (R-P5-03)", () => {
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

  it("fallback DOM never contains the substring 'VITE_GOOGLE_MAPS_API_KEY'", () => {
    // Tests R-P5-03: locks the 'raw env var name leaked to user-facing banner'
    //                regression fix from commit 5f19242.
    //
    // Precondition for this test to exercise the fallback path:
    // VITE_GOOGLE_MAPS_API_KEY is empty in the vitest environment (checked
    // by asserting the map-fallback testid renders below).
    const { container } = render(
      <GlobalMapViewEnhanced loads={[]} users={[]} />,
    );

    // Sanity: we really are in the fallback render (prevents the test from
    // silently passing if the component swaps to the real map path).
    expect(screen.getByTestId("map-fallback")).toBeInTheDocument();

    // Hard assertion: the forbidden env var name must not appear in the
    // rendered DOM text anywhere.
    const renderedText = container.textContent ?? "";
    expect(renderedText).not.toContain("VITE_GOOGLE_MAPS_API_KEY");

    // Belt-and-suspenders: the friendly replacement message must be present,
    // confirming the fix (not just a silent empty render) is in place.
    expect(screen.getByText("Map Configuration Required")).toBeInTheDocument();
    expect(screen.getByText(/contact your administrator/i)).toBeInTheDocument();
  });
});
