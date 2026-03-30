/**
 * Fleet Map API Key Guard Tests
 *
 * Tests R-P6-05: Fleet Map shows user-friendly message when VITE_GOOGLE_MAPS_API_KEY is missing
 * Tests R-P6-06: Fleet Map loads Google Maps only when key is present
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock @react-google-maps/api — tracks whether LoadScript is rendered
const LoadScriptMock = vi.fn(
  ({ children }: { children: React.ReactNode }) => (
    <div data-testid="load-script">{children}</div>
  ),
);

vi.mock("@react-google-maps/api", () => ({
  LoadScript: (props: any) => LoadScriptMock(props),
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

import { GlobalMapViewEnhanced } from "../../../components/GlobalMapViewEnhanced";

// ---------------------------------------------------------------------------
// R-P6-05: Fleet Map shows user-friendly message when API key is missing
// ---------------------------------------------------------------------------
describe("R-P6-05: Fleet Map shows user-friendly message when VITE_GOOGLE_MAPS_API_KEY is missing", () => {
  // Tests R-P6-05

  beforeEach(() => {
    vi.useFakeTimers();
    LoadScriptMock.mockClear();
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

  it("renders fallback container with data-testid='map-fallback' when key is missing", () => {
    // VITE_GOOGLE_MAPS_API_KEY is empty in test env by default
    render(<GlobalMapViewEnhanced loads={[]} users={[]} />);
    const fallback = screen.getByTestId("map-fallback");
    expect(fallback).toBeInTheDocument();
  });

  it("shows 'Map Configuration Required' heading in fallback", () => {
    render(<GlobalMapViewEnhanced loads={[]} users={[]} />);
    const heading = screen.getByText("Map Configuration Required");
    expect(heading).toBeInTheDocument();
    expect(heading.tagName).toBe("H2");
  });

  it("displays admin contact message instead of raw env var name", () => {
    render(<GlobalMapViewEnhanced loads={[]} users={[]} />);
    const adminMsg = screen.getByText(/contact your administrator/i);
    expect(adminMsg).toBeInTheDocument();
  });

  it("does NOT expose VITE_GOOGLE_MAPS_API_KEY in user-visible banner text", () => {
    render(<GlobalMapViewEnhanced loads={[]} users={[]} />);
    const banner = screen.getByTestId("maps-api-key-error-banner");
    const primaryMessage = banner.querySelector("span");
    expect(primaryMessage?.textContent).not.toMatch(/VITE_GOOGLE_MAPS_API_KEY/);
  });

  it("renders error banner with role='alert' for accessibility", () => {
    render(<GlobalMapViewEnhanced loads={[]} users={[]} />);
    const banner = screen.getByTestId("maps-api-key-error-banner");
    expect(banner.getAttribute("role")).toBe("alert");
  });

  it("shows 'requires configuration' wording in banner", () => {
    render(<GlobalMapViewEnhanced loads={[]} users={[]} />);
    const banner = screen.getByTestId("maps-api-key-error-banner");
    expect(banner.textContent).toMatch(/requires configuration/i);
  });
});

// ---------------------------------------------------------------------------
// R-P6-06: Fleet Map loads Google Maps only when key is present
// ---------------------------------------------------------------------------
describe("R-P6-06: Fleet Map loads Google Maps only when key is present", () => {
  // Tests R-P6-06

  beforeEach(() => {
    vi.useFakeTimers();
    LoadScriptMock.mockClear();
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

  it("does NOT render LoadScript when API key is missing", () => {
    // VITE_GOOGLE_MAPS_API_KEY is empty in test env
    render(<GlobalMapViewEnhanced loads={[]} users={[]} />);
    // LoadScript should not be called because hasValidApiKey is false
    expect(LoadScriptMock).not.toHaveBeenCalled();
  });

  it("does NOT render GoogleMap component when API key is missing", () => {
    render(<GlobalMapViewEnhanced loads={[]} users={[]} />);
    expect(screen.queryByTestId("google-map")).not.toBeInTheDocument();
  });

  it("renders map-fallback instead of load-script when key absent", () => {
    render(<GlobalMapViewEnhanced loads={[]} users={[]} />);
    expect(screen.getByTestId("map-fallback")).toBeInTheDocument();
    expect(screen.queryByTestId("load-script")).not.toBeInTheDocument();
  });

  it("still shows fleet summary data in fallback view", () => {
    render(<GlobalMapViewEnhanced loads={[]} users={[]} />);
    expect(screen.getByText("Fleet Summary")).toBeInTheDocument();
    expect(screen.getByText("Online")).toBeInTheDocument();
    expect(screen.getByText("En Route")).toBeInTheDocument();
  });
});
