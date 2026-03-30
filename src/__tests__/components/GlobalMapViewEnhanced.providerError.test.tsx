/**
 * GlobalMapViewEnhanced -- provider error handling regression test
 *
 * Verifies that a non-OK /api/tracking/live response is surfaced as the
 * provider-error banner instead of being misclassified as "not configured".
 */

import React from "react";
import { render, screen, act } from "@testing-library/react";
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
} from "vitest";

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
  Marker: () => <div data-testid="map-marker" />,
  Polyline: () => <div data-testid="map-polyline" />,
  InfoWindow: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="info-window">{children}</div>
  ),
}));

vi.mock("../../../services/directionsService", () => ({
  getDirections: vi.fn().mockResolvedValue({ points: "" }),
}));

vi.mock("../../../services/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    postFormData: vi.fn(),
  },
}));

import { User, LoadData, LOAD_STATUS } from "../../../types";
import { api } from "../../../services/api";

const mockApiGet = api.get as ReturnType<typeof vi.fn>;

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

let GlobalMapViewEnhanced: typeof import("../../../components/GlobalMapViewEnhanced").GlobalMapViewEnhanced;

beforeAll(async () => {
  vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "12345678901");
  ({ GlobalMapViewEnhanced } =
    await import("../../../components/GlobalMapViewEnhanced"));
});

describe("GlobalMapViewEnhanced provider error handling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockApiGet.mockRejectedValue(new Error("API Request failed: 500"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows provider-error when live tracking returns a non-OK response", async () => {
    const driver = createDriver({ id: "d1" });
    const load = createLoad({ driverId: "d1", status: LOAD_STATUS.In_Transit });

    await act(async () => {
      render(<GlobalMapViewEnhanced loads={[load]} users={[driver]} />);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(mockApiGet).toHaveBeenCalledWith(
      "/tracking/live",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(
      screen.getByText(/tracking temporarily unavailable/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId("tracking-state-banner")).toHaveAttribute(
      "data-tracking-state",
      "provider-error",
    );
  });
});
