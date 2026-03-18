import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
      messages: [],
    },
  ],
};

describe("CommsOverlay component", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("collapsed state", () => {
    it("renders a floating button when collapsed", () => {
      render(<CommsOverlay {...defaultProps} overlayState="collapsed" />);
      // Should render a button with phone icon
      const btn = screen.getByRole("button");
      expect(btn).toBeInTheDocument();
    });

    it("calls setOverlayState when collapsed button is clicked", async () => {
      render(<CommsOverlay {...defaultProps} overlayState="collapsed" />);
      await user.click(screen.getByRole("button"));
      expect(defaultProps.setOverlayState).toHaveBeenCalledWith("floating");
    });

    it("shows green dot when no active call session", () => {
      const { container } = render(
        <CommsOverlay {...defaultProps} overlayState="collapsed" />,
      );
      // Green dot should be present (no active call)
      const greenDot = container.querySelector(".bg-green-500");
      expect(greenDot).not.toBeNull();
    });

    it("shows red pulsing dot when active call session exists", () => {
      const { container } = render(
        <CommsOverlay
          {...defaultProps}
          overlayState="collapsed"
          activeCallSession={makeCallSession()}
        />,
      );
      const redDot = container.querySelector(".bg-red-500");
      expect(redDot).not.toBeNull();
    });
  });

  describe("floating/docked state", () => {
    it("renders header with Operational Comms when no active call", () => {
      render(<CommsOverlay {...defaultProps} />);
      expect(screen.getByText("Operational Comms")).toBeInTheDocument();
      expect(screen.getByText("Idle")).toBeInTheDocument();
    });

    it("renders header with Active Interaction when call is active", () => {
      render(
        <CommsOverlay
          {...defaultProps}
          activeCallSession={makeCallSession()}
        />,
      );
      expect(screen.getByText("Active Interaction")).toBeInTheDocument();
      expect(screen.getByText("CALL-ABC12345")).toBeInTheDocument();
    });

    it("renders navigation tabs", () => {
      render(<CommsOverlay {...defaultProps} />);
      expect(screen.getByText("Notes")).toBeInTheDocument();
      expect(screen.getByText("Messages")).toBeInTheDocument();
      expect(screen.getByText("Requests")).toBeInTheDocument();
      expect(screen.getByText("Tasks")).toBeInTheDocument();
    });

    it("shows No Active Interaction when no call session", () => {
      render(<CommsOverlay {...defaultProps} />);
      expect(screen.getByText("No Active Interaction")).toBeInTheDocument();
    });

    it("shows Start Interaction button when no call session", () => {
      render(<CommsOverlay {...defaultProps} />);
      expect(screen.getByText("Start Interaction")).toBeInTheDocument();
    });

    it("starts a call session when Start Interaction is clicked", async () => {
      render(<CommsOverlay {...defaultProps} />);
      await user.click(screen.getByText("Start Interaction"));
      expect(defaultProps.setActiveCallSession).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "ACTIVE",
          participants: expect.arrayContaining([
            expect.objectContaining({ id: "user-1", name: "Test Dispatcher" }),
          ]),
        }),
      );
    });

    it("renders primary context label", () => {
      render(<CommsOverlay {...defaultProps} />);
      expect(screen.getByText("Load #LD-001")).toBeInTheDocument();
    });

    it("shows UNLINKED INTERACTION when no primary context", () => {
      render(
        <CommsOverlay
          {...defaultProps}
          session={makeSession({ primaryContext: null })}
        />,
      );
      expect(screen.getByText("UNLINKED INTERACTION")).toBeInTheDocument();
    });

    it("toggles dock/float when layout button is clicked", async () => {
      render(<CommsOverlay {...defaultProps} overlayState="floating" />);
      // Find the dock/float toggle button by its aria-label or title
      const buttons = screen.getAllByRole("button");
      const toggleBtn = buttons.find(
        (b) => b.querySelector("svg") && b.closest(".flex.items-center.gap-2"),
      );
      expect(toggleBtn).toBeDefined();
      await user.click(toggleBtn!);
      expect(defaultProps.setOverlayState).toHaveBeenCalledWith("docked");
    });

    it("collapses when minimize button is clicked", async () => {
      render(<CommsOverlay {...defaultProps} />);
      // Find all buttons and click each until we find the one that sets collapsed
      const allButtons = screen.getAllByRole("button");
      let found = false;
      for (const btn of allButtons) {
        await user.click(btn);
        if (
          defaultProps.setOverlayState.mock.calls.some(
            (c: unknown[]) => c[0] === "collapsed",
          )
        ) {
          found = true;
          break;
        }
        defaultProps.setOverlayState.mockClear();
      }
      expect(found).toBe(true);
      expect(defaultProps.setOverlayState).toHaveBeenCalledWith("collapsed");
    });
  });

  describe("active call session features", () => {
    it("shows notes tab with textarea when call is active", () => {
      render(
        <CommsOverlay
          {...defaultProps}
          activeCallSession={makeCallSession()}
        />,
      );
      expect(
        screen.getByPlaceholderText("Type operational note..."),
      ).toBeInTheDocument();
    });

    it("shows Log Note button in notes tab", () => {
      render(
        <CommsOverlay
          {...defaultProps}
          activeCallSession={makeCallSession()}
        />,
      );
      expect(screen.getByText("Log Note")).toBeInTheDocument();
    });

    it("calls onRecordAction when note is submitted", async () => {
      render(
        <CommsOverlay
          {...defaultProps}
          activeCallSession={makeCallSession()}
        />,
      );
      const textarea = screen.getByPlaceholderText("Type operational note...");
      await user.clear(textarea);
      await user.type(textarea, "Test note content");
      await user.click(screen.getByText("Log Note"));

      await waitFor(() => {
        expect(defaultProps.onRecordAction).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "CALL_LOG",
            message: "Test note content",
          }),
        );
      });
    });

    it("clears note text after submission", async () => {
      render(
        <CommsOverlay
          {...defaultProps}
          activeCallSession={makeCallSession()}
        />,
      );
      const textarea = screen.getByPlaceholderText(
        "Type operational note...",
      ) as HTMLTextAreaElement;
      await user.clear(textarea);
      await user.type(textarea, "Test note");
      await user.click(screen.getByText("Log Note"));

      await waitFor(() => {
        expect(textarea.value).toBe("");
      });
    });

    it("does not submit empty notes", async () => {
      render(
        <CommsOverlay
          {...defaultProps}
          activeCallSession={makeCallSession()}
        />,
      );
      await user.click(screen.getByText("Log Note"));
      expect(defaultProps.onRecordAction).not.toHaveBeenCalled();
    });

    it("shows requests tab with quick request buttons", async () => {
      render(
        <CommsOverlay
          {...defaultProps}
          activeCallSession={makeCallSession()}
        />,
      );
      // Switch to requests tab
      await user.click(screen.getByText("Requests"));

      await waitFor(() => {
        expect(screen.getByText("Detention")).toBeInTheDocument();
      });
      expect(screen.getByText("Lumper Fee")).toBeInTheDocument();
      expect(screen.getByText("Layover")).toBeInTheDocument();
      expect(screen.getByText("TONU")).toBeInTheDocument();
    });

    it("creates request when quick request button is clicked", async () => {
      render(
        <CommsOverlay
          {...defaultProps}
          activeCallSession={makeCallSession()}
        />,
      );
      await user.click(screen.getByText("Requests"));

      await waitFor(() => {
        expect(screen.getByText("Detention")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Detention"));

      await waitFor(() => {
        expect(defaultProps.onRecordAction).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "REQUEST",
            message: expect.stringContaining("DETENTION"),
          }),
        );
      });
    });

    it("shows End Interaction button when call is active", () => {
      render(
        <CommsOverlay
          {...defaultProps}
          activeCallSession={makeCallSession()}
        />,
      );
      expect(screen.getByText("End Interaction")).toBeInTheDocument();
    });

    it("ends call session when End Interaction is clicked", async () => {
      render(
        <CommsOverlay
          {...defaultProps}
          activeCallSession={makeCallSession()}
        />,
      );
      await user.click(screen.getByText("End Interaction"));
      expect(defaultProps.setActiveCallSession).toHaveBeenCalledWith(null);
    });
  });

  describe("quick actions / jump bar", () => {
    it("renders jump-to buttons at the bottom", () => {
      render(<CommsOverlay {...defaultProps} />);
      expect(screen.getByText("Booking")).toBeInTheDocument();
      expect(screen.getByText("Safety")).toBeInTheDocument();
      expect(screen.getByText("Dispatch")).toBeInTheDocument();
      expect(screen.getByText("Customer")).toBeInTheDocument();
    });

    it("calls onNavigate when jump button is clicked", async () => {
      render(<CommsOverlay {...defaultProps} />);
      await user.click(screen.getByText("Safety"));
      expect(defaultProps.onNavigate).toHaveBeenCalledWith("safety");
    });

    it("navigates to booking tab", async () => {
      render(<CommsOverlay {...defaultProps} />);
      await user.click(screen.getByText("Booking"));
      expect(defaultProps.onNavigate).toHaveBeenCalledWith("booking");
    });
  });

  describe("attach search", () => {
    it("shows search input when attach button is clicked", async () => {
      render(<CommsOverlay {...defaultProps} />);
      const evidenceText = screen.getByText("Primary Evidence");
      const container = evidenceText.closest("div.flex");
      expect(container).not.toBeNull();
      const attachBtn = container!.parentElement?.querySelector("button");
      expect(attachBtn).not.toBeNull();
      await user.click(attachBtn!);
      expect(
        screen.getByPlaceholderText("Search records to link..."),
      ).toBeInTheDocument();
    });
  });

  describe("dock/float toggle (line 269)", () => {
    it("toggles overlay state between floating and docked", async () => {
      render(<CommsOverlay {...defaultProps} overlayState="floating" />);
      const buttons = screen.getAllByRole("button");
      for (const btn of buttons) {
        await user.click(btn);
        if (
          defaultProps.setOverlayState.mock.calls.some(
            (c: unknown[]) => c[0] === "docked",
          )
        ) {
          break;
        }
        defaultProps.setOverlayState.mockClear();
      }
      expect(defaultProps.setOverlayState).toHaveBeenCalledWith("docked");
    });
  });

  describe("context panel and call recording (lines 359-384)", () => {
    it("renders active call session footer with end interaction button", () => {
      render(
        <CommsOverlay
          {...defaultProps}
          activeCallSession={makeCallSession()}
        />,
      );
      expect(screen.getByText("Active Call Session")).toBeInTheDocument();
      expect(screen.getByText("End Interaction")).toBeInTheDocument();
    });

    it("renders tasks tab", async () => {
      render(
        <CommsOverlay
          {...defaultProps}
          activeCallSession={makeCallSession()}
        />,
      );
      await user.click(screen.getByText("Tasks"));
      // Tab should be clickable without errors
      expect(screen.getByText("Tasks")).toBeInTheDocument();
    });
  });

  describe("messages tab", () => {
    it("shows empty messages state when messages tab is active with no messages", async () => {
      render(
        <CommsOverlay
          {...defaultProps}
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
  });
});
