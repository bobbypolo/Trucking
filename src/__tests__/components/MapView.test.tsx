import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { MapView } from "../../../components/MapView";
import { LoadData, LOAD_STATUS } from "../../../types";

function makeLoad(overrides: Partial<LoadData> = {}): LoadData {
  return {
    id: "load-1",
    companyId: "co-1",
    driverId: "drv-1",
    loadNumber: "LD-100",
    status: "in_transit",
    carrierRate: 2500,
    driverPay: 1200,
    pickupDate: "2026-03-10",
    pickup: { city: "Dallas", state: "TX" },
    dropoff: { city: "Houston", state: "TX" },
    commodity: "Electronics",
    onboardingStatus: "Completed",
    safetyScore: 95,
    ...overrides,
  } as LoadData;
}

function makeLoadWithLegs(
  overrides: Partial<LoadData> = {},
  legs: Array<{ latitude: number | null; longitude: number | null }> = [],
): LoadData {
  return {
    ...makeLoad(overrides),
    legs,
  } as any;
}

describe("MapView", () => {
  it("renders the map container", () => {
    render(<MapView loads={[]} />);
    // Should render the status legend
    expect(screen.getByText("Moving")).toBeInTheDocument();
    expect(screen.getByText("Stopped")).toBeInTheDocument();
    expect(screen.getByText("Planned")).toBeInTheDocument();
  });

  it("renders zoom controls", () => {
    render(<MapView loads={[]} />);
    expect(screen.getByText("+")).toBeInTheDocument();
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("shows no-coordinates message when loads exist but have no geocoded stops", () => {
    const loads = [makeLoad({ id: "1" }), makeLoad({ id: "2" })];
    render(<MapView loads={loads} />);
    expect(
      screen.getByText("No geocoded stop coordinates available"),
    ).toBeInTheDocument();
  });

  it("does not show no-coordinates message when loads array is empty", () => {
    render(<MapView loads={[]} />);
    expect(
      screen.queryByText("No geocoded stop coordinates available"),
    ).not.toBeInTheDocument();
  });

  it("filters out delivered and cancelled loads from markers", () => {
    const loads = [
      makeLoadWithLegs({ id: "1", status: LOAD_STATUS.Delivered as any }, [
        { latitude: 32.7, longitude: -96.8 },
      ]),
      makeLoadWithLegs({ id: "2", status: LOAD_STATUS.Cancelled as any }, [
        { latitude: 30.3, longitude: -97.7 },
      ]),
    ];
    render(<MapView loads={loads} />);
    // No markers should appear (all loads are delivered/cancelled)
    // The no-coordinates message should show since there are loads but no valid positioned ones
    expect(
      screen.getByText("No geocoded stop coordinates available"),
    ).toBeInTheDocument();
  });

  it("renders markers for loads with valid leg coordinates", () => {
    const loads = [
      makeLoadWithLegs(
        { id: "1", loadNumber: "LD-200", status: "in_transit" },
        [{ latitude: 32.7767, longitude: -96.797 }],
      ),
      makeLoadWithLegs({ id: "2", loadNumber: "LD-201", status: "planned" }, [
        { latitude: 30.2672, longitude: -97.7431 },
      ]),
    ];
    render(<MapView loads={loads} />);
    // Markers include tooltips with load numbers (may appear in tooltip + telemetry)
    expect(screen.getAllByText("Load #LD-200").length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.getAllByText("Load #LD-201").length).toBeGreaterThanOrEqual(
      1,
    );
  });

  it("shows commodity in marker tooltip", () => {
    const loads = [
      makeLoadWithLegs(
        {
          id: "1",
          loadNumber: "LD-300",
          status: "in_transit",
          commodity: "Frozen Goods",
        },
        [{ latitude: 35.0, longitude: -90.0 }],
      ),
    ];
    render(<MapView loads={loads} />);
    expect(screen.getAllByText("Frozen Goods").length).toBeGreaterThanOrEqual(
      1,
    );
  });

  it("shows General Freight when commodity is not set", () => {
    const loads = [
      makeLoadWithLegs(
        {
          id: "1",
          loadNumber: "LD-400",
          status: "in_transit",
          commodity: undefined,
        },
        [{ latitude: 35.0, longitude: -90.0 }],
      ),
    ];
    render(<MapView loads={loads} />);
    // "General Freight" appears both in the marker tooltip and in the telemetry overlay
    expect(
      screen.getAllByText("General Freight").length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("skips legs with null coordinates", () => {
    const loads = [
      makeLoadWithLegs(
        { id: "1", loadNumber: "LD-500", status: "in_transit" },
        [
          { latitude: null, longitude: null },
          { latitude: 33.0, longitude: -97.0 },
        ],
      ),
    ];
    render(<MapView loads={loads} />);
    // Should still render marker using the second leg with valid coords
    expect(screen.getAllByText("Load #LD-500").length).toBeGreaterThanOrEqual(
      1,
    );
  });

  it("renders live telemetry section for active loads", () => {
    const loads = [
      makeLoadWithLegs(
        { id: "1", loadNumber: "LD-600", status: LOAD_STATUS.Active as any },
        [{ latitude: 32.0, longitude: -96.0 }],
      ),
    ];
    render(<MapView loads={loads} />);
    expect(screen.getByText("Live Telemetry")).toBeInTheDocument();
    expect(screen.getAllByText("Load #LD-600").length).toBeGreaterThanOrEqual(
      1,
    );
  });

  it("renders pulse effect for active loads only", () => {
    const loads = [
      makeLoadWithLegs({ id: "1", status: LOAD_STATUS.Active as any }, [
        { latitude: 32.0, longitude: -96.0 },
      ]),
    ];
    const { container } = render(<MapView loads={loads} />);
    const pulseElements = container.querySelectorAll(".animate-ping");
    expect(pulseElements.length).toBeGreaterThanOrEqual(1);
  });

  it("does not render pulse effect for planned loads", () => {
    const loads = [
      makeLoadWithLegs({ id: "1", status: "planned" }, [
        { latitude: 32.0, longitude: -96.0 },
      ]),
    ];
    const { container } = render(<MapView loads={loads} />);
    const pulseElements = container.querySelectorAll(".animate-ping");
    expect(pulseElements.length).toBe(0);
  });

  it("hides live telemetry overlay when trackingState is not-configured", () => {
    // Tests R-T3-05: MapView hides fake Live Telemetry when tracking not configured
    const loads = [
      makeLoadWithLegs(
        { id: "1", loadNumber: "LD-700", status: LOAD_STATUS.Active as any },
        [{ latitude: 32.0, longitude: -96.0 }],
      ),
    ];
    render(<MapView loads={loads} trackingState="not-configured" />);
    // Live Telemetry label must not appear
    expect(screen.queryByText("Live Telemetry")).not.toBeInTheDocument();
    // Should show route information fallback instead
    expect(screen.getByTestId("route-info-overlay")).toBeInTheDocument();
    expect(
      screen.getByText(/route information based on scheduled stops/i),
    ).toBeInTheDocument();
  });

  it("shows live telemetry overlay when trackingState is configured-live", () => {
    const loads = [
      makeLoadWithLegs(
        { id: "1", loadNumber: "LD-800", status: LOAD_STATUS.Active as any },
        [{ latitude: 32.0, longitude: -96.0 }],
      ),
    ];
    render(<MapView loads={loads} trackingState="configured-live" />);
    expect(screen.getByText("Live Telemetry")).toBeInTheDocument();
  });

  it("shows live telemetry when no trackingState prop (default behaviour)", () => {
    // Tests backward compatibility: no trackingState prop = show telemetry (default was true)
    const loads = [
      makeLoadWithLegs(
        { id: "1", loadNumber: "LD-900", status: LOAD_STATUS.Active as any },
        [{ latitude: 32.0, longitude: -96.0 }],
      ),
    ];
    render(<MapView loads={loads} />);
    expect(screen.getByText("Live Telemetry")).toBeInTheDocument();
  });
});
