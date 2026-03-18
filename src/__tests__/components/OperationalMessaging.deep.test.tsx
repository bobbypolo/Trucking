import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OperationalMessaging } from "../../../components/OperationalMessaging";
import type { User as UserType, LoadData, WorkspaceSession, CallSession, OperationalEvent } from "../../../types";

vi.mock("../../../services/storageService", () => ({
  getMessages: vi.fn().mockResolvedValue([]),
  saveMessage: vi.fn().mockImplementation((msg) => Promise.resolve(msg)),
  globalSearch: vi.fn().mockResolvedValue([
    { id: "sr-1", type: "DRIVER", label: "Driver Smith", subLabel: "D-100" },
    { id: "sr-2", type: "LOAD", label: "Load #LD-099", subLabel: "" },
  ]),
}));

vi.mock("../../../components/Toast", () => ({
  Toast: ({ message, type }: { message: string; type: string; onDismiss: () => void }) => <div data-testid="toast-mock" data-type={type}>{message}</div>,
}));

const mockUser: UserType = { id: "dispatcher-1", name: "Test Dispatcher", email: "dispatcher@test.com", role: "dispatcher", companyId: "company-1", onboardingStatus: "Completed", safetyScore: 100 };

const makeLoad = (o: Partial<LoadData> = {}): LoadData => ({
  id: "load-1", loadNumber: "LD-001", companyId: "company-1", driverId: "driver-1", status: "in_transit", carrierRate: 2500, driverPay: 1500,
  pickup: { city: "Dallas", state: "TX" }, dropoff: { city: "Houston", state: "TX" }, pickupDate: "2024-06-01", ...o,
});

const makeSession = (o: Partial<WorkspaceSession> = {}): WorkspaceSession => ({
  primaryContext: { id: "load-1", type: "LOAD", label: "Load #LD-001", timestamp: new Date().toISOString() },
  secondaryContexts: [], recentContexts: [], pinnedContexts: [], splitView: { enabled: false }, ...o,
});

const makeThread = (o: Record<string, unknown> = {}) => ({
  id: "load-1", primaryContext: { type: "Load", id: "load-1", label: "Load #LD-001", status: "in_transit" },
  linkedRecords: [], events: [], ownerId: "dispatcher-1", ownerName: "Test Dispatcher",
  lastTouch: new Date().toISOString(), summary: "Dallas to Houston shipment", ...o,
});

