import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CommsOverlay } from "../../../components/CommsOverlay";
import type { WorkspaceSession, CallSession } from "../../../types";

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

const makeCallSession = (
  overrides: Partial<CallSession> = {},
): CallSession => ({
  id: "CALL-ABC12345",
  startTime: new Date().toISOString(),
  status: "ACTIVE",
  participants: [{ id: "user-1", name: "Test Dispatcher", role: "DISPATCHER" }],
  lastActivityAt: new Date().toISOString(),
  links: [],
  ...overrides,
});

const defaultProps = {
  session: makeSession(),
  activeCallSession: null as CallSession | null,
  setActiveCallSession: vi.fn(),
  onRecordAction: vi.fn().mockResolvedValue(undefined),
  openRecordWorkspace: vi.fn(),
  onNavigate: vi.fn(),
  overlayState: "floating" as const,
  setOverlayState: vi.fn(),
  user: { id: "user-1", name: "Test Dispatcher" },
  allLoads: [
    {
      id: "load-1",
      loadNumber: "LD-001",
      driverName: "John Driver",
      status: "in_transit",
      messages: [
        {
          id: "msg-1",
          text: "Arrived at facility",
          senderId: "driver-1",
          senderName: "John Driver",
          timestamp: new Date().toISOString(),
        },
      ],
    },
    {
      id: "load-2",
      loadNumber: "LD-002",
      driverName: "Jane Hauler",
      status: "planned",
      messages: [],
    },
  ],
  onLinkSessionToRecord: vi.fn().mockResolvedValue(undefined),
};

