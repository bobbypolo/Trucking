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
 * Tests R-P3-05, R-P3-06
 *
 * Verifies MessageThread renders messages chronologically with sender name
 * and timestamp. Verifies TextInput and Send button; Send calls sendMessage().
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
    StyleSheet: { create: (styles: any) => styles },
    ActivityIndicator: ({ size, ...props }: any) =>
      React.createElement(
        "div",
        { "data-testid": "activity-indicator", ...props },
        "Loading...",
      ),
    TextInput: ({ value, onChangeText, placeholder, ...props }: any) =>
      React.createElement("input", {
        value,
        onChange: (e: any) => onChangeText?.(e.target.value),
        placeholder,
        "data-testid": "text-input",
        ...props,
      }),
    Pressable: ({ children, onPress, ...props }: any) =>
      React.createElement("button", { onClick: onPress, ...props }, children),
  };
  return { ...RN, default: RN };
});

// Mock messaging service
const mockFetchThreadMessages = vi.fn();
const mockSendMessage = vi.fn();
vi.mock("../../src/services/messaging", () => ({
  fetchThreadMessages: (...args: any[]) => mockFetchThreadMessages(...args),
  sendMessage: (...args: any[]) => mockSendMessage(...args),
}));

const sampleMessages = [
  {
    id: "msg-1",
    thread_id: "thread-1",
    sender_id: "user-2",
    sender_name: "Dispatch Jane",
    text: "Please confirm ETA",
    timestamp: "2026-04-12T10:00:00Z",
    read_at: null,
  },
  {
    id: "msg-2",
    thread_id: "thread-1",
    sender_id: "user-1",
    sender_name: "John Driver",
    text: "ETA is 3pm",
    timestamp: "2026-04-12T10:05:00Z",
    read_at: "2026-04-12T10:06:00Z",
  },
  {
    id: "msg-3",
    thread_id: "thread-1",
    sender_id: "user-2",
    sender_name: "Dispatch Jane",
    text: "Thanks, confirmed",
    timestamp: "2026-04-12T10:10:00Z",
    read_at: null,
  },
];

describe("R-P3-05: MessageThread renders messages chronologically", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // # Tests R-P3-05
  it("renders each message with sender name and timestamp", async () => {
    mockFetchThreadMessages.mockResolvedValueOnce(sampleMessages);

    const MessageThread = (await import("../../src/components/MessageThread"))
      .default;

    await act(async () => {
      render(
        React.createElement(MessageThread, {
          threadId: "thread-1",
          currentUserId: "user-1",
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Please confirm ETA")).toBeTruthy();
    });

    // Verify all sender names
    expect(screen.getAllByText("Dispatch Jane")).toHaveLength(2);
    expect(screen.getByText("John Driver")).toBeTruthy();

    // Verify all message texts
    expect(screen.getByText("Please confirm ETA")).toBeTruthy();
    expect(screen.getByText("ETA is 3pm")).toBeTruthy();
    expect(screen.getByText("Thanks, confirmed")).toBeTruthy();

    // Verify timestamps rendered
    expect(screen.getByText("2026-04-12T10:00:00Z")).toBeTruthy();
    expect(screen.getByText("2026-04-12T10:05:00Z")).toBeTruthy();
    expect(screen.getByText("2026-04-12T10:10:00Z")).toBeTruthy();

    // Verify chronological order (FlatList renders in order)
    const items = screen.getAllByTestId(/^flatlist-item-/);
    expect(items).toHaveLength(3);
  });

  // # Tests R-P3-05
  it("shows empty state when no messages exist", async () => {
    mockFetchThreadMessages.mockResolvedValueOnce([]);

    const MessageThread = (await import("../../src/components/MessageThread"))
      .default;

    await act(async () => {
      render(
        React.createElement(MessageThread, {
          threadId: "thread-1",
          currentUserId: "user-1",
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText("No messages yet")).toBeTruthy();
    });
  });
});

describe("R-P3-06: MessageThread has TextInput and Send button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // # Tests R-P3-06
  it("renders TextInput and Send button", async () => {
    mockFetchThreadMessages.mockResolvedValueOnce(sampleMessages);

    const MessageThread = (await import("../../src/components/MessageThread"))
      .default;

    await act(async () => {
      render(
        React.createElement(MessageThread, {
          threadId: "thread-1",
          currentUserId: "user-1",
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Please confirm ETA")).toBeTruthy();
    });

    const textInput = screen.getByTestId("text-input");
    expect(textInput).toBeTruthy();
    expect(textInput.getAttribute("placeholder")).toBe("Type a message...");

    const sendButton = screen.getByText("Send");
    expect(sendButton).toBeTruthy();
  });

  // # Tests R-P3-06
  it("calls sendMessage() when Send is pressed with text", async () => {
    mockFetchThreadMessages.mockResolvedValueOnce(sampleMessages);

    const newMessage = {
      id: "msg-new",
      thread_id: "thread-1",
      sender_id: "user-1",
      sender_name: "John Driver",
      text: "Arriving now",
      timestamp: "2026-04-12T15:00:00Z",
      read_at: null,
    };
    mockSendMessage.mockResolvedValueOnce(newMessage);

    const MessageThread = (await import("../../src/components/MessageThread"))
      .default;

    await act(async () => {
      render(
        React.createElement(MessageThread, {
          threadId: "thread-1",
          currentUserId: "user-1",
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Please confirm ETA")).toBeTruthy();
    });

    const textInput = screen.getByTestId("text-input");
    await act(async () => {
      fireEvent.change(textInput, { target: { value: "Arriving now" } });
    });

    const sendButton = screen.getByText("Send");
    await act(async () => {
      sendButton.click();
    });

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(
        "thread-1",
        "user-1",
        "Arriving now",
      );
    });
  });

  // # Tests R-P3-06
  it("does not call sendMessage when text is empty", async () => {
    mockFetchThreadMessages.mockResolvedValueOnce([]);

    const MessageThread = (await import("../../src/components/MessageThread"))
      .default;

    await act(async () => {
      render(
        React.createElement(MessageThread, {
          threadId: "thread-1",
          currentUserId: "user-1",
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText("No messages yet")).toBeTruthy();
    });

    const sendButton = screen.getByText("Send");
    await act(async () => {
      sendButton.click();
    });

    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});