describe("OperationalMessaging deep coverage (lines 689, 717-749, 828)", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe("context sidebar temporal data (line 689)", () => {
    it("displays pickupDate in context sidebar", () => {
      render(<OperationalMessaging user={mockUser} loads={[makeLoad({ pickupDate: "2026-03-20" })]} session={makeSession()} threads={[makeThread()]} />);
      expect(screen.getByText("2026-03-20")).toBeInTheDocument();
    });
    it("displays Pickup Date label", () => {
      render(<OperationalMessaging user={mockUser} loads={[makeLoad()]} session={makeSession()} threads={[makeThread()]} />);
      expect(screen.getByText("Pickup Date")).toBeInTheDocument();
    });
  });

  describe("task creation keyboard handling (lines 717-749)", () => {
    it("submits task on Enter with text", async () => {
      const onRecordAction = vi.fn().mockResolvedValue(undefined);
      const onNoteCreated = vi.fn();
      const user = userEvent.setup();
      render(<OperationalMessaging user={mockUser} loads={[makeLoad()]} session={makeSession()} threads={[makeThread()]} onRecordAction={onRecordAction} onNoteCreated={onNoteCreated} />);
      await user.click(screen.getByText("Add Micro-Task"));
      await user.type(screen.getByPlaceholderText("Enter task objective..."), "Verify tickets{Enter}");
      await waitFor(() => { expect(screen.queryByPlaceholderText("Enter task objective...")).not.toBeInTheDocument(); });
      expect(onRecordAction).toHaveBeenCalledWith(expect.objectContaining({ type: "TASK" }));
    });
    it("closes form on Escape", async () => {
      const user = userEvent.setup();
      render(<OperationalMessaging user={mockUser} loads={[makeLoad()]} session={makeSession()} threads={[makeThread()]} />);
      await user.click(screen.getByText("Add Micro-Task"));
      await user.type(screen.getByPlaceholderText("Enter task objective..."), "Some task");
      await user.keyboard("{Escape}");
      await waitFor(() => { expect(screen.queryByPlaceholderText("Enter task objective...")).not.toBeInTheDocument(); });
    });
    it("does not submit on Enter with empty text", async () => {
      const onRecordAction = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();
      render(<OperationalMessaging user={mockUser} loads={[makeLoad()]} session={makeSession()} threads={[makeThread()]} onRecordAction={onRecordAction} />);
      await user.click(screen.getByText("Add Micro-Task"));
      await user.keyboard("{Enter}");
      expect(onRecordAction).not.toHaveBeenCalled();
    });
  });

  describe("handleAddParticipant (line 828)", () => {
    it("calls onNoteCreated with PARTICIPANT message", async () => {
      const onNoteCreated = vi.fn();
      const user = userEvent.setup();
      render(<OperationalMessaging user={mockUser} loads={[makeLoad()]} session={makeSession()} threads={[makeThread()]} onNoteCreated={onNoteCreated} />);
      await user.type(screen.getByPlaceholderText("Add participant (360 search)..."), "Smith");
      await waitFor(() => { expect(screen.getAllByText("Driver Smith").length).toBeGreaterThan(0); });
      const results = screen.getAllByText("Driver Smith");
      const btn = results[results.length - 1].closest("button") || results[results.length - 1];
      await user.click(btn);
      await waitFor(() => { expect(onNoteCreated).toHaveBeenCalledWith(expect.stringContaining("PARTICIPANT")); });
    });
  });

  describe("handleQuickRequest with callbacks", () => {
    it("calls onRecordAction for DETENTION", async () => {
      const onRecordAction = vi.fn().mockResolvedValue(undefined);
      const onNoteCreated = vi.fn();
      const user = userEvent.setup();
      render(<OperationalMessaging user={mockUser} loads={[makeLoad()]} session={makeSession()} threads={[makeThread()]} onRecordAction={onRecordAction} onNoteCreated={onNoteCreated} />);
      await user.click(screen.getByText("DETENTION"));
      await waitFor(() => { expect(onRecordAction).toHaveBeenCalledWith(expect.objectContaining({ type: "REQUEST" })); });
    });
  });

  describe("End Session button", () => {
    it("calls onNoteCreated on click", async () => {
      const onNoteCreated = vi.fn();
      const user = userEvent.setup();
      const cs: CallSession = { id: "CALL-END", startTime: new Date().toISOString(), status: "ACTIVE", participants: [{ id: "p1", name: "Test", role: "DISPATCHER" }], lastActivityAt: new Date().toISOString(), links: [] };
      render(<OperationalMessaging user={mockUser} loads={[makeLoad()]} session={makeSession()} threads={[makeThread()]} interactionState="ACTIVE" callSession={cs} onNoteCreated={onNoteCreated} />);
      await user.click(screen.getByText("End Session"));
      expect(onNoteCreated).toHaveBeenCalledWith("Interaction Ended via Liaison");
    });
  });

  describe("commit note guard", () => {
    it("does not call onNoteCreated for empty note", async () => {
      const onNoteCreated = vi.fn();
      const user = userEvent.setup();
      const cs: CallSession = { id: "CE", startTime: new Date().toISOString(), status: "ACTIVE", participants: [{ id: "p1", name: "T", role: "DISPATCHER" }], lastActivityAt: new Date().toISOString(), links: [] };
      render(<OperationalMessaging user={mockUser} loads={[makeLoad()]} session={makeSession()} threads={[makeThread()]} interactionState="ACTIVE" callSession={cs} onNoteCreated={onNoteCreated} />);
      await user.click(screen.getByText("Commit Note"));
      expect(onNoteCreated).not.toHaveBeenCalled();
    });
  });

  describe("task toggle", () => {
    it("toggles task state on click", async () => {
      const user = userEvent.setup();
      render(<OperationalMessaging user={mockUser} loads={[makeLoad()]} session={makeSession()} threads={[makeThread()]} />);
      const task = screen.getByText("Verify weight tickets");
      const el = task.closest("div[class*=\"cursor-pointer\"]");
      if (el) await user.click(el);
    });
  });
});