describe("CommsOverlay deep coverage", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("docked mode (lines 241-269)", () => {
    it("renders in docked mode with correct container classes", () => {
      const { container } = render(
        <CommsOverlay {...defaultProps} overlayState="docked" />,
      );
      const overlay = container.firstChild as HTMLElement;
      expect(overlay.className).toContain("fixed right-0 top-0 bottom-0");
    });

    it("switches from docked to floating when layout toggle is clicked", async () => {
      render(
        <CommsOverlay {...defaultProps} overlayState="docked" />,
      );

      const allButtons = screen.getAllByRole("button");
      for (const btn of allButtons) {
        await user.click(btn);
        if (
          defaultProps.setOverlayState.mock.calls.some(
            (c: unknown[]) => c[0] === "floating",
          )
        ) {
          break;
        }
        defaultProps.setOverlayState.mockClear();
      }

      expect(defaultProps.setOverlayState).toHaveBeenCalledWith("floating");
    });
  });

  describe("context panel and attach search (lines 359-384)", () => {
    it("searches for loads by load number in the attach overlay", async () => {
      render(<CommsOverlay {...defaultProps} />);

      const evidenceText = screen.getByText("Primary Evidence");
      const container = evidenceText.closest("div.flex");
      const attachBtn = container!.parentElement?.querySelector("button");
      await user.click(attachBtn!);

      const searchInput = screen.getByPlaceholderText(
        "Search records to link...",
      );
      await user.type(searchInput, "LD-001");

      // "Load #LD-001" appears both in context bar and search results
      const loadResults = screen.getAllByText(/Load #LD-001/);
      expect(loadResults.length).toBeGreaterThanOrEqual(2);
    });

    it("searches for loads by driver name in the attach overlay", async () => {
      render(<CommsOverlay {...defaultProps} />);

      const evidenceText = screen.getByText("Primary Evidence");
      const container = evidenceText.closest("div.flex");
      const attachBtn = container!.parentElement?.querySelector("button");
      await user.click(attachBtn!);

      const searchInput = screen.getByPlaceholderText(
        "Search records to link...",
      );
      await user.type(searchInput, "John");

      // Search results should show loads matching driver name
      expect(screen.getByText(/John Driver/)).toBeInTheDocument();
    });

    it("opens record workspace when clicking a search result load", async () => {
      render(<CommsOverlay {...defaultProps} />);

      const evidenceText = screen.getByText("Primary Evidence");
      const container = evidenceText.closest("div.flex");
      const attachBtn = container!.parentElement?.querySelector("button");
      await user.click(attachBtn!);

      const searchInput = screen.getByPlaceholderText(
        "Search records to link...",
      );
      await user.type(searchInput, "LD-001");

      // Click on the search result's cursor-pointer div
      const resultDivs = document.querySelectorAll("div.cursor-pointer");
      expect(resultDivs.length).toBeGreaterThan(0);
      await user.click(resultDivs[0] as HTMLElement);

      expect(defaultProps.openRecordWorkspace).toHaveBeenCalledWith(
        "LOAD",
        "load-1",
      );
    });

    it("links a search result to an active call session", async () => {
      render(
        <CommsOverlay
          {...defaultProps}
          activeCallSession={makeCallSession()}
        />,
      );

      const evidenceText = screen.getByText("Primary Evidence");
      const container = evidenceText.closest("div.flex");
      const attachBtn = container!.parentElement?.querySelector("button");
      await user.click(attachBtn!);

      const searchInput = screen.getByPlaceholderText(
        "Search records to link...",
      );
      await user.type(searchInput, "LD-001");

      const linkButtons = document.querySelectorAll(
        "button[title='Link to Call']",
      );
      expect(linkButtons.length).toBeGreaterThan(0);
      await user.click(linkButtons[0] as HTMLElement);

      await waitFor(() => {
        expect(defaultProps.onLinkSessionToRecord).toHaveBeenCalledWith(
          "CALL-ABC12345",
          "load-1",
          "LOAD",
        );
      });
    });
  });

  describe("messages tab (lines 359-384)", () => {
    it("renders messages from the linked load in messages tab", async () => {
      render(
        <CommsOverlay
          {...defaultProps}
          activeCallSession={makeCallSession()}
        />,
      );

      await user.click(screen.getByText("Messages"));

      await waitFor(() => {
        expect(screen.getByText("Arrived at facility")).toBeInTheDocument();
      });
    });

    it("shows empty state when load has no messages", async () => {
      render(
        <CommsOverlay
          {...defaultProps}
          session={makeSession({
            primaryContext: {
              id: "load-2",
              type: "LOAD",
              label: "Load #LD-002",
              timestamp: new Date().toISOString(),
            },
          })}
          activeCallSession={makeCallSession()}
        />,
      );

      await user.click(screen.getByText("Messages"));

      await waitFor(() => {
        expect(
          screen.getByText("No Strategic Messages"),
        ).toBeInTheDocument();
      });
    });

    it("sends a message via Enter key in the messages tab", async () => {
      render(
        <CommsOverlay
          {...defaultProps}
          activeCallSession={makeCallSession()}
        />,
      );

      await user.click(screen.getByText("Messages"));

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Send tactical message..."),
        ).toBeInTheDocument();
      });

      const msgInput = screen.getByPlaceholderText(
        "Send tactical message...",
      );
      await user.type(msgInput, "Urgent update{Enter}");

      await waitFor(() => {
        expect(defaultProps.onRecordAction).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "MESSAGE",
          }),
        );
      });
    });
  });

  describe("quick request buttons in requests tab", () => {
    it("creates a LUMPER request and switches to requests tab", async () => {
      render(
        <CommsOverlay
          {...defaultProps}
          activeCallSession={makeCallSession()}
        />,
      );

      await user.click(screen.getByText("Requests"));
      await waitFor(() => {
        expect(screen.getByText("Lumper Fee")).toBeInTheDocument();
      });
      await user.click(screen.getByText("Lumper Fee"));

      await waitFor(() => {
        expect(defaultProps.onRecordAction).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "REQUEST",
            message: expect.stringContaining("LUMPER"),
          }),
        );
      });
    });
  });

  describe("navigation jump bar", () => {
    it("navigates to dispatch tab", async () => {
      render(<CommsOverlay {...defaultProps} />);
      await user.click(screen.getByText("Dispatch"));
      expect(defaultProps.onNavigate).toHaveBeenCalledWith("loads");
    });

    it("navigates to customer tab", async () => {
      render(<CommsOverlay {...defaultProps} />);
      await user.click(screen.getByText("Customer"));
      expect(defaultProps.onNavigate).toHaveBeenCalledWith("brokers");
    });
  });
});
