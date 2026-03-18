import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { GoogleMapsAPITester } from "../../../components/GoogleMapsAPITester";

// Mock all service dependencies
vi.mock("../../../services/geocodingService", () => ({
  geocodeAddress: vi.fn(),
}));

vi.mock("../../../services/distanceMatrixService", () => ({
  getDistanceMatrix: vi.fn(),
}));

vi.mock("../../../services/directionsService", () => ({
  getDirections: vi.fn(),
}));

vi.mock("../../../services/roadsService", () => ({
  snapToRoads: vi.fn(),
}));

// Mock lucide-react icons to simple spans
vi.mock("lucide-react", () => ({
  MapPin: (props: any) => <span data-testid="icon-map-pin" {...props} />,
  Navigation: (props: any) => (
    <span data-testid="icon-navigation" {...props} />
  ),
  Route: (props: any) => <span data-testid="icon-route" {...props} />,
  Search: (props: any) => <span data-testid="icon-search" {...props} />,
  Zap: (props: any) => <span data-testid="icon-zap" {...props} />,
  CheckCircle: (props: any) => (
    <span data-testid="icon-check-circle" {...props} />
  ),
  XCircle: (props: any) => <span data-testid="icon-x-circle" {...props} />,
  Loader: (props: any) => <span data-testid="icon-loader" {...props} />,
}));

import { geocodeAddress } from "../../../services/geocodingService";
import { getDistanceMatrix } from "../../../services/distanceMatrixService";
import { getDirections } from "../../../services/directionsService";
import { snapToRoads } from "../../../services/roadsService";

describe("GoogleMapsAPITester", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the header and title", () => {
    render(<GoogleMapsAPITester />);
    expect(screen.getByText("Google Maps API Tester")).toBeInTheDocument();
    expect(
      screen.getByText(/Testing Roads API, Distance Matrix API/),
    ).toBeInTheDocument();
  });

  it("renders the test route info", () => {
    render(<GoogleMapsAPITester />);
    expect(screen.getByText("Chicago, IL")).toBeInTheDocument();
    expect(screen.getByText("Milwaukee, WI")).toBeInTheDocument();
    expect(
      screen.getByText(/1600 Amphitheatre Parkway, Mountain View, CA/),
    ).toBeInTheDocument();
  });

  it("renders the run all tests button", () => {
    render(<GoogleMapsAPITester />);
    expect(
      screen.getByRole("button", { name: /Run All API Tests/i }),
    ).toBeInTheDocument();
  });

  it("shows empty state when no tests have been run", () => {
    render(<GoogleMapsAPITester />);
    expect(
      screen.getByText(/Click "Run All API Tests" to start testing/),
    ).toBeInTheDocument();
  });

  it("disables button while tests are running", async () => {
    // Make geocodeAddress hang forever to keep testing=true
    vi.mocked(geocodeAddress).mockImplementation(
      () => new Promise(() => {}),
    );

    render(<GoogleMapsAPITester />);
    const button = screen.getByRole("button", { name: /Run All API Tests/i });

    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toBeDisabled();
    });
  });

  it("shows success result when geocoding API succeeds", async () => {
    vi.mocked(geocodeAddress).mockResolvedValue({
      lat: 37.422,
      lng: -122.084,
      formattedAddress: "1600 Amphitheatre Parkway",
    });
    vi.mocked(getDistanceMatrix).mockImplementation(
      () => new Promise(() => {}),
    );

    render(<GoogleMapsAPITester />);
    fireEvent.click(
      screen.getByRole("button", { name: /Run All API Tests/i }),
    );

    await waitFor(() => {
      expect(screen.getByText("Geocoding API")).toBeInTheDocument();
    });
  });

  it("shows error result when geocoding API fails", async () => {
    vi.mocked(geocodeAddress).mockRejectedValue(
      new Error("API key invalid"),
    );
    vi.mocked(getDistanceMatrix).mockImplementation(
      () => new Promise(() => {}),
    );

    render(<GoogleMapsAPITester />);
    fireEvent.click(
      screen.getByRole("button", { name: /Run All API Tests/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(/API key invalid/)).toBeInTheDocument();
    });
  });

  it("runs all four API tests sequentially", async () => {
    vi.mocked(geocodeAddress).mockResolvedValue({
      lat: 37.422,
      lng: -122.084,
      formattedAddress: "1600 Amphitheatre Parkway",
    });
    vi.mocked(getDistanceMatrix).mockResolvedValue({
      distance: "92 mi",
      duration: "1h 30m",
    });
    vi.mocked(getDirections).mockResolvedValue({
      routes: [{ summary: "I-94 N" }],
    });
    vi.mocked(snapToRoads).mockResolvedValue([
      { lat: 41.879, lng: -87.629 },
      { lat: 43.038, lng: -87.906 },
    ]);

    render(<GoogleMapsAPITester />);
    fireEvent.click(
      screen.getByRole("button", { name: /Run All API Tests/i }),
    );

    await waitFor(
      () => {
        expect(screen.getByText("Geocoding API")).toBeInTheDocument();
        expect(screen.getByText("Distance Matrix API")).toBeInTheDocument();
        expect(screen.getByText("Directions API")).toBeInTheDocument();
        expect(screen.getByText("Roads API")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("displays summary section after tests run", async () => {
    vi.mocked(geocodeAddress).mockResolvedValue({
      lat: 37.422,
      lng: -122.084,
      formattedAddress: "Test",
    });
    vi.mocked(getDistanceMatrix).mockResolvedValue({ distance: "92 mi" });
    vi.mocked(getDirections).mockResolvedValue({ routes: [] });
    vi.mocked(snapToRoads).mockResolvedValue([]);

    render(<GoogleMapsAPITester />);
    fireEvent.click(
      screen.getByRole("button", { name: /Run All API Tests/i }),
    );

    await waitFor(
      () => {
        expect(screen.getByText("Summary")).toBeInTheDocument();
        expect(screen.getByText("Passed")).toBeInTheDocument();
        expect(screen.getByText("Failed")).toBeInTheDocument();
        expect(screen.getByText("Pending")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("displays response data in pre block on success", async () => {
    vi.mocked(geocodeAddress).mockResolvedValue({
      lat: 37.422,
      lng: -122.084,
      formattedAddress: "1600 Amphitheatre Parkway",
    });
    vi.mocked(getDistanceMatrix).mockImplementation(
      () => new Promise(() => {}),
    );

    render(<GoogleMapsAPITester />);
    fireEvent.click(
      screen.getByRole("button", { name: /Run All API Tests/i }),
    );

    await waitFor(() => {
      // The JSON data gets rendered in a <pre> element
      expect(screen.getByText(/37.422/)).toBeInTheDocument();
    });
  });
});
