import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OperationalMessaging } from "../../../components/OperationalMessaging";
import type {
  User as UserType,
  LoadData,
  WorkspaceSession,
  CallSession,
  OperationalEvent,
} from "../../../types";

// Mock storageService at network boundary
vi.mock("../../../services/storageService", () => ({
  getMessages: vi.fn().mockResolvedValue([]),
  saveMessage: vi.fn().mockImplementation((msg) => Promise.resolve(msg)),
  globalSearch: vi.fn().mockResolvedValue([]),
}));

// Mock Toast to prevent auto-dismiss timer interference
vi.mock("../../../components/Toast", () => ({
  Toast: ({
    message,
    type,
  }: {
    message: string;
    type: string;
    onDismiss: () => void;
  }) => (
    <div data-testid="toast-mock" data-type={type}>
      {message}
    </div>
  ),
}));

const mockUser: UserType = {
  id: "dispatcher-1",
  name: "Test Dispatcher",
  email: "dispatcher@test.com",
  role: "dispatcher",
  companyId: "company-1",
  onboardingStatus: "Completed",
  safetyScore: 100,
};

const makeLoad = (overrides: Partial<LoadData> = {}): LoadData => ({
  id: "load-1",
  loadNumber: "LD-001",
  companyId: "company-1",
  driverId: "driver-1",
  status: "in_transit",
  carrierRate: 2500,
  driverPay: 1500,
  pickup: { city: "Dallas", state: "TX" },
  dropoff: { city: "Houston", state: "TX" },
  pickupDate: "2024-06-01",
  ...overrides,
});

const makeSession = (
  overrides: Partial<WorkspaceSession> = {},
): WorkspaceSession => ({
  primaryContext: {
    id: "load-1",
    type: "LOAD",
    label: "Load #LD-001",
    timestamp: new Date().toISOString(),
  },
  secondaryContexts: [],
  recentContexts: [],
  pinnedContexts: [],
  splitView: { enabled: false },
  ...overrides,
});

const makeThread = (overrides: Record<string, unknown> = {}) => ({
  id: "load-1",
  primaryContext: {
    type: "Load",
    id: "load-1",
    label: "Load #LD-001",
    status: "in_transit",
  },
  linkedRecords: [],
  events: [],
  ownerId: "dispatcher-1",
  ownerName: "Test Dispatcher",
  lastTouch: new Date().toISOString(),
  summary: "Dallas to Houston shipment",
  ...overrides,
});

