import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import {
  render,
  screen,
  act,
  waitFor,
  fireEvent,
} from "@testing-library/react";

/**
 * Tests R-P5-03, R-P5-04, R-P5-05, R-P5-06, R-P5-08
 *
 * Verifies StopList renders stops in sequence_order with facility_name,
 * city, state, appointment_time. Shows status-dependent action buttons
 * and color-coded status badges. Prompts document capture after completing
 * Pickup or Dropoff.
 */

// Mock react-native components
const mockAlert = vi.fn();
vi.mock("react-native", () => {
  const RN = {
    View: ({ children, style, testID, ...props }: any) =>
      React.createElement(
        "div",
        { "data-testid": testID, style, ...props },
        children,
      ),
    Text: ({ children, style, ...props }: any) =>
      React.createElement("span", { style, ...props }, children),
    Pressable: ({ children, onPress, style, ...props }: any) =>
      React.createElement(
        "button",
        { onClick: onPress, style, ...props },
        children,
      ),
    StyleSheet: { create: (s: any) => s },
    ActivityIndicator: ({ size, ...props }: any) =>
      React.createElement(
        "div",
        { "data-testid": "activity-indicator", ...props },
        "Loading...",
      ),
    Alert: { alert: (...args: any[]) => mockAlert(...args) },
  };
  return { ...RN, default: RN };
});

// Mock expo-router
const mockPush = vi.fn();
vi.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: () => {},
    back: () => {},
  }),
}));

// Mock stops service
const mockFetchStops = vi.fn();
const mockUpdateStopStatus = vi.fn();
vi.mock("../../src/services/stops", () => ({
  fetchStops: (...args: any[]) => mockFetchStops(...args),
  updateStopStatus: (...args: any[]) => mockUpdateStopStatus(...args),
}));

// Mock firebase config
vi.mock("../../src/config/firebase", () => ({
  auth: { currentUser: null },
}));

const sampleStops = [
  {
    id: "S1",
    load_id: "L1",
    type: "Pickup",
    facility_name: "Warehouse A",
    city: "Chicago",
    state: "IL",
    date: "2026-04-10",
    appointment_time: "08:00",
    completed: false,
    sequence_order: 1,
    status: "pending",
    arrived_at: null,
    departed_at: null,
  },
  {
    id: "S2",
    load_id: "L1",
    type: "Dropoff",
    facility_name: "Distribution Center B",
    city: "Dallas",
    state: "TX",
    date: "2026-04-12",
    appointment_time: "14:00",
    completed: false,
    sequence_order: 2,
    status: "arrived",
    arrived_at: "2026-04-10T08:15:00.000Z",
    departed_at: null,
  },
  {
    id: "S3",
    load_id: "L1",
    type: "Dropoff",
    facility_name: "Retail Store C",
    city: "Houston",
    state: "TX",
    date: "2026-04-13",
    appointment_time: null,
    completed: false,
    sequence_order: 3,
    status: "departed",
    arrived_at: "2026-04-12T14:00:00.000Z",
    departed_at: "2026-04-12T16:00:00.000Z",
  },
];

describe("R-P5-03: StopList renders stops in sequence_order", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // # Tests R-P5-03
  it("renders stops with facility_name, city, state, appointment_time", async () => {
    mockFetchStops.mockResolvedValueOnce(sampleStops);

    const { StopList } = await import("../../src/components/StopList");

    await act(async () => {
      render(React.createElement(StopList, { loadId: "L1" }));
    });

    await waitFor(() => {
      expect(screen.getByText("Warehouse A")).toBeTruthy();
    });

    // Facility names
    expect(screen.getByText("Warehouse A")).toBeTruthy();
    expect(screen.getByText("Distribution Center B")).toBeTruthy();
    expect(screen.getByText("Retail Store C")).toBeTruthy();

    // City, State
    expect(screen.getByText("Chicago, IL")).toBeTruthy();
    expect(screen.getByText("Dallas, TX")).toBeTruthy();
    expect(screen.getByText("Houston, TX")).toBeTruthy();

    // Appointment times
    expect(screen.getByText("08:00")).toBeTruthy();
    expect(screen.getByText("14:00")).toBeTruthy();
    expect(screen.getByText("No appointment")).toBeTruthy();
  });

  // # Tests R-P5-03
  it("calls fetchStops with the provided loadId", async () => {
    mockFetchStops.mockResolvedValueOnce(sampleStops);

    const { StopList } = await import("../../src/components/StopList");

    await act(async () => {
      render(React.createElement(StopList, { loadId: "L1" }));
    });

    await waitFor(() => {
      expect(mockFetchStops).toHaveBeenCalledWith("L1");
    });
  });
});

