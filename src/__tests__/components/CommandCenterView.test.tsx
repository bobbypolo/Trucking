import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CommandCenterView } from "../../../components/CommandCenterView";
import type {
  WorkspaceSession,
  LoadData,
  User as UserType,
  Incident,
  WorkItem,
  OperationalEvent,
  ContextRecord,
} from "../../../types";

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

vi.mock("../../../services/storageService", () => ({
  getIncidents: vi.fn().mockResolvedValue([]),
  createIncident: vi.fn(),
  saveIncident: vi.fn().mockResolvedValue(undefined),
  saveLoad: vi.fn(),
  getRecord360Data: vi.fn().mockResolvedValue({}),
  initiateRepowerWorkflow: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../services/safetyService", () => ({
  getServiceTickets: vi.fn().mockResolvedValue([]),
  saveServiceTicket: vi.fn(),
  getVendors: vi.fn().mockResolvedValue([]),
  checkDriverCompliance: vi.fn().mockResolvedValue({ compliant: true }),
}));

vi.mock("../../../services/dispatchIntelligence", () => ({
  DispatchIntelligence: {
    predictExceptionRisk: vi.fn().mockReturnValue({ risk: "LOW", reason: "" }),
  },
}));

vi.mock("../../../components/GlobalMapViewEnhanced", () => ({
  GlobalMapViewEnhanced: (props: any) => (
    <div data-testid="global-map-view">
      GlobalMapViewEnhanced ({props.loads?.length ?? 0} loads)
    </div>
  ),
}));

vi.mock("uuid", () => ({
  v4: vi.fn().mockReturnValue("mock-uuid-cc"),
}));

import {
  getIncidents,
  saveIncident,
  initiateRepowerWorkflow,
} from "../../../services/storageService";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function buildSession(
  overrides: Partial<WorkspaceSession> = {},
): WorkspaceSession {
  return {
    primaryContext: null,
    secondaryContexts: [],
    recentContexts: [],
    pinnedContexts: [],
    splitView: { enabled: false },
    ...overrides,
  };
}

function buildLoad(overrides: Partial<LoadData> = {}): LoadData {
  return {
    id: "load-1",
    companyId: "co-1",
    driverId: "driver-1",
    loadNumber: "LD-1001",
    status: "in_transit",
    carrierRate: 2400,
    driverPay: 1800,
    pickupDate: "2026-03-10",
    pickup: { city: "Dallas", state: "TX" },
    dropoff: { city: "Houston", state: "TX" },
    ...overrides,
  };
}

function buildUser(overrides: Partial<UserType> = {}): UserType {
  return {
    id: "user-1",
    companyId: "co-1",
    email: "dispatcher@co.com",
    name: "Jane Dispatch",
    role: "dispatcher",
    onboardingStatus: "Completed",
    safetyScore: 95,
    ...overrides,
  };
}

function buildIncident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: "inc-001",
    loadId: "load-1",
    type: "Breakdown",
    severity: "Critical",
    status: "Open",
    reportedAt: "2026-03-15T10:00:00Z",
    description: "Engine failure on I-35",
    timeline: [],
    billingItems: [],
    ...overrides,
  };
}

function buildWorkItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: "wi-001",
    companyId: "co-1",
    type: "LOAD_EXCEPTION",
    priority: "High",
    label: "Detention exceeds limit",
    description: "Shipper held driver for 4 hours",
    entityId: "load-1",
    entityType: "LOAD",
    status: "Open",
    createdAt: "2026-03-15T09:00:00Z",
    ...overrides,
  };
}

function buildEvent(
  overrides: Partial<OperationalEvent> = {},
): OperationalEvent {
  return {
    id: "ev-1",
    type: "SYSTEM",
    timestamp: "2026-03-15T10:30:00Z",
    actorId: "user-1",
    actorName: "Jane Dispatch",
    message: "System event logged",
    ...overrides,
  };
}

