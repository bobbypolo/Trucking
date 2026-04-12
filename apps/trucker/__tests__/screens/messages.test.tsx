import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, act, waitFor } from "@testing-library/react";

/**
 * Tests R-P3-04
 *
 * Verifies MessagesScreen renders a FlatList with thread title
 * and last message preview.
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
    StyleSheet: { create: (styles: any) => styles },
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
    Pressable: ({ children, onPress, ...props }: any) =>
      React.createElement("button", { onClick: onPress, ...props }, children),
  };
  return { ...RN, default: RN };
});

// Mock fetchThreads
const mockFetchThreads = vi.fn();
vi.mock("../../src/services/messaging", () => ({
  fetchThreads: (...args: any[]) => mockFetchThreads(...args),
}));

const sampleThreads = [
  {
    id: "thread-1",
    title: "Load #1234 Discussion",
    load_id: "load-1",
    participant_ids: ["user-1", "user-2"],
    last_message: "ETA updated to 3pm",
    last_message_at: "2026-04-12T14:00:00Z",
    status: "active",
    created_at: "2026-04-10T08:00:00Z",
    updated_at: "2026-04-12T14:00:00Z",
  },
  {
    id: "thread-2",
    title: "Delivery Confirmation",
    load_id: "load-2",
    participant_ids: ["user-1", "user-3"],
    last_message: "BOL signed",
    last_message_at: "2026-04-11T16:00:00Z",
    status: "active",
    created_at: "2026-04-09T10:00:00Z",
    updated_at: "2026-04-11T16:00:00Z",
  },
];

describe("R-P3-04: MessagesScreen renders FlatList with threads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // # Tests R-P3-04
  it("renders thread title and last message preview for each thread", async () => {
    mockFetchThreads.mockResolvedValueOnce(sampleThreads);

    const MessagesScreen = (await import("../../src/app/(tabs)/messages"))
      .default;

    await act(async () => {
      render(React.createElement(MessagesScreen));
    });

    await waitFor(() => {
      expect(screen.getByText("Load #1234 Discussion")).toBeTruthy();
    });

    expect(screen.getByText("Load #1234 Discussion")).toBeTruthy();
    expect(screen.getByText("ETA updated to 3pm")).toBeTruthy();
    expect(screen.getByText("Delivery Confirmation")).toBeTruthy();
    expect(screen.getByText("BOL signed")).toBeTruthy();

    const items = screen.getAllByTestId(/^flatlist-item-/);
    expect(items).toHaveLength(2);
  });

  // # Tests R-P3-04
  it("shows empty state when no threads exist", async () => {
    mockFetchThreads.mockResolvedValueOnce([]);

    const MessagesScreen = (await import("../../src/app/(tabs)/messages"))
      .default;

    await act(async () => {
      render(React.createElement(MessagesScreen));
    });

    await waitFor(() => {
      expect(screen.getByText("No messages")).toBeTruthy();
    });
  });

  // # Tests R-P3-04
  it("renders FlatList container with data-testid", async () => {
    mockFetchThreads.mockResolvedValueOnce(sampleThreads);

    const MessagesScreen = (await import("../../src/app/(tabs)/messages"))
      .default;

    await act(async () => {
      render(React.createElement(MessagesScreen));
    });

    await waitFor(() => {
      expect(screen.getByTestId("flatlist")).toBeTruthy();
    });

    expect(screen.getByTestId("flatlist")).toBeTruthy();
  });
});