describe("R-P5-04: StopList shows status-dependent action buttons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // # Tests R-P5-04
  it("shows Arrive when pending, Depart when arrived, Complete when departed", async () => {
    mockFetchStops.mockResolvedValueOnce(sampleStops);

    const { StopList } = await import("../../src/components/StopList");

    await act(async () => {
      render(React.createElement(StopList, { loadId: "L1" }));
    });

    await waitFor(() => {
      expect(screen.getByText("Warehouse A")).toBeTruthy();
    });

    // pending stop shows Arrive
    expect(screen.getByText("Arrive")).toBeTruthy();

    // arrived stop shows Depart
    expect(screen.getByText("Depart")).toBeTruthy();

    // departed stop shows Complete
    expect(screen.getByText("Complete")).toBeTruthy();
  });

  // # Tests R-P5-04
  it("shows no action button when status is completed", async () => {
    const completedStops = [
      {
        id: "S4",
        load_id: "L2",
        type: "Pickup",
        facility_name: "Done Facility",
        city: "Miami",
        state: "FL",
        date: "2026-04-14",
        appointment_time: "09:00",
        completed: true,
        sequence_order: 1,
        status: "completed",
        arrived_at: "2026-04-14T09:00:00.000Z",
        departed_at: "2026-04-14T11:00:00.000Z",
      },
    ];

    mockFetchStops.mockResolvedValueOnce(completedStops);

    const { StopList } = await import("../../src/components/StopList");

    await act(async () => {
      render(React.createElement(StopList, { loadId: "L2" }));
    });

    await waitFor(() => {
      expect(screen.getByText("Done Facility")).toBeTruthy();
    });

    // No action buttons for completed stops
    expect(screen.queryByText("Arrive")).toBeNull();
    expect(screen.queryByText("Depart")).toBeNull();
    expect(screen.queryByText("Complete")).toBeNull();
  });
});

