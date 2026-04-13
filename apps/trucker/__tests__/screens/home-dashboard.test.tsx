import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, act, waitFor } from "@testing-library/react";

/**
 * Tests R-P9-01, R-P9-02, R-P9-03, R-P9-04
 *
 * Verifies the HomeScreen dashboard cards:
 * - Next Stop card with facility and appointment time
 * - Open Issues card with count
 * - Latest Pay card with settlement amount and status
 * - Empty state placeholders when no data
 */

// Mock react-native components
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
    ScrollView: ({ children, ...props }: any) =>
      React.createElement("div", props, children),
    ActivityIndicator: ({ size, ...props }: any) =>
      React.createElement(
        "div",
        { "data-testid": "activity-indicator", ...props },
        "Loading...",
      ),
    StyleSheet: { create: (s: any) => s },
    Pressable: ({ children, onPress, ...props }: any) =>
      React.createElement("button", { onClick: onPress, ...props }, children),
  };
  return { ...RN, default: RN };
});

// Mock expo-router
vi.mock("expo-router", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  Tabs: Object.assign(
    ({ children }: any) => React.createElement("div", null, children),
    {
      Screen: ({ name }: any) => React.createElement("div", null, name),
    },
  ),
}));

// Mock services
const mockFetchLoads = vi.fn();
const mockGetQueueItems = vi.fn();
const mockFetchStops = vi.fn();
const mockFetchDriverExceptions = vi.fn();
const mockFetchSettlements = vi.fn();

vi.mock("../../src/services/loads", () => ({
  fetchLoads: (...args: any[]) => mockFetchLoads(...args),
}));

vi.mock("../../src/services/uploadQueue", () => ({
  getQueueItems: (...args: any[]) => mockGetQueueItems(...args),
}));

vi.mock("../../src/services/stops", () => ({
  fetchStops: (...args: any[]) => mockFetchStops(...args),
}));

vi.mock("../../src/services/issues", () => ({
  fetchDriverExceptions: (...args: any[]) => mockFetchDriverExceptions(...args),
}));

vi.mock("../../src/services/settlements", () => ({
  fetchSettlements: (...args: any[]) => mockFetchSettlements(...args),
}));

vi.mock("../../src/types/settlement", () => ({}));

// Sample data
const sampleLoads = [
  {
    id: "load-1",
    status: "dispatched",
    pickup_date: "2026-04-10",
    legs: [
      {
        type: "Pickup",
        city: "Dallas",
        state: "TX",
        facility_name: "Warehouse A",
        date: "2026-04-10",
        sequence_order: 1,
      },
    ],
  },
];

const sampleStops = [
  {
    id: "stop-1",
    load_id: "load-1",
    type: "Pickup",
    facility_name: "Warehouse A",
    city: "Dallas",
    state: "TX",
    date: "2026-04-10",
    appointment_time: "08:00 AM",
    completed: false,
    sequence_order: 1,
    status: "pending",
    arrived_at: null,
    departed_at: null,
  },
  {
    id: "stop-2",
    load_id: "load-1",
    type: "Dropoff",
    facility_name: "Distribution Center B",
    city: "Houston",
    state: "TX",
    date: "2026-04-11",
    appointment_time: "02:00 PM",
    completed: false,
    sequence_order: 2,
    status: "pending",
    arrived_at: null,
    departed_at: null,
  },
];

const sampleExceptions = [
  {
    id: "exc-1",
    issue_type: "Delay",
    load_id: "load-1",
    description: "Traffic jam",
    photo_urls: [],
    status: "OPEN",
    created_at: "2026-04-10T10:00:00Z",
  },
  {
    id: "exc-2",
    issue_type: "Breakdown",
    load_id: "load-1",
    description: "Tire blowout",
    photo_urls: [],
    status: "OPEN",
    created_at: "2026-04-10T11:00:00Z",
  },
];

