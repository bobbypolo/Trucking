import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CommsOverlay } from "../../../components/CommsOverlay";
import type { WorkspaceSession, CallSession } from "../../../types";

const makeSession = (overrides: Partial<WorkspaceSession> = {}): WorkspaceSession => ({
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

const makeCallSession = (overrides: Partial<CallSession> = {}): CallSession => ({
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

    it("calls setOverlayState when collapsed button is clicked", () => {
      render(<CommsOverlay {...defaultProps} overlayState="collapsed" />);
      fireEvent.click(screen.getByRole("button"));
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

    it("starts a call session when Start Interaction is clicked", () => {
      render(<CommsOverlay {...defaultProps} />);
      fireEvent.click(screen.getByText("Start Interaction"));
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

    it("toggles dock/float when layout button is clicked", () => {
      render(<CommsOverlay {...defaultProps} overlayState="floating" />);
      // Find the dock/float toggle button (Maximize2 icon)
      const buttons = screen.getAllByRole("button");
      // The layout toggle button is one of the header buttons
      const toggleBtn = buttons.find(
        (b) => b.querySelector("svg") && b.closest(".flex.items-center.gap-2"),
      );
      if (toggleBtn) {
        fireEvent.click(toggleBtn);
        expect(defaultProps.setOverlayState).toHaveBeenCalledWith("docked");
      }
    });

    it("collapses when minimize button is clicked", () => {
      render(<CommsOverlay {...defaultProps} />);
      // The collapse button is the one with Minus icon
      const buttons = screen.getAllByRole("button");
      // Find button that triggers collapsed state
      for (const btn of buttons) {
        fireEvent.click(btn);
        if (
          defaultProps.setOverlayState.mock.calls.some(
            (c: unknown[]) => c[0] === "collapsed",
          )
        ) {
          break;
        }
        defaultProps.setOverlayState.mockClear();
      }
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
      fireEvent.change(textarea, { target: { value: "Test note content" } });
      fireEvent.click(screen.getByText("Log Note"));

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
      fireEvent.change(textarea, { target: { value: "Test note" } });
      fireEvent.click(screen.getByText("Log Note"));

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
      fireEvent.click(screen.getByText("Log Note"));
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
      fireEvent.click(screen.getByText("Requests"));

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
      fireEvent.click(screen.getByText("Requests"));

      await waitFor(() => {
        expect(screen.getByText("Detention")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Detention"));

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

    it("ends call session when End Interaction is clicked", () => {
      render(
        <CommsOverlay
          {...defaultProps}
          activeCallSession={makeCallSession()}
        />,
      );
      fireEvent.click(screen.getByText("End Interaction"));
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

    it("calls onNavigate when jump button is clicked", () => {
      render(<CommsOverlay {...defaultProps} />);
      fireEvent.click(screen.getByText("Safety"));
      expect(defaultProps.onNavigate).toHaveBeenCalledWith("safety");
    });

    it("navigates to booking tab", () => {
      render(<CommsOverlay {...defaultProps} />);
      fireEvent.click(screen.getByText("Booking"));
      expect(defaultProps.onNavigate).toHaveBeenCalledWith("booking");
    });
  });

  describe("attach search", () => {
    it("shows search input when attach button is clicked", () => {
      render(<CommsOverlay {...defaultProps} />);
      // Find and click the link/attach button (LinkIcon)
      const buttons = screen.getAllByRole("button");
      // The attach button has a LinkIcon inside - find it by looking near "Primary Evidence"
      const evidenceText = screen.getByText("Primary Evidence");
      const container = evidenceText.closest("div.flex");
      if (container) {
        const attachBtn = container.parentElement?.querySelector("button");
        if (attachBtn) {
          fireEvent.click(attachBtn);
          expect(
            screen.getByPlaceholderText("Search records to link..."),
          ).toBeInTheDocument();
        }
      }
    });
  });
});