describe("R-P5-05: Pressing Arrive calls updateStopStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // # Tests R-P5-05
  it("calls updateStopStatus with {status:'arrived', arrived_at: ISO}", async () => {
    const pendingStop = [
      {
        id: "S1",
        load_id: "L1",
        type: "Pickup",
        facility_name: "Warehouse A",
        city: "Chicago",
        state: "IL",
        date: "2026-04-10",
        appointment_time: "08:00",
        completed: false,
        sequence_order: 1,
        status: "pending",
        arrived_at: null,
        departed_at: null,
      },
    ];

    mockFetchStops.mockResolvedValueOnce(pendingStop);
    mockUpdateStopStatus.mockResolvedValueOnce({
      ...pendingStop[0],
      status: "arrived",
      arrived_at: "2026-04-10T08:15:00.000Z",
    });

    const { StopList } = await import("../../src/components/StopList");

    await act(async () => {
      render(React.createElement(StopList, { loadId: "L1" }));
    });

    await waitFor(() => {
      expect(screen.getByText("Arrive")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Arrive"));
    });

    expect(mockUpdateStopStatus).toHaveBeenCalledWith("L1", "S1", {
      status: "arrived",
      arrived_at: expect.any(String),
    });

    // Verify the arrived_at is a valid ISO string
    const callArgs = mockUpdateStopStatus.mock.calls[0][2];
    expect(callArgs.arrived_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe("R-P5-06: StopList shows color-coded status badge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // # Tests R-P5-06
  it("shows status badges with correct labels for each status", async () => {
    mockFetchStops.mockResolvedValueOnce(sampleStops);

    const { StopList } = await import("../../src/components/StopList");

    await act(async () => {
      render(React.createElement(StopList, { loadId: "L1" }));
    });

    await waitFor(() => {
      expect(screen.getByText("Warehouse A")).toBeTruthy();
    });

    // Status badges rendered
    expect(screen.getByText("Pending")).toBeTruthy();
    expect(screen.getByText("Arrived")).toBeTruthy();
    expect(screen.getByText("Departed")).toBeTruthy();
  });

  // # Tests R-P5-06
  it("renders Completed badge for completed stops", async () => {
    const completedStops = [
      {
        id: "S4",
        load_id: "L2",
        type: "Pickup",
        facility_name: "Done Facility",
        city: "Miami",
        state: "FL",
        date: "2026-04-14",
        appointment_time: "09:00",
        completed: true,
        sequence_order: 1,
        status: "completed",
        arrived_at: "2026-04-14T09:00:00.000Z",
        departed_at: "2026-04-14T11:00:00.000Z",
      },
    ];

    mockFetchStops.mockResolvedValueOnce(completedStops);

    const { StopList } = await import("../../src/components/StopList");

    await act(async () => {
      render(React.createElement(StopList, { loadId: "L2" }));
    });

    await waitFor(() => {
      expect(screen.getByText("Done Facility")).toBeTruthy();
    });

    expect(screen.getByText("Completed")).toBeTruthy();
  });
});

describe("R-P5-08: StopList prompts Capture Document after completing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // # Tests R-P5-08
  it("shows Alert after completing a Pickup stop", async () => {
    const departedPickup = [
      {
        id: "S1",
        load_id: "L1",
        type: "Pickup",
        facility_name: "Warehouse A",
        city: "Chicago",
        state: "IL",
        date: "2026-04-10",
        appointment_time: "08:00",
        completed: false,
        sequence_order: 1,
        status: "departed",
        arrived_at: "2026-04-10T08:15:00.000Z",
        departed_at: "2026-04-10T10:30:00.000Z",
      },
    ];

    mockFetchStops.mockResolvedValueOnce(departedPickup);
    mockUpdateStopStatus.mockResolvedValueOnce({
      ...departedPickup[0],
      status: "completed",
      completed: true,
    });

    const { StopList } = await import("../../src/components/StopList");

    await act(async () => {
      render(React.createElement(StopList, { loadId: "L1" }));
    });

    await waitFor(() => {
      expect(screen.getByText("Complete")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Complete"));
    });

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith(
        "Capture Document",
        "Would you like to capture a document for this pickup?",
        expect.arrayContaining([
          expect.objectContaining({ text: "Skip" }),
          expect.objectContaining({ text: "Capture" }),
        ]),
      );
    });
  });

  // # Tests R-P5-08
  it("shows Alert after completing a Dropoff stop", async () => {
    const departedDropoff = [
      {
        id: "S2",
        load_id: "L1",
        type: "Dropoff",
        facility_name: "Distribution Center B",
        city: "Dallas",
        state: "TX",
        date: "2026-04-12",
        appointment_time: "14:00",
        completed: false,
        sequence_order: 1,
        status: "departed",
        arrived_at: "2026-04-12T14:00:00.000Z",
        departed_at: "2026-04-12T16:00:00.000Z",
      },
    ];

    mockFetchStops.mockResolvedValueOnce(departedDropoff);
    mockUpdateStopStatus.mockResolvedValueOnce({
      ...departedDropoff[0],
      status: "completed",
      completed: true,
    });

    const { StopList } = await import("../../src/components/StopList");

    await act(async () => {
      render(React.createElement(StopList, { loadId: "L1" }));
    });

    await waitFor(() => {
      expect(screen.getByText("Complete")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Complete"));
    });

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith(
        "Capture Document",
        "Would you like to capture a document for this dropoff?",
        expect.arrayContaining([
          expect.objectContaining({ text: "Skip" }),
          expect.objectContaining({ text: "Capture" }),
        ]),
      );
    });
  });
});