const sampleSettlements = [
  {
    id: "set-001",
    company_id: "co-1",
    driver_id: "drv-1",
    settlement_date: "2026-04-01",
    period_start: "2026-03-16",
    period_end: "2026-03-31",
    total_earnings: 2500.0,
    total_deductions: 350.0,
    total_reimbursements: 100.0,
    net_pay: 2250.0,
    status: "Approved",
    lines: [],
  },
];

describe("R-P9-01: Dashboard displays Next Stop card", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  // # Tests R-P9-01
  it("renders Next Stop card with facility name and appointment time", async () => {
    mockFetchLoads.mockResolvedValueOnce(sampleLoads);
    mockGetQueueItems.mockResolvedValueOnce([]);
    mockFetchStops.mockResolvedValueOnce(sampleStops);
    mockFetchDriverExceptions.mockResolvedValueOnce([]);
    mockFetchSettlements.mockResolvedValueOnce([]);

    const HomeScreen = (await import("../../src/app/(tabs)/index")).default;

    await act(async () => {
      render(React.createElement(HomeScreen));
    });

    await waitFor(() => {
      expect(screen.getByText("Next Stop")).toBeTruthy();
    });

    // Facility name of the first pending stop
    expect(screen.getByText("Warehouse A")).toBeTruthy();
    // Appointment time
    expect(screen.getByText("08:00 AM")).toBeTruthy();
  });
});

describe("R-P9-02: Dashboard displays Open Issues card", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  // # Tests R-P9-02
  it("renders Open Issues card with count of 2", async () => {
    mockFetchLoads.mockResolvedValueOnce(sampleLoads);
    mockGetQueueItems.mockResolvedValueOnce([]);
    mockFetchStops.mockResolvedValueOnce([]);
    mockFetchDriverExceptions.mockResolvedValueOnce(sampleExceptions);
    mockFetchSettlements.mockResolvedValueOnce([]);

    const HomeScreen = (await import("../../src/app/(tabs)/index")).default;

    await act(async () => {
      render(React.createElement(HomeScreen));
    });

    await waitFor(() => {
      expect(screen.getByText("Open Issues")).toBeTruthy();
    });

    // Count should be 2
    expect(screen.getByText("2")).toBeTruthy();
  });
});

describe("R-P9-03: Dashboard displays Latest Pay card", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  // # Tests R-P9-03
  it("renders Latest Pay card with settlement amount and status", async () => {
    mockFetchLoads.mockResolvedValueOnce(sampleLoads);
    mockGetQueueItems.mockResolvedValueOnce([]);
    mockFetchStops.mockResolvedValueOnce([]);
    mockFetchDriverExceptions.mockResolvedValueOnce([]);
    mockFetchSettlements.mockResolvedValueOnce(sampleSettlements);

    const HomeScreen = (await import("../../src/app/(tabs)/index")).default;

    await act(async () => {
      render(React.createElement(HomeScreen));
    });

    await waitFor(() => {
      expect(screen.getByText("Latest Pay")).toBeTruthy();
    });

    // Net pay amount
    expect(screen.getByText("$2,250.00")).toBeTruthy();
    // Status
    expect(screen.getByText("Approved")).toBeTruthy();
  });
});

describe("R-P9-04: Dashboard empty state placeholders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  // # Tests R-P9-04
  it("shows empty state placeholders when no data exists", async () => {
    mockFetchLoads.mockResolvedValueOnce([]);
    mockGetQueueItems.mockResolvedValueOnce([]);
    mockFetchStops.mockResolvedValueOnce([]);
    mockFetchDriverExceptions.mockResolvedValueOnce([]);
    mockFetchSettlements.mockResolvedValueOnce([]);

    const HomeScreen = (await import("../../src/app/(tabs)/index")).default;

    await act(async () => {
      render(React.createElement(HomeScreen));
    });

    await waitFor(() => {
      expect(screen.getByText("Next Stop")).toBeTruthy();
    });

    // Empty state messages
    expect(screen.getByText("No active stops")).toBeTruthy();
    expect(screen.getByText("No open issues")).toBeTruthy();
    expect(screen.getByText("No settlements yet")).toBeTruthy();
  });
});
