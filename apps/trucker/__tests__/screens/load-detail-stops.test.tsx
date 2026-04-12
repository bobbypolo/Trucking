import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, act, waitFor } from "@testing-library/react";

/**
 * Tests R-P5-07, R-P5-09
 *
 * Verifies Load detail renders StopList with the current load ID.
 * Verifies Load detail shows document checklist section listing
 * required doc types (BOL, POD) with present/missing indicators.
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
    FlatList: ({ data, renderItem, keyExtractor, ListEmptyComponent }: any) => {
      if (!data || data.length === 0) {
        return React.createElement(
          "div",
          { "data-testid": "flatlist-empty" },
          typeof ListEmptyComponent === "function"
            ? React.createElement(ListEmptyComponent)
            : ListEmptyComponent,
        );
      }
      return React.createElement(
        "div",
        { "data-testid": "flatlist" },
        data.map((item: any, index: number) =>
          React.createElement(
            "div",
            {
              key: keyExtractor ? keyExtractor(item, index) : index,
              "data-testid": `flatlist-item-${index}`,
            },
            renderItem({ item, index }),
          ),
        ),
      );
    },
    Pressable: ({ children, onPress, style, ...props }: any) =>
      React.createElement(
        "button",
        { onClick: onPress, style, ...props },
        children,
      ),
    ScrollView: ({ children, ...props }: any) =>
      React.createElement("div", props, children),
    StyleSheet: { create: (s: any) => s },
    ActivityIndicator: ({ size, ...props }: any) =>
      React.createElement(
        "div",
        { "data-testid": "activity-indicator", ...props },
        "Loading...",
      ),
    Alert: { alert: vi.fn() },
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
  useLocalSearchParams: () => ({ id: "L1" }),
  useFocusEffect: (cb: any) => {
    // Call the callback immediately for test purposes
    cb();
  },
  Tabs: Object.assign(
    ({ children }: any) => React.createElement("div", null, children),
    {
      Screen: ({ name }: any) => React.createElement("div", null, name),
    },
  ),
}));

// Mock firebase config
vi.mock("../../src/config/firebase", () => ({
  auth: { currentUser: null },
}));

// Mock fetchLoadById
const mockFetchLoadById = vi.fn();
vi.mock("../../src/services/loads", () => ({
  fetchLoadById: (...args: any[]) => mockFetchLoadById(...args),
  fetchLoads: vi.fn().mockResolvedValue([]),
}));

// Mock StopList component to verify it receives loadId
const mockStopListRender = vi.fn();
vi.mock("../../src/components/StopList", () => ({
  StopList: (props: any) => {
    mockStopListRender(props);
    return React.createElement(
      "div",
      { "data-testid": "stop-list" },
      `StopList for ${props.loadId}`,
    );
  },
}));

// Mock DocumentList
vi.mock("../../src/components/DocumentList", () => ({
  DocumentList: ({ loadId }: any) =>
    React.createElement(
      "div",
      { "data-testid": "document-list" },
      `DocumentList for ${loadId}`,
    ),
}));

// Mock StatusUpdateButton
vi.mock("../../src/components/StatusUpdateButton", () => ({
  StatusUpdateButton: () =>
    React.createElement("div", { "data-testid": "status-update-button" }),
}));

// Mock useLoadStatus hook
vi.mock("../../src/hooks/useLoadStatus", () => ({
  useLoadStatus: () => ({
    status: "in_transit",
    updating: false,
    error: null,
    transitionTo: vi.fn(),
  }),
}));

// Mock fetchDocuments from stops service
const mockFetchDocuments = vi.fn();
vi.mock("../../src/services/stops", () => ({
  fetchStops: vi.fn().mockResolvedValue([]),
  updateStopStatus: vi.fn(),
  fetchDocuments: (...args: any[]) => mockFetchDocuments(...args),
}));

const sampleLoad = {
  id: "L1",
  status: "in_transit" as const,
  pickup_date: "2026-04-10",
  legs: [
    {
      type: "Pickup" as const,
      city: "Chicago",
      state: "IL",
      facility_name: "Warehouse A",
      date: "2026-04-10",
      sequence_order: 1,
    },
    {
      type: "Dropoff" as const,
      city: "Dallas",
      state: "TX",
      facility_name: "Distribution Center B",
      date: "2026-04-12",
      sequence_order: 2,
    },
  ],
};

describe("R-P5-07: Load detail renders StopList with current load ID", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // # Tests R-P5-07
  it("renders StopList component and passes load ID", async () => {
    mockFetchLoadById.mockResolvedValueOnce(sampleLoad);
    mockFetchDocuments.mockResolvedValueOnce([]);

    const LoadDetailScreen = (await import("../../src/app/(tabs)/loads/[id]"))
      .default;

    await act(async () => {
      render(React.createElement(LoadDetailScreen));
    });

    await waitFor(() => {
      expect(screen.getByTestId("stop-list")).toBeTruthy();
    });

    // StopList receives the correct loadId prop
    expect(mockStopListRender).toHaveBeenCalledWith(
      expect.objectContaining({ loadId: "L1" }),
    );

    // StopList rendered with the right loadId text
    expect(screen.getByText("StopList for L1")).toBeTruthy();
  });

  // # Tests R-P5-07
  it("renders Stops section label", async () => {
    mockFetchLoadById.mockResolvedValueOnce(sampleLoad);
    mockFetchDocuments.mockResolvedValueOnce([]);

    const LoadDetailScreen = (await import("../../src/app/(tabs)/loads/[id]"))
      .default;

    await act(async () => {
      render(React.createElement(LoadDetailScreen));
    });

    await waitFor(() => {
      expect(screen.getByText("Stops")).toBeTruthy();
    });
  });
});

describe("R-P5-09: Load detail shows document checklist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // # Tests R-P5-09
  it("shows BOL as Present and POD as Missing when only BOL exists", async () => {
    mockFetchLoadById.mockResolvedValueOnce(sampleLoad);
    mockFetchDocuments.mockResolvedValueOnce([
      { id: "doc-1", document_type: "BOL" },
    ]);

    const LoadDetailScreen = (await import("../../src/app/(tabs)/loads/[id]"))
      .default;

    await act(async () => {
      render(React.createElement(LoadDetailScreen));
    });

    await waitFor(() => {
      expect(screen.getByText("Document Checklist")).toBeTruthy();
    });

    // BOL and POD labels rendered
    expect(screen.getByText("BOL")).toBeTruthy();
    expect(screen.getByText("POD")).toBeTruthy();

    // BOL Present, POD Missing
    expect(screen.getByText("Present")).toBeTruthy();
    expect(screen.getByText("Missing")).toBeTruthy();
  });

  // # Tests R-P5-09
  it("shows both BOL and POD as Present when both exist", async () => {
    mockFetchLoadById.mockResolvedValueOnce(sampleLoad);
    mockFetchDocuments.mockResolvedValueOnce([
      { id: "doc-1", document_type: "BOL" },
      { id: "doc-2", document_type: "POD" },
    ]);

    const LoadDetailScreen = (await import("../../src/app/(tabs)/loads/[id]"))
      .default;

    await act(async () => {
      render(React.createElement(LoadDetailScreen));
    });

    await waitFor(() => {
      expect(screen.getByText("Document Checklist")).toBeTruthy();
    });

    const presentElements = screen.getAllByText("Present");
    expect(presentElements).toHaveLength(2);
    expect(screen.queryByText("Missing")).toBeNull();
  });

  // # Tests R-P5-09
  it("shows both BOL and POD as Missing when no documents exist", async () => {
    mockFetchLoadById.mockResolvedValueOnce(sampleLoad);
    mockFetchDocuments.mockResolvedValueOnce([]);

    const LoadDetailScreen = (await import("../../src/app/(tabs)/loads/[id]"))
      .default;

    await act(async () => {
      render(React.createElement(LoadDetailScreen));
    });

    await waitFor(() => {
      expect(screen.getByText("Document Checklist")).toBeTruthy();
    });

    const missingElements = screen.getAllByText("Missing");
    expect(missingElements).toHaveLength(2);
    expect(screen.queryByText("Present")).toBeNull();
  });

  // # Tests R-P5-09
  it("calls fetchDocuments with the load ID", async () => {
    mockFetchLoadById.mockResolvedValueOnce(sampleLoad);
    mockFetchDocuments.mockResolvedValueOnce([]);

    const LoadDetailScreen = (await import("../../src/app/(tabs)/loads/[id]"))
      .default;

    await act(async () => {
      render(React.createElement(LoadDetailScreen));
    });

    await waitFor(() => {
      expect(mockFetchDocuments).toHaveBeenCalledWith("L1");
    });
  });
});
