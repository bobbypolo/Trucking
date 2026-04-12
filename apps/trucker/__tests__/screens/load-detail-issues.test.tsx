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
 * Tests R-P7-07
 *
 * Verifies Load detail shows Report Issue Pressable that opens IssueReportForm modal.
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
    Pressable: ({ children, onPress, style, disabled, ...props }: any) =>
      React.createElement(
        "button",
        {
          onClick: onPress,
          disabled,
          "aria-label": props.accessibilityLabel,
          ...props,
        },
        children,
      ),
    ScrollView: ({ children, ...props }: any) =>
      React.createElement("div", props, children),
    Modal: ({ children, visible, ...props }: any) =>
      visible
        ? React.createElement(
            "div",
            { "data-testid": "modal", ...props },
            children,
          )
        : null,
    TextInput: ({ value, onChangeText, placeholder, ...props }: any) =>
      React.createElement("textarea", {
        value,
        onChange: (e: any) => onChangeText?.(e.target.value),
        placeholder,
        "aria-label": props.accessibilityLabel,
        ...props,
      }),
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
    replace: vi.fn(),
    back: vi.fn(),
  }),
  useLocalSearchParams: () => ({ id: "L1" }),
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

// Mock StopList component
vi.mock("../../src/components/StopList", () => ({
  StopList: (props: any) =>
    React.createElement(
      "div",
      { "data-testid": "stop-list" },
      `StopList for ${props.loadId}`,
    ),
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

// Mock reportIssue (used by IssueReportForm)
const mockReportIssue = vi.fn();
vi.mock("../../src/services/issues", () => ({
  reportIssue: (...args: any[]) => mockReportIssue(...args),
}));

// Mock connectivity (transitive dependency)
vi.mock("../../src/services/connectivity", () => ({
  getIsOnline: () => true,
}));

// Mock uploadQueue (transitive dependency)
vi.mock("../../src/services/uploadQueue", () => ({
  processQueue: vi.fn().mockResolvedValue(undefined),
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

describe("R-P7-07: Load detail shows Report Issue Pressable opening IssueReportForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchLoadById.mockResolvedValue(sampleLoad);
    mockFetchDocuments.mockResolvedValue([]);
  });

  // # Tests R-P7-07
  it("renders Report Issue button on load detail screen", async () => {
    let LoadDetailScreen: any;
    await act(async () => {
      const mod = await import("../../src/app/(tabs)/loads/[id]");
      LoadDetailScreen = mod.default;
    });

    await act(async () => {
      render(<LoadDetailScreen />);
    });

    await waitFor(() => {
      expect(screen.getByText("Report Issue")).toBeTruthy();
    });

    const reportBtn = screen.getByLabelText("Report Issue");
    expect(reportBtn).toBeTruthy();
  });

  // # Tests R-P7-07
  it("opens IssueReportForm modal when Report Issue is pressed", async () => {
    let LoadDetailScreen: any;
    await act(async () => {
      const mod = await import("../../src/app/(tabs)/loads/[id]");
      LoadDetailScreen = mod.default;
    });

    await act(async () => {
      render(<LoadDetailScreen />);
    });

    await waitFor(() => {
      expect(screen.getByText("Report Issue")).toBeTruthy();
    });

    // Modal should not be visible initially
    expect(screen.queryByTestId("modal")).toBeNull();

    // Press Report Issue button
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Report Issue"));
    });

    // Modal should now be visible with IssueReportForm content
    await waitFor(() => {
      expect(screen.getByTestId("modal")).toBeTruthy();
    });

    // Verify it contains the IssueReportForm elements
    expect(screen.getByText("Issue Type")).toBeTruthy();
    expect(screen.getByText("Breakdown")).toBeTruthy();
    expect(screen.getByText("Delay")).toBeTruthy();
    expect(screen.getByText("Detention")).toBeTruthy();
    expect(screen.getByText("Lumper")).toBeTruthy();
    expect(screen.getByText("Other")).toBeTruthy();
  });
});