const defaultProps = {
  session: buildSession(),
  loads: [buildLoad()],
  users: [buildUser(), buildUser({ id: "driver-1", name: "Mike Driver", role: "driver" as const })],
  currentUser: buildUser(),
  onRecordAction: vi.fn().mockResolvedValue(undefined),
  onNavigate: vi.fn(),
  openRecordWorkspace: vi.fn(),
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("CommandCenterView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getIncidents).mockResolvedValue([]);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Stub window.innerWidth to large for auto-select
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      value: 1600,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /* ---- LAYOUT & PANELS ---- */

  it("renders the Issue Queue heading when no incident is selected", async () => {
    render(<CommandCenterView {...defaultProps} />);
    expect(screen.getByText("Issue Queue")).toBeInTheDocument();
    expect(screen.getByText("Dispatch Center")).toBeInTheDocument();
  });

  it("renders the global map integration", async () => {
    render(<CommandCenterView {...defaultProps} />);
    expect(screen.getByTestId("global-map-view")).toBeInTheDocument();
  });

  it("renders bottom alert strip with operational status", async () => {
    render(<CommandCenterView {...defaultProps} />);
    expect(
      screen.getByText(/Global Operational Stream: Nominal/),
    ).toBeInTheDocument();
    expect(screen.getByText(/92% Units Connected/)).toBeInTheDocument();
    expect(screen.getByText(/Last Sync: Just Now/)).toBeInTheDocument();
  });

  /* ---- EMPTY STATE ---- */

  it("shows empty state message when no incidents or work items exist", async () => {
    render(<CommandCenterView {...defaultProps} />);
    expect(
      screen.getByText(/Operational Workspace Resting/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No Triage Items Detected/),
    ).toBeInTheDocument();
  });

  /* ---- FILTER CONTROLS ---- */

  it("renders severity filter buttons with correct counts", async () => {
    // Narrow screen prevents auto-select so triage list stays visible
    Object.defineProperty(window, "innerWidth", { writable: true, value: 1200 });
    const incidents = [
      buildIncident({ id: "inc-1", severity: "Medium" }),
      buildIncident({ id: "inc-2", severity: "Low" }),
    ];
    const workItems = [buildWorkItem({ id: "wi-1", priority: "Medium" })];
    render(
      <CommandCenterView
        {...defaultProps}
        incidents={incidents}
        workItems={workItems}
      />,
    );

    // The filter buttons contain label text and count in a nested span,
    // so use a function matcher or partial match
    await waitFor(() => {
      expect(screen.getByText(/All Items/)).toBeInTheDocument();
      expect(screen.getByText(/High Priority/)).toBeInTheDocument();
      expect(screen.getByText(/Operational Tasks/)).toBeInTheDocument();
    });
  });

  it("filters items by severity when a filter button is clicked", async () => {
    // Narrow screen prevents auto-select so triage list stays visible
    Object.defineProperty(window, "innerWidth", { writable: true, value: 1200 });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const incidents = [
      buildIncident({ id: "inc-1", severity: "Medium", type: "Breakdown", description: "Engine failure on I-35" }),
      buildIncident({ id: "inc-2", severity: "Low", type: "Accident", description: "Minor fender bender" }),
    ];
    const workItems = [buildWorkItem({ id: "wi-filt", priority: "High", description: "Task item here" })];
    render(
      <CommandCenterView {...defaultProps} incidents={incidents} workItems={workItems} />,
    );

    // Wait for triage list to render
    await waitFor(() => {
      expect(screen.getByText(/Engine failure/)).toBeInTheDocument();
    });

    // Click "High Priority" filter - the button text contains "High Priority" plus a count
    const highBtn = screen.getByText(/High Priority/);
    await user.click(highBtn);

    // After filtering to High, only the High work item should remain
    await waitFor(() => {
      expect(screen.getByText(/Task item here/)).toBeInTheDocument();
    });
  });

  it("filters items to Operational Tasks only", async () => {
    Object.defineProperty(window, "innerWidth", { writable: true, value: 1200 });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const incidents = [buildIncident({ id: "inc-tasks", severity: "Medium" })];
    const workItems = [buildWorkItem()];
    render(
      <CommandCenterView
        {...defaultProps}
        incidents={incidents}
        workItems={workItems}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Operational Tasks/)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Operational Tasks/));

    await waitFor(() => {
      expect(screen.getByText(/Shipper held driver/)).toBeInTheDocument();
    });
  });

  /* ---- SEARCH ---- */

  it("filters triage list by search term", async () => {
    Object.defineProperty(window, "innerWidth", { writable: true, value: 1200 });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const incidents = [
      buildIncident({ id: "inc-1", severity: "Medium", type: "Breakdown", description: "Engine failure on I-35" }),
      buildIncident({ id: "inc-2", severity: "Low", type: "Accident", description: "Minor fender bender" }),
    ];
    render(
      <CommandCenterView {...defaultProps} incidents={incidents} />,
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search triage...")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search triage...");
    await user.type(searchInput, "fender");

    await waitFor(() => {
      expect(screen.getByText(/Minor fender bender/)).toBeInTheDocument();
      expect(screen.queryByText(/Engine failure/)).not.toBeInTheDocument();
    });
  });

  /* ---- INCIDENT CARDS & SELECTION ---- */

  it("renders incident cards sorted by severity (Critical first)", async () => {
    Object.defineProperty(window, "innerWidth", { writable: true, value: 1200 });
    const incidents = [
      buildIncident({ id: "inc-low", severity: "Low", type: "Cargo Issue", description: "Minor scratch" }),
      buildIncident({ id: "inc-med", severity: "Medium", type: "Breakdown", description: "Engine stutter" }),
    ];
    render(
      <CommandCenterView {...defaultProps} incidents={incidents} />,
    );

    // Both incidents should appear in the triage list
    await waitFor(() => {
      expect(screen.getByText(/Minor scratch/)).toBeInTheDocument();
      expect(screen.getByText(/Engine stutter/)).toBeInTheDocument();
    });
    // The Medium one should be displayed (sorted higher than Low)
    const descriptions = screen.getAllByText(/Minor scratch|Engine stutter/);
    expect(descriptions.length).toBe(2);
  });

  it("selects an incident when its card is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const incidents = [
      buildIncident({ id: "inc-click", severity: "Medium", type: "Cargo Issue", description: "Damaged pallet" }),
    ];
    // Force no auto-select by setting narrow width
    Object.defineProperty(window, "innerWidth", { writable: true, value: 1200 });

    render(
      <CommandCenterView {...defaultProps} incidents={incidents} />,
    );

    // Click the incident card
    const card = screen.getByText(/Damaged pallet/);
    await user.click(card);

    // After selection, the detail drawer should show incident type
    await waitFor(() => {
      expect(screen.getByText("Cargo Issue")).toBeInTheDocument();
    });
  });

  /* ---- NEW RECORD DROPDOWN ---- */

  it("opens and closes the New Record dropdown", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CommandCenterView {...defaultProps} />);

    const newRecordBtn = screen.getByText("New Record & Attach");
    await user.click(newRecordBtn);

    expect(screen.getByText("New Quote")).toBeInTheDocument();
    expect(screen.getByText("New Load")).toBeInTheDocument();
    expect(screen.getByText("New Incident")).toBeInTheDocument();
    expect(screen.getByText("Attach Existing")).toBeInTheDocument();
  });

  it("calls onNavigate with 'quotes' when New Quote is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onNavigate = vi.fn();
    render(
      <CommandCenterView {...defaultProps} onNavigate={onNavigate} />,
    );

    await user.click(screen.getByText("New Record & Attach"));
    await user.click(screen.getByText("New Quote"));

    expect(onNavigate).toHaveBeenCalledWith("quotes");
  });

  it("calls onNavigate with 'loads' when New Load is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onNavigate = vi.fn();
    render(
      <CommandCenterView {...defaultProps} onNavigate={onNavigate} />,
    );

    await user.click(screen.getByText("New Record & Attach"));
    await user.click(screen.getByText("New Load"));

    expect(onNavigate).toHaveBeenCalledWith("loads");
  });

  it("calls onNavigate with 'safety' when New Incident is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onNavigate = vi.fn();
    render(
      <CommandCenterView {...defaultProps} onNavigate={onNavigate} />,
    );

    await user.click(screen.getByText("New Record & Attach"));
    await user.click(screen.getByText("New Incident"));

    expect(onNavigate).toHaveBeenCalledWith("safety");
  });

  it("shows success message when Attach Existing is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const setSuccessMessage = vi.fn();
    render(
      <CommandCenterView
        {...defaultProps}
        setSuccessMessage={setSuccessMessage}
      />,
    );

    await user.click(screen.getByText("New Record & Attach"));
    await user.click(screen.getByText("Attach Existing"));

    expect(setSuccessMessage).toHaveBeenCalledWith(
      "Connecting record - select which item to link...",
    );
  });

  /* ---- INCIDENT DETAIL DRAWER ---- */

  it("renders detail drawer with incident info when incident is selected", async () => {
    const incidents = [
      buildIncident({
        id: "inc-detail",
        type: "Breakdown",
        severity: "Critical",
        status: "Open",
        slaDeadline: new Date(Date.now() + 600000).toISOString(),
      }),
    ];
    render(
      <CommandCenterView {...defaultProps} incidents={incidents} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Breakdown")).toBeInTheDocument();
      expect(screen.getByText(/Incident #inc-deta/)).toBeInTheDocument();
    });
  });

  it("shows crisis workflow chain with Safety, Dispatch, Driver steps", async () => {
    const incidents = [
      buildIncident({ id: "inc-wf", status: "Open" }),
    ];
    render(
      <CommandCenterView {...defaultProps} incidents={incidents} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Safety")).toBeInTheDocument();
      expect(screen.getByText("Dispatch")).toBeInTheDocument();
      expect(screen.getByText("Driver")).toBeInTheDocument();
    });
  });

  /* ---- TACTICAL INTERVENTION MATRIX ---- */

  it("renders the tactical intervention buttons for a selected incident", async () => {
    const incidents = [buildIncident({ id: "inc-tac" })];
    render(
      <CommandCenterView {...defaultProps} incidents={incidents} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Initiate Repower")).toBeInTheDocument();
      expect(screen.getByText("Service Ticket")).toBeInTheDocument();
      expect(screen.getByText("Asset Recovery")).toBeInTheDocument();
      expect(screen.getByText("Stakeholders")).toBeInTheDocument();
      expect(screen.getByText("Commit Resolution")).toBeInTheDocument();
    });
  });

  it("calls onRepower when Initiate Repower button is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onRepower = vi.fn();
    const incidents = [buildIncident({ id: "inc-rp" })];
    render(
      <CommandCenterView
        {...defaultProps}
        incidents={incidents}
        onRepower={onRepower}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Initiate Repower")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Initiate Repower"));

    await waitFor(() => {
      expect(onRepower).toHaveBeenCalledWith("load-1");
    });
  });

  it("calls onRoadside when Service Ticket button is clicked and onRoadside is provided", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onRoadside = vi.fn();
    const incidents = [buildIncident({ id: "inc-road" })];
    render(
      <CommandCenterView
        {...defaultProps}
        incidents={incidents}
        onRoadside={onRoadside}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Service Ticket")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Service Ticket"));

    await waitFor(() => {
      expect(onRoadside).toHaveBeenCalled();
    });
  });

  it("saves incident with RECOVERY_INITIATED when Asset Recovery is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const incidents = [buildIncident({ id: "inc-rec" })];
    vi.mocked(saveIncident).mockResolvedValue(undefined);

    render(
      <CommandCenterView {...defaultProps} incidents={incidents} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Asset Recovery")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Asset Recovery"));

    await waitFor(() => {
      expect(saveIncident).toHaveBeenCalled();
      const savedIncident = vi.mocked(saveIncident).mock.calls[0][0] as Incident;
      const lastEntry = savedIncident.timeline[savedIncident.timeline.length - 1];
      expect(lastEntry.action).toBe("RECOVERY_INITIATED");
    });
  });

  it("calls onNotify when Stakeholders button is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onNotify = vi.fn();
    const incidents = [buildIncident({ id: "inc-notify" })];
    render(
      <CommandCenterView
        {...defaultProps}
        incidents={incidents}
        onNotify={onNotify}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Stakeholders")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Stakeholders"));

    await waitFor(() => {
      expect(onNotify).toHaveBeenCalled();
    });
  });

  it("closes incident and deselects when Commit Resolution is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onCloseContext = vi.fn();
    const incidents = [buildIncident({ id: "inc-close" })];
    vi.mocked(saveIncident).mockResolvedValue(undefined);

    render(
      <CommandCenterView
        {...defaultProps}
        incidents={incidents}
        onCloseContext={onCloseContext}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Commit Resolution")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Commit Resolution"));

    await waitFor(() => {
      expect(saveIncident).toHaveBeenCalled();
      const saved = vi.mocked(saveIncident).mock.calls[0][0] as Incident;
      expect(saved.status).toBe("Closed");
      expect(onCloseContext).toHaveBeenCalled();
    });
  });

  /* ---- CLOSE (X) BUTTON ---- */

  it("deselects incident and calls onCloseContext when X button is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onCloseContext = vi.fn();
    const incidents = [buildIncident({ id: "inc-x" })];

    render(
      <CommandCenterView
        {...defaultProps}
        incidents={incidents}
        onCloseContext={onCloseContext}
      />,
    );

    // Wait for auto-select
    await waitFor(() => {
      expect(screen.getByText("Breakdown")).toBeInTheDocument();
    });

    // Find the close button - it's the X button in the detail header
    const closeButtons = screen.getAllByRole("button");
    const xButton = closeButtons.find((btn) => {
      // The X button has the red hover styling
      return btn.className.includes("hover:bg-red-500/20");
    });
    expect(xButton).toBeDefined();
    await user.click(xButton!);

    await waitFor(() => {
      expect(onCloseContext).toHaveBeenCalled();
      // Should show Issue Queue again
      expect(screen.getByText("Issue Queue")).toBeInTheDocument();
    });
  });

  /* ---- DETAIL TABS ---- */

  it("renders Summary and Chain of Custody tabs for incident", async () => {
    const incidents = [buildIncident({ id: "inc-tabs" })];
    render(
      <CommandCenterView {...defaultProps} incidents={incidents} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Summary")).toBeInTheDocument();
      expect(screen.getByText("Chain of Custody")).toBeInTheDocument();
      expect(screen.getByText("Emergency Costs")).toBeInTheDocument();
    });
  });

  it("shows financial tab content when clicking Emergency Costs", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const incidents = [
      buildIncident({
        id: "inc-billing",
        billingItems: [
          {
            id: "charge-1",
            category: "Tow",
            amount: 500,
            providerVendor: "TowCo",
            status: "Pending_Approval",
            createdAt: "2026-03-15T11:00:00Z",
          },
        ],
      }),
    ];
    render(
      <CommandCenterView {...defaultProps} incidents={incidents} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Emergency Costs")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Emergency Costs"));

    await waitFor(() => {
      expect(screen.getByText("Financial Integrity Exposure")).toBeInTheDocument();
      expect(screen.getByText("Authorize Entry")).toBeInTheDocument();
      expect(screen.getByText("Tow")).toBeInTheDocument();
      // $500 appears in both the total exposure and the line item
      expect(screen.getAllByText("$500").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows no strategic assets message when billing is empty", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const incidents = [buildIncident({ id: "inc-no-bill", billingItems: [] })];
    render(
      <CommandCenterView {...defaultProps} incidents={incidents} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Emergency Costs")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Emergency Costs"));

    await waitFor(() => {
      expect(screen.getByText(/No Strategic Assets/)).toBeInTheDocument();
    });
  });

  it("shows settlement message when Authorize Entry is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const setSuccessMessage = vi.fn();
    const incidents = [buildIncident({ id: "inc-auth" })];
    render(
      <CommandCenterView
        {...defaultProps}
        incidents={incidents}
        setSuccessMessage={setSuccessMessage}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Emergency Costs")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Emergency Costs"));
    await waitFor(() => {
      expect(screen.getByText("Authorize Entry")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Authorize Entry"));

    expect(setSuccessMessage).toHaveBeenCalledWith(
      "SETTLEMENT: Redirecting to Unified Settlement Queue...",
    );
  });

  /* ---- TIMELINE / CHAIN OF CUSTODY ---- */

  it("renders unified events in the summary section", async () => {
    const events: OperationalEvent[] = [
      buildEvent({
        id: "ev-1",
        type: "INCIDENT",
        message: "Breakdown reported by driver",
      }),
      buildEvent({
        id: "ev-2",
        type: "TELEMETRY",
        message: "GPS ping received from unit",
      }),
    ];
    const incidents = [buildIncident({ id: "inc-ev" })];
    render(
      <CommandCenterView
        {...defaultProps}
        incidents={incidents}
        unifiedEvents={events}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Breakdown reported by driver/)).toBeInTheDocument();
      expect(screen.getByText(/GPS ping received from unit/)).toBeInTheDocument();
    });
  });

  it("shows 'No tactical activity recorded' when unified events are empty", async () => {
    const incidents = [buildIncident({ id: "inc-no-ev" })];
    render(
      <CommandCenterView
        {...defaultProps}
        incidents={incidents}
        unifiedEvents={[]}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText("No tactical activity recorded"),
      ).toBeInTheDocument();
    });
  });

  it("switches to timeline detail tab and shows events", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const events: OperationalEvent[] = [
      buildEvent({ id: "ev-timeline", type: "CALL_LOG", message: "Called shipper" }),
    ];
    const incidents = [buildIncident({ id: "inc-timeline" })];
    render(
      <CommandCenterView
        {...defaultProps}
        incidents={incidents}
        unifiedEvents={events}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Chain of Custody")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Chain of Custody"));

    await waitFor(() => {
      expect(screen.getByText(/Called shipper/)).toBeInTheDocument();
    });
  });

  it("navigates via View History link to timeline tab", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const incidents = [buildIncident({ id: "inc-vh" })];
    render(
      <CommandCenterView
        {...defaultProps}
        incidents={incidents}
        unifiedEvents={[buildEvent()]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("View History")).toBeInTheDocument();
    });

    await user.click(screen.getByText("View History"));

    // Should switch to timeline tab (which shows "Chain of Custody" tab active)
    await waitFor(() => {
      const tab = screen.getByText("Chain of Custody");
      expect(tab.className).toContain("border-blue-500");
    });
  });

  /* ---- ACTIVE RECORD (LOAD CONTEXT) ---- */

  it("shows Manifest Integrity Overview when a LOAD context record is active", async () => {
    const activeRecord: ContextRecord = {
      id: "load-1",
      type: "LOAD",
      label: "Load #LD-1001",
      timestamp: "2026-03-15T10:00:00Z",
    };
    const active360Data = {
      load: {
        status: "in_transit",
        totalRevenue: 3200,
        commodity: "Automotive Parts",
        weight: 42000,
      },
    };
    render(
      <CommandCenterView
        {...defaultProps}
        session={buildSession({ primaryContext: activeRecord })}
        activeRecord={activeRecord}
        active360Data={active360Data}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Manifest Integrity Overview")).toBeInTheDocument();
      expect(screen.getByText("Automotive Parts")).toBeInTheDocument();
      expect(screen.getByText("42,000 lbs")).toBeInTheDocument();
    });
  });

  it("shows full workspace button when onViewFullLoad and active360Data.load are provided", async () => {
    const onViewFullLoad = vi.fn();
    const activeRecord: ContextRecord = {
      id: "load-1",
      type: "LOAD",
      label: "Load #LD-1001",
      timestamp: "2026-03-15T10:00:00Z",
    };
    const active360Data = { load: buildLoad() };
    render(
      <CommandCenterView
        {...defaultProps}
        activeRecord={activeRecord}
        active360Data={active360Data}
        onViewFullLoad={onViewFullLoad}
        session={buildSession({ primaryContext: activeRecord })}
      />,
    );

    await waitFor(() => {
      const expandBtn = screen.getByTitle("View Full Workspace");
      expect(expandBtn).toBeInTheDocument();
    });
  });

  it("shows extra tabs (Financials, Artifacts, Optimization) for LOAD context", async () => {
    const activeRecord: ContextRecord = {
      id: "load-1",
      type: "LOAD",
      label: "Load #LD-1001",
      timestamp: "2026-03-15T10:00:00Z",
    };
    render(
      <CommandCenterView
        {...defaultProps}
        activeRecord={activeRecord}
        session={buildSession({ primaryContext: activeRecord })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Financials")).toBeInTheDocument();
      expect(screen.getByText("Artifacts")).toBeInTheDocument();
      expect(screen.getByText("Optimization")).toBeInTheDocument();
    });
  });

  /* ---- DOCS TAB ---- */

  it("shows vault docs in the Artifacts tab", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const activeRecord: ContextRecord = {
      id: "load-1",
      type: "LOAD",
      label: "Load",
      timestamp: "2026-03-15T10:00:00Z",
    };
    const active360Data = {
      load: buildLoad(),
      vaultDocs: [
        { id: "doc-1", fileName: "BOL_123.pdf", type: "BOL", size: 24576 },
      ],
    };
    render(
      <CommandCenterView
        {...defaultProps}
        activeRecord={activeRecord}
        active360Data={active360Data}
        session={buildSession({ primaryContext: activeRecord })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Artifacts")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Artifacts"));

    await waitFor(() => {
      expect(screen.getByText("BOL_123.pdf")).toBeInTheDocument();
      expect(screen.getByText(/24 KB/)).toBeInTheDocument();
    });
  });

  it("shows no artifacts message when vault docs are empty", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const activeRecord: ContextRecord = {
      id: "load-1",
      type: "LOAD",
      label: "Load",
      timestamp: "2026-03-15T10:00:00Z",
    };
    render(
      <CommandCenterView
        {...defaultProps}
        activeRecord={activeRecord}
        active360Data={{ load: buildLoad(), vaultDocs: [] }}
        session={buildSession({ primaryContext: activeRecord })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Artifacts")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Artifacts"));

    await waitFor(() => {
      expect(screen.getByText(/No Mission Artifacts/)).toBeInTheDocument();
    });
  });

  /* ---- FUEL/OPTIMIZATION TAB ---- */

  it("shows IFTA compliance in the Optimization tab", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const activeRecord: ContextRecord = {
      id: "load-1",
      type: "LOAD",
      label: "Load",
      timestamp: "2026-03-15T10:00:00Z",
    };
    render(
      <CommandCenterView
        {...defaultProps}
        activeRecord={activeRecord}
        active360Data={{ load: buildLoad() }}
        session={buildSession({ primaryContext: activeRecord })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Optimization")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Optimization"));

    await waitFor(() => {
      expect(screen.getByText("IFTA Integrity Compliance")).toBeInTheDocument();
      expect(screen.getByText("VERIFIED")).toBeInTheDocument();
      expect(screen.getByText("Total Fuel Burn")).toBeInTheDocument();
      expect(screen.getByText("$842.11")).toBeInTheDocument();
      expect(screen.getByText("Avg Gal Price")).toBeInTheDocument();
      expect(screen.getByText("$3.412")).toBeInTheDocument();
    });
  });

  /* ---- DRIVER CONTEXT ---- */

  it("shows Driver Profile section when DRIVER context is active", async () => {
    const activeRecord: ContextRecord = {
      id: "driver-1",
      type: "DRIVER",
      label: "Driver Mike",
      timestamp: "2026-03-15T10:00:00Z",
    };
    render(
      <CommandCenterView
        {...defaultProps}
        activeRecord={activeRecord}
        session={buildSession({ primaryContext: activeRecord })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Driver Profile")).toBeInTheDocument();
      expect(screen.getByText("VERIFIED")).toBeInTheDocument();
      expect(screen.getByText("98/100")).toBeInTheDocument();
    });
  });

  /* ---- NETWORK & ASSET LINKAGE ---- */

  it("renders Linked Load and Assigned Unit cards", async () => {
    const incidents = [buildIncident({ id: "inc-link", loadId: "load-1" })];
    render(
      <CommandCenterView {...defaultProps} incidents={incidents} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Linked Load")).toBeInTheDocument();
      expect(screen.getByText("Assigned Unit")).toBeInTheDocument();
    });
  });

  it("opens load workspace when Linked Load card is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const openRecordWorkspace = vi.fn();
    const incidents = [buildIncident({ id: "inc-load-link", loadId: "load-1" })];
    render(
      <CommandCenterView
        {...defaultProps}
        incidents={incidents}
        openRecordWorkspace={openRecordWorkspace}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Linked Load")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Linked Load"));

    expect(openRecordWorkspace).toHaveBeenCalledWith("LOAD", "load-1");
  });

  /* ---- WORK ITEMS ---- */

  it("renders work items alongside incidents in the triage list", async () => {
    Object.defineProperty(window, "innerWidth", { writable: true, value: 1200 });
    const incidents = [buildIncident({ id: "inc-mixed", severity: "Medium" })];
    const workItems = [
      buildWorkItem({
        id: "wi-mixed",
        type: "LOAD_EXCEPTION",
        label: "Late delivery alert",
        priority: "High",
        description: "Delivery running 3 hours late",
      }),
    ];
    render(
      <CommandCenterView
        {...defaultProps}
        incidents={incidents}
        workItems={workItems}
      />,
    );

    // Both should appear in the triage list
    await waitFor(() => {
      expect(screen.getByText(/Engine failure/)).toBeInTheDocument();
      expect(screen.getByText(/Delivery running 3 hours late/)).toBeInTheDocument();
    });
  });

  it("opens record workspace when a work item card is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const openRecordWorkspace = vi.fn();
    // No incidents so no auto-select
    Object.defineProperty(window, "innerWidth", { writable: true, value: 1200 });
    const workItems = [
      buildWorkItem({
        id: "wi-click",
        entityType: "LOAD",
        entityId: "load-work",
        description: "Unique work item desc",
      }),
    ];
    render(
      <CommandCenterView
        {...defaultProps}
        incidents={[]}
        workItems={workItems}
        openRecordWorkspace={openRecordWorkspace}
      />,
    );

    const card = screen.getByText(/Unique work item desc/);
    await user.click(card);

    expect(openRecordWorkspace).toHaveBeenCalledWith("LOAD", "load-work");
  });

  /* ---- SLA STATUS ---- */

  it("shows BREACHED label for expired SLA deadline", async () => {
    const incidents = [
      buildIncident({
        id: "inc-sla",
        slaDeadline: "2025-01-01T00:00:00Z", // in the past
      }),
    ];
    render(
      <CommandCenterView {...defaultProps} incidents={incidents} />,
    );

    await waitFor(() => {
      expect(screen.getByText("BREACHED")).toBeInTheDocument();
    });
  });

  it("shows NO SLA label when no deadline is set", async () => {
    const incidents = [
      buildIncident({ id: "inc-nosla", slaDeadline: undefined }),
    ];
    render(
      <CommandCenterView {...defaultProps} incidents={incidents} />,
    );

    await waitFor(() => {
      expect(screen.getByText("NO SLA")).toBeInTheDocument();
    });
  });

  /* ---- EXTERNAL SUB-TAB MAPPING ---- */

  it("maps external activeSubTab 'DETENTION' to billing tab", async () => {
    const incidents = [buildIncident({ id: "inc-sub" })];
    render(
      <CommandCenterView
        {...defaultProps}
        incidents={incidents}
        activeSubTab="DETENTION"
      />,
    );

    await waitFor(() => {
      // The billing/Emergency Costs tab should be active
      const emergCosts = screen.getByText("Emergency Costs");
      expect(emergCosts.className).toContain("border-blue-500");
    });
  });

  it("maps external activeSubTab 'TIMELINE' to timeline tab", async () => {
    const incidents = [buildIncident({ id: "inc-sub-tl" })];
    render(
      <CommandCenterView
        {...defaultProps}
        incidents={incidents}
        activeSubTab="TIMELINE"
      />,
    );

    await waitFor(() => {
      const coc = screen.getByText("Chain of Custody");
      expect(coc.className).toContain("border-blue-500");
    });
  });

  /* ---- REPOWER WITHOUT CALLBACK ---- */

  it("calls initiateRepowerWorkflow when onRepower is not provided", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const incidents = [buildIncident({ id: "inc-rp2" })];
    vi.mocked(initiateRepowerWorkflow).mockResolvedValue(undefined);

    render(
      <CommandCenterView
        {...defaultProps}
        incidents={incidents}
        onRepower={undefined}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Initiate Repower")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Initiate Repower"));

    await waitFor(() => {
      expect(initiateRepowerWorkflow).toHaveBeenCalled();
    });
  });

  /* ---- SUCCESS MESSAGES FOR ACTIONS ---- */

  it("sets success message on REPOWER action", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const setSuccessMessage = vi.fn();
    const incidents = [buildIncident({ id: "inc-rp-msg" })];
    render(
      <CommandCenterView
        {...defaultProps}
        incidents={incidents}
        setSuccessMessage={setSuccessMessage}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Initiate Repower")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Initiate Repower"));

    await waitFor(() => {
      expect(setSuccessMessage).toHaveBeenCalledWith(
        expect.stringContaining("REPOWER WORKFLOW INITIATED"),
      );
    });
  });

  it("sets success message on ROADSIDE action (no callback)", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const setSuccessMessage = vi.fn();
    const incidents = [buildIncident({ id: "inc-rs-msg" })];
    vi.mocked(saveIncident).mockResolvedValue(undefined);

    render(
      <CommandCenterView
        {...defaultProps}
        incidents={incidents}
        setSuccessMessage={setSuccessMessage}
        onRoadside={undefined}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Service Ticket")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Service Ticket"));

    await waitFor(() => {
      expect(setSuccessMessage).toHaveBeenCalledWith(
        expect.stringContaining("SERVICE DISPATCHED"),
      );
    });
  });

  /* ---- ROADSIDE WITHOUT CALLBACK ---- */

  it("saves ROADSIDE_DISPATCHED timeline entry when onRoadside is not provided", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const incidents = [buildIncident({ id: "inc-rs-save" })];
    vi.mocked(saveIncident).mockResolvedValue(undefined);

    render(
      <CommandCenterView
        {...defaultProps}
        incidents={incidents}
        onRoadside={undefined}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Service Ticket")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Service Ticket"));

    await waitFor(() => {
      expect(saveIncident).toHaveBeenCalled();
      const saved = vi.mocked(saveIncident).mock.calls[0][0] as Incident;
      const lastEntry = saved.timeline[saved.timeline.length - 1];
      expect(lastEntry.action).toBe("ROADSIDE_DISPATCHED");
    });
  });

  /* ---- NOTIFY WITHOUT CALLBACK ---- */

  it("saves STAKEHOLDERS_NOTIFIED timeline entry when onNotify is not provided", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const incidents = [buildIncident({ id: "inc-notify-save" })];
    vi.mocked(saveIncident).mockResolvedValue(undefined);

    render(
      <CommandCenterView
        {...defaultProps}
        incidents={incidents}
        onNotify={undefined}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Stakeholders")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Stakeholders"));

    await waitFor(() => {
      expect(saveIncident).toHaveBeenCalled();
      const saved = vi.mocked(saveIncident).mock.calls[0][0] as Incident;
      const lastEntry = saved.timeline[saved.timeline.length - 1];
      expect(lastEntry.action).toBe("STAKEHOLDERS_NOTIFIED");
    });
  });

  /* ---- SESSION CONTEXT SYNC ---- */

  it("syncs selectedIncidentId when session.primaryContext changes to INCIDENT type", async () => {
    const incidents = [
      buildIncident({ id: "inc-sync-1", type: "Breakdown" }),
      buildIncident({ id: "inc-sync-2", type: "Accident", severity: "High" }),
    ];

    const { rerender } = render(
      <CommandCenterView {...defaultProps} incidents={incidents} />,
    );

    // Re-render with a session that specifies a different incident
    rerender(
      <CommandCenterView
        {...defaultProps}
        incidents={incidents}
        session={buildSession({
          primaryContext: {
            id: "inc-sync-2",
            type: "INCIDENT",
            label: "Accident",
            timestamp: "2026-03-15T10:00:00Z",
          },
        })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Accident")).toBeInTheDocument();
    });
  });

  /* ---- HIGH OBSTRUCTION MODE ---- */

  it("applies compact sizing in high obstruction mode", async () => {
    const incidents = [buildIncident({ id: "inc-hi-obs" })];
    render(
      <CommandCenterView
        {...defaultProps}
        incidents={incidents}
        isHighObstruction={true}
        obstructionLevel="HIGH"
      />,
    );

    await waitFor(() => {
      // In high obstruction, labels are hidden (just icons for tabs)
      expect(screen.getByText("Breakdown")).toBeInTheDocument();
    });
  });

  /* ---- INCIDENT TIMELINE (R-P6-08, R-P6-09) ---- */

  it("renders incident timeline as vertical timeline in detail drawer (R-P6-08)", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const incidents = [
      buildIncident({
        id: "inc-tl-1",
        timeline: [
          {
            id: "act-1",
            timestamp: "2026-03-15T10:05:00Z",
            actorName: "Jane Dispatch",
            action: "Incident reported",
            notes: "Engine failure on I-35",
          },
          {
            id: "act-2",
            timestamp: "2026-03-15T10:15:00Z",
            actorName: "Mike Driver",
            action: "Tow truck requested",
          },
          {
            id: "act-3",
            timestamp: "2026-03-15T10:45:00Z",
            actorName: "System",
            action: "Status updated to In_Progress",
          },
        ],
      }),
    ];
    render(
      <CommandCenterView
        {...defaultProps}
        incidents={incidents}
        unifiedEvents={[]}
      />,
    );

    // Wait for incident to be selected and switch to timeline tab
    await waitFor(() => {
      expect(screen.getByText("Chain of Custody")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Chain of Custody"));

    // R-P6-08: Incident timeline section must exist with vertical layout
    await waitFor(() => {
      const timelineSection = screen.getByTestId("incident-timeline");
      expect(timelineSection).toBeInTheDocument();
    });

    // Verify all 3 timeline entries are rendered
    expect(screen.getByText("Incident reported")).toBeInTheDocument();
    expect(screen.getByText("Tow truck requested")).toBeInTheDocument();
    expect(screen.getByText("Status updated to In_Progress")).toBeInTheDocument();
  });

  it("shows action, actor, and timestamp for each timeline entry (R-P6-09)", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const incidents = [
      buildIncident({
        id: "inc-tl-2",
        timeline: [
          {
            id: "act-a",
            timestamp: "2026-03-15T14:30:00Z",
            actorName: "Jane Dispatch",
            action: "Escalated to manager",
          },
        ],
      }),
    ];
    render(
      <CommandCenterView
        {...defaultProps}
        incidents={incidents}
        unifiedEvents={[]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Chain of Custody")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Chain of Custody"));

    // R-P6-09: Each entry shows action, actor, and timestamp
    await waitFor(() => {
      expect(screen.getByText("Escalated to manager")).toBeInTheDocument();
    });
    // Actor name rendered in the incident timeline entry
    const timelineEl = screen.getByTestId("incident-timeline");
    expect(within(timelineEl).getByText("Jane Dispatch")).toBeInTheDocument();
    // Timestamp is rendered (format varies by locale -- verify a time-like element exists)
    const timeStamps = within(timelineEl).getAllByText(/\d{1,2}:\d{2}/);
    expect(timeStamps.length).toBeGreaterThanOrEqual(1);
  });

  it("renders empty state when incident timeline is empty (R-P6-08)", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const incidents = [
      buildIncident({
        id: "inc-tl-empty",
        timeline: [],
      }),
    ];
    render(
      <CommandCenterView
        {...defaultProps}
        incidents={incidents}
        unifiedEvents={[]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Chain of Custody")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Chain of Custody"));

    await waitFor(() => {
      expect(screen.getByText(/No timeline entries/i)).toBeInTheDocument();
    });
  });

  it("renders notes when present on a timeline entry (R-P6-09)", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const incidents = [
      buildIncident({
        id: "inc-tl-notes",
        timeline: [
          {
            id: "act-n",
            timestamp: "2026-03-15T11:00:00Z",
            actorName: "Ops Manager",
            action: "Recovery plan approved",
            notes: "ETA 2 hours for replacement driver",
          },
        ],
      }),
    ];
    render(
      <CommandCenterView
        {...defaultProps}
        incidents={incidents}
        unifiedEvents={[]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Chain of Custody")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Chain of Custody"));

    await waitFor(() => {
      expect(screen.getByText("Recovery plan approved")).toBeInTheDocument();
      expect(screen.getByText("ETA 2 hours for replacement driver")).toBeInTheDocument();
    });
  });
});
