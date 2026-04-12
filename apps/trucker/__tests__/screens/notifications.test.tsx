import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, act, waitFor } from "@testing-library/react";

/**
 * Tests R-P1-04, R-P1-05
 *
 * Verifies NotificationsScreen renders a FlatList with notification items
 * showing message and sent_at, and supports pull-to-refresh.
 */

// Mock react-native components as simple HTML elements
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
    FlatList: ({
      data,
      renderItem,
      keyExtractor,
      refreshControl,
      ListEmptyComponent,
    }: any) => {
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
        refreshControl,
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
    StyleSheet: {
      create: (styles: any) => styles,
    },
    ActivityIndicator: ({ size, ...props }: any) =>
      React.createElement(
        "div",
        { "data-testid": "activity-indicator", ...props },
        "Loading...",
      ),
    RefreshControl: ({ refreshing, onRefresh, ...props }: any) =>
      React.createElement("div", {
        "data-testid": "refresh-control",
        "data-refreshing": String(refreshing),
        onClick: onRefresh,
        ...props,
      }),
  };
  return { ...RN, default: RN };
});

// Mock fetchNotifications
const mockFetchNotifications = vi.fn();
vi.mock("../../src/services/notifications", () => ({
  fetchNotifications: (...args: any[]) => mockFetchNotifications(...args),
}));

// Mock the notification type (not needed at runtime, but keeps TS happy)
vi.mock("../../src/types/notification", () => ({}));

const sampleNotifications = [
  {
    id: "notif-1",
    channel: "push",
    message: "Load #1234 assigned to you",
    status: "SENT",
    sent_at: "2026-04-12T10:00:00Z",
    created_at: "2026-04-12T09:59:00Z",
  },
  {
    id: "notif-2",
    channel: "email",
    message: "Settlement #5678 approved",
    status: "SENT",
    sent_at: "2026-04-12T11:30:00Z",
    created_at: "2026-04-12T11:29:00Z",
  },
];

describe("R-P1-04: NotificationsScreen renders FlatList with items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // # Tests R-P1-04
  it("renders one item per notification showing message and sent_at", async () => {
    mockFetchNotifications.mockResolvedValueOnce(sampleNotifications);

    const NotificationsScreen = (
      await import("../../src/app/(tabs)/notifications")
    ).default;

    await act(async () => {
      render(React.createElement(NotificationsScreen));
    });

    await waitFor(() => {
      expect(screen.getByText("Load #1234 assigned to you")).toBeTruthy();
    });

    expect(screen.getByText("Load #1234 assigned to you")).toBeTruthy();
    expect(screen.getByText("2026-04-12T10:00:00Z")).toBeTruthy();
    expect(screen.getByText("Settlement #5678 approved")).toBeTruthy();
    expect(screen.getByText("2026-04-12T11:30:00Z")).toBeTruthy();

    const items = screen.getAllByTestId(/^flatlist-item-/);
    expect(items).toHaveLength(2);
  });

  // # Tests R-P1-04
  it("shows empty state when no notifications exist", async () => {
    mockFetchNotifications.mockResolvedValueOnce([]);

    const NotificationsScreen = (
      await import("../../src/app/(tabs)/notifications")
    ).default;

    await act(async () => {
      render(React.createElement(NotificationsScreen));
    });

    await waitFor(() => {
      expect(screen.getByText("No notifications")).toBeTruthy();
    });
  });
});

describe("R-P1-05: NotificationsScreen pull-to-refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // # Tests R-P1-05
  it("renders a RefreshControl and re-fetches on pull", async () => {
    mockFetchNotifications
      .mockResolvedValueOnce(sampleNotifications)
      .mockResolvedValueOnce([
        {
          id: "notif-3",
          channel: "push",
          message: "New load available",
          status: "SENT",
          sent_at: "2026-04-12T14:00:00Z",
          created_at: "2026-04-12T13:59:00Z",
        },
      ]);

    const NotificationsScreen = (
      await import("../../src/app/(tabs)/notifications")
    ).default;

    await act(async () => {
      render(React.createElement(NotificationsScreen));
    });

    await waitFor(() => {
      expect(screen.getByText("Load #1234 assigned to you")).toBeTruthy();
    });

    const refreshControl = screen.getByTestId("refresh-control");
    expect(refreshControl).toBeTruthy();

    // Simulate pull-to-refresh
    await act(async () => {
      refreshControl.click();
    });

    expect(mockFetchNotifications).toHaveBeenCalledTimes(2);

    await waitFor(() => {
      expect(screen.getByText("New load available")).toBeTruthy();
    });
  });
});