describe("OperationalMessaging component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the thread sidebar with Operational Streams header", () => {
    render(
      <OperationalMessaging
        user={mockUser}
        loads={[makeLoad()]}
        session={makeSession()}
        threads={[makeThread()]}
      />,
    );
    expect(screen.getByText("Operational Streams")).toBeInTheDocument();
  });

  it("renders thread list from threads prop", () => {
    const threads = [
      makeThread({ id: "load-1", summary: "Dallas to Houston shipment" }),
      makeThread({
        id: "load-2",
        primaryContext: {
          type: "Load",
          id: "load-2",
          label: "Load #LD-002",
          status: "planned",
        },
        summary: "Chicago to LA freight",
      }),
    ];
    render(
      <OperationalMessaging
        user={mockUser}
        loads={[makeLoad(), makeLoad({ id: "load-2", loadNumber: "LD-002" })]}
        session={makeSession()}
        threads={threads}
      />,
    );
    expect(screen.getByText("Load #LD-001")).toBeInTheDocument();
    expect(screen.getByText("Load #LD-002")).toBeInTheDocument();
  });

  it("shows search input for thread filtering", () => {
    render(
      <OperationalMessaging
        user={mockUser}
        loads={[makeLoad()]}
        session={makeSession()}
        threads={[makeThread()]}
      />,
    );
    expect(
      screen.getByPlaceholderText("Find load/record stream..."),
    ).toBeInTheDocument();
  });

  it("filters threads by search query", async () => {
    const user = userEvent.setup();
    const threads = [
      makeThread({
        id: "load-1",
        primaryContext: {
          type: "Load",
          id: "load-1",
          label: "Load #LD-001",
        },
        summary: "Dallas to Houston",
      }),
      makeThread({
        id: "load-2",
        primaryContext: {
          type: "Load",
          id: "load-2",
          label: "Load #LD-002",
        },
        summary: "Chicago to LA",
      }),
    ];
    render(
      <OperationalMessaging
        user={mockUser}
        loads={[makeLoad(), makeLoad({ id: "load-2", loadNumber: "LD-002" })]}
        session={makeSession()}
        threads={threads}
      />,
    );

    const searchInput = screen.getByPlaceholderText(
      "Find load/record stream...",
    );
    await user.clear(searchInput);
    await user.type(searchInput, "Chicago");

    // LD-001 thread should be hidden
    expect(screen.queryByText("Load #LD-001")).not.toBeInTheDocument();
    expect(screen.getByText("Load #LD-002")).toBeInTheDocument();
  });

  it("shows the liaison info banner", () => {
    render(
      <OperationalMessaging
        user={mockUser}
        loads={[makeLoad()]}
        session={makeSession()}
        threads={[makeThread()]}
      />,
    );
    expect(
      screen.getByText(/record-linked liaison streams/i),
    ).toBeInTheDocument();
  });

  it("renders the chat header with load number when thread is selected", () => {
    render(
      <OperationalMessaging
        user={mockUser}
        loads={[makeLoad()]}
        session={makeSession()}
        threads={[makeThread()]}
      />,
    );
    expect(screen.getByText("Load #LD-001 Liaison")).toBeInTheDocument();
  });

  it("shows Tactical Stream tab in the chat header", () => {
    render(
      <OperationalMessaging
        user={mockUser}
        loads={[makeLoad()]}
        session={makeSession()}
        threads={[makeThread()]}
      />,
    );
    expect(screen.getByText("Tactical Stream")).toBeInTheDocument();
  });

  it("shows Tactical Evidence Stream label in messages area", () => {
    render(
      <OperationalMessaging
        user={mockUser}
        loads={[makeLoad()]}
        session={makeSession()}
        threads={[makeThread()]}
      />,
    );
    expect(screen.getByText("Tactical Evidence Stream")).toBeInTheDocument();
  });

  it("renders message input with correct placeholder", () => {
    render(
      <OperationalMessaging
        user={mockUser}
        loads={[makeLoad()]}
        session={makeSession()}
        threads={[makeThread()]}
      />,
    );
    expect(
      screen.getByPlaceholderText(/Message participants for Load #LD-001/),
    ).toBeInTheDocument();
  });

  it("sends a message when send button is clicked", async () => {
    const user = userEvent.setup();
    const { saveMessage } = await import("../../../services/storageService");

    render(
      <OperationalMessaging
        user={mockUser}
        loads={[makeLoad()]}
        session={makeSession()}
        threads={[makeThread()]}
      />,
    );

    const input = screen.getByPlaceholderText(
      /Message participants for Load #LD-001/,
    );
    await user.clear(input);
    await user.type(input, "Test message content");

    // Find the actual send button - it's the one next to the textarea
    const messageArea = input.closest("div");
    const buttons = messageArea?.querySelectorAll("button");
    if (buttons) {
      const lastBtn = buttons[buttons.length - 1];
      await user.click(lastBtn);
    }

    await waitFor(() => {
      expect(saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "Test message content",
          senderId: "dispatcher-1",
          senderName: "Test Dispatcher",
        }),
      );
    });
  });

  it("sends message on Enter key press", async () => {
    const user = userEvent.setup();
    const { saveMessage } = await import("../../../services/storageService");

    render(
      <OperationalMessaging
        user={mockUser}
        loads={[makeLoad()]}
        session={makeSession()}
        threads={[makeThread()]}
      />,
    );

    const input = screen.getByPlaceholderText(
      /Message participants for Load #LD-001/,
    );
    await user.clear(input);
    await user.type(input, "Enter key message");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "Enter key message",
        }),
      );
    });
  });

  it("does not send empty messages", async () => {
    const user = userEvent.setup();
    const { saveMessage } = await import("../../../services/storageService");

    render(
      <OperationalMessaging
        user={mockUser}
        loads={[makeLoad()]}
        session={makeSession()}
        threads={[makeThread()]}
      />,
    );

    const input = screen.getByPlaceholderText(
      /Message participants for Load #LD-001/,
    );
    await user.click(input);
    await user.keyboard("{Enter}");

    expect(saveMessage).not.toHaveBeenCalled();
  });

  it("shows error toast when message send fails", async () => {
    const user = userEvent.setup();
    const { saveMessage } = await import("../../../services/storageService");
    (saveMessage as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Send failed"),
    );

    render(
      <OperationalMessaging
        user={mockUser}
        loads={[makeLoad()]}
        session={makeSession()}
        threads={[makeThread()]}
      />,
    );

    const input = screen.getByPlaceholderText(
      /Message participants for Load #LD-001/,
    );
    await user.clear(input);
    await user.type(input, "Failing message");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(
        screen.getByText("Message could not be delivered. Please try again."),
      ).toBeInTheDocument();
    });
  });

  it("shows Resource Context sidebar by default", () => {
    render(
      <OperationalMessaging
        user={mockUser}
        loads={[makeLoad()]}
        session={makeSession()}
        threads={[makeThread()]}
      />,
    );
    expect(screen.getByText("Resource Context")).toBeInTheDocument();
  });

  it("shows pickup and dropoff cities in context sidebar", () => {
    render(
      <OperationalMessaging
        user={mockUser}
        loads={[makeLoad()]}
        session={makeSession()}
        threads={[makeThread()]}
      />,
    );
    expect(screen.getByText("Dallas")).toBeInTheDocument();
    expect(screen.getByText("Houston")).toBeInTheDocument();
  });

  it("shows status in context sidebar", () => {
    render(
      <OperationalMessaging
        user={mockUser}
        loads={[makeLoad()]}
        session={makeSession()}
        threads={[makeThread()]}
      />,
    );
    expect(screen.getByText("in_transit")).toBeInTheDocument();
  });

  it("shows empty state when no thread is selected and no loads", () => {
    render(
      <OperationalMessaging
        user={mockUser}
        loads={[]}
        session={makeSession({ primaryContext: null })}
        threads={[]}
      />,
    );
    expect(screen.getByText("Omni-Channel Liaison")).toBeInTheDocument();
  });

  it("renders with ACTIVE interaction state showing live banner", () => {
    const callSession: CallSession = {
      id: "CALL-TEST123",
      startTime: new Date().toISOString(),
      status: "ACTIVE",
      participants: [
        { id: "user-1", name: "Participant One", role: "DISPATCHER" },
      ],
      lastActivityAt: new Date().toISOString(),
      links: [],
    };

    render(
      <OperationalMessaging
        user={mockUser}
        loads={[makeLoad()]}
        session={makeSession()}
        threads={[makeThread()]}
        interactionState="ACTIVE"
        callSession={callSession}
      />,
    );

    expect(screen.getByText("Live Voice Interaction")).toBeInTheDocument();
    expect(screen.getAllByText(/CALL-TEST123/).length).toBeGreaterThan(0);
  });

  it("shows Commit Note button during active interaction", () => {
    const callSession: CallSession = {
      id: "CALL-TEST123",
      startTime: new Date().toISOString(),
      status: "ACTIVE",
      participants: [
        { id: "user-1", name: "Participant One", role: "DISPATCHER" },
      ],
      lastActivityAt: new Date().toISOString(),
      links: [],
    };

    render(
      <OperationalMessaging
        user={mockUser}
        loads={[makeLoad()]}
        session={makeSession()}
        threads={[makeThread()]}
        interactionState="ACTIVE"
        callSession={callSession}
        onNoteCreated={vi.fn()}
      />,
    );

    expect(screen.getByText("Commit Note")).toBeInTheDocument();
  });

  it("calls onNoteCreated when note is committed during active session", async () => {
    const user = userEvent.setup();
    const onNoteCreated = vi.fn();
    const callSession: CallSession = {
      id: "CALL-TEST123",
      startTime: new Date().toISOString(),
      status: "ACTIVE",
      participants: [
        { id: "user-1", name: "Participant One", role: "DISPATCHER" },
      ],
      lastActivityAt: new Date().toISOString(),
      links: [],
    };

    render(
      <OperationalMessaging
        user={mockUser}
        loads={[makeLoad()]}
        session={makeSession()}
        threads={[makeThread()]}
        interactionState="ACTIVE"
        callSession={callSession}
        onNoteCreated={onNoteCreated}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      "Capture live tactical notes here...",
    );
    await user.clear(textarea);
    await user.type(textarea, "Important call note");
    await user.click(screen.getByText("Commit Note"));

    expect(onNoteCreated).toHaveBeenCalledWith("Important call note");
  });

  it("renders unified events in the feed", () => {
    const events: OperationalEvent[] = [
      {
        id: "evt-1",
        type: "CALL_LOG",
        timestamp: new Date().toISOString(),
        actorId: "user-1",
        actorName: "Dispatcher",
        message: "Called driver about ETA",
        loadId: "load-1",
      },
    ];

    render(
      <OperationalMessaging
        user={mockUser}
        loads={[makeLoad()]}
        session={makeSession()}
        threads={[makeThread()]}
        unifiedEvents={events}
      />,
    );

    expect(screen.getByText("Called driver about ETA")).toBeInTheDocument();
  });

  it("shows interaction controls during ACTIVE state", () => {
    const callSession: CallSession = {
      id: "CALL-TEST",
      startTime: new Date().toISOString(),
      status: "ACTIVE",
      participants: [{ id: "user-1", name: "Test", role: "DISPATCHER" }],
      lastActivityAt: new Date().toISOString(),
      links: [],
    };

    render(
      <OperationalMessaging
        user={mockUser}
        loads={[makeLoad()]}
        session={makeSession()}
        threads={[makeThread()]}
        interactionState="ACTIVE"
        callSession={callSession}
      />,
    );

    expect(screen.getByText("Resolve")).toBeInTheDocument();
    expect(screen.getByText("Snooze")).toBeInTheDocument();
    expect(screen.getByText("Assign")).toBeInTheDocument();
  });

  it("selects a different thread when clicked", async () => {
    const threads = [
      makeThread({
        id: "load-1",
        primaryContext: {
          type: "Load",
          id: "load-1",
          label: "Load #LD-001",
        },
      }),
      makeThread({
        id: "load-2",
        primaryContext: {
          type: "Load",
          id: "load-2",
          label: "Load #LD-002",
        },
      }),
    ];

    render(
      <OperationalMessaging
        user={mockUser}
        loads={[
          makeLoad(),
          makeLoad({
            id: "load-2",
            loadNumber: "LD-002",
            pickup: { city: "Chicago", state: "IL" },
            dropoff: { city: "LA", state: "CA" },
          }),
        ]}
        session={makeSession()}
        threads={threads}
      />,
    );

    // Click the second thread
    const user = userEvent.setup();
    await user.click(screen.getByText("Load #LD-002"));

    await waitFor(() => {
      expect(screen.getByText("Load #LD-002 Liaison")).toBeInTheDocument();
    });
  });

  describe("thread creation and context switching", () => {
    it("creates a new thread context when a different load is selected and updates chat header", async () => {
      const user = userEvent.setup();
      const threads = [
        makeThread({
          id: "load-1",
          primaryContext: {
            type: "Load",
            id: "load-1",
            label: "Load #LD-001",
          },
          summary: "Dallas to Houston shipment",
        }),
        makeThread({
          id: "load-2",
          primaryContext: {
            type: "Load",
            id: "load-2",
            label: "Load #LD-002",
          },
          summary: "Chicago to LA freight",
        }),
      ];

      render(
        <OperationalMessaging
          user={mockUser}
          loads={[
            makeLoad(),
            makeLoad({
              id: "load-2",
              loadNumber: "LD-002",
              pickup: { city: "Chicago", state: "IL" },
              dropoff: { city: "LA", state: "CA" },
            }),
          ]}
          session={makeSession()}
          threads={threads}
        />,
      );

      // Initially on thread 1
      expect(screen.getByText("Load #LD-001 Liaison")).toBeInTheDocument();

      // Switch to thread 2
      await user.click(screen.getByText("Load #LD-002"));

      // Chat header should update to new thread
      await waitFor(() => {
        expect(screen.getByText("Load #LD-002 Liaison")).toBeInTheDocument();
      });

      // Context sidebar should update to show Chicago/LA
      expect(screen.getByText("Chicago")).toBeInTheDocument();
      expect(screen.getByText("LA")).toBeInTheDocument();
    });

    it("renders attachment button (Paperclip icon) in message input area", () => {
      render(
        <OperationalMessaging
          user={mockUser}
          loads={[makeLoad()]}
          session={makeSession()}
          threads={[makeThread()]}
        />,
      );

      // The message input area should have a Paperclip icon button for attachments
      const input = screen.getByPlaceholderText(
        /Message participants for Load #LD-001/,
      );
      expect(input).toBeInTheDocument();

      // The chat area should contain SVG icons for actions (paperclip, smile, etc.)
      const chatArea = input.closest("div")?.parentElement;
      expect(chatArea).toBeTruthy();
      const svgs = chatArea!.querySelectorAll("svg");
      expect(svgs.length).toBeGreaterThan(0);
    });
  });
});
