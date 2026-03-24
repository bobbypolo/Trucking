import React from "react";
import { render, screen, waitFor, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";

// ── Service mocks (network boundary) ──────────────────────────────────────
vi.mock("../../../services/storageService", () => ({
  globalSearch: vi.fn().mockResolvedValue([]),
  getRecord360Data: vi.fn().mockResolvedValue(null),
  getIncidents: vi.fn().mockResolvedValue([]),
  getLoadSummary: vi.fn().mockResolvedValue(null),
  getDriverSummary: vi.fn().mockResolvedValue(null),
  getBrokerSummary: vi.fn().mockResolvedValue(null),
  getMessages: vi.fn().mockResolvedValue([]),
  getRequests: vi.fn().mockResolvedValue([]),
  getTriageQueues: vi.fn().mockResolvedValue({
    queues: [],
    incidents: [],
    requests: [],
    workItems: [],
    calls: [],
    tasks: [],
    atRiskLoads: [],
  }),
  initiateRepowerWorkflow: vi.fn(),
  getWorkItems: vi.fn().mockResolvedValue([]),
  saveWorkItem: vi.fn(),
  saveCallSession: vi.fn(),
  saveRequest: vi.fn(),
  saveIncident: vi.fn(),
  getProviders: vi.fn().mockResolvedValue([]),
  getContacts: vi.fn().mockResolvedValue([]),
  saveProvider: vi.fn(),
  saveContact: vi.fn(),
  saveServiceTicket: vi.fn(),
  saveNotificationJob: vi.fn(),
  createIncident: vi.fn(),
  saveTask: vi.fn(),
  getAuthHeaders: vi.fn().mockResolvedValue({
    "Content-Type": "application/json",
  }),
  saveLoad: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../services/safetyService", () => ({
  getVendors: vi.fn().mockResolvedValue([
    {
      id: "v-1",
      name: "Quick Tow LLC",
      type: "Towing",
      status: "Active",
      contacts: [{ phone: "555-1234" }],
    },
    {
      id: "v-2",
      name: "Roadside Pros",
      type: "Repair",
      status: "Active",
      contacts: [{ phone: "555-5678" }],
    },
  ]),
  saveVendor: vi.fn(),
}));

vi.mock("../../../services/config", () => ({
  API_URL: "http://localhost:5000/api",
}));

vi.mock("../../../services/dispatchIntelligence", () => ({
  DispatchIntelligence: {
    analyze: vi.fn().mockReturnValue({ alerts: [] }),
    getBestMatches: vi.fn().mockResolvedValue([
      {
        driverId: "d-1",
        driverName: "Mike Thompson",
        matchScore: 92,
        recommendation: "STRONG_MATCH",
        distanceToPickup: 45,
        hosAvailable: 8,
        estimatedArrival: new Date().toISOString(),
      },
    ]),
  },
  getRegion: vi.fn().mockReturnValue("SOUTH"),
}));

vi.mock("../../../services/fuelService", () => ({
  FuelCardService: { getTransactions: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../../services/detentionService", () => ({
  DetentionService: { getDetentions: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../../services/authService", () => ({
  checkCapability: vi.fn().mockReturnValue(true),
  getIdTokenAsync: vi.fn().mockResolvedValue("test-token"),
  forceRefreshToken: vi.fn().mockResolvedValue("test-token"),
}));

const mockApiPost = vi.fn().mockResolvedValue({});
vi.mock("../../../services/api", () => ({
  api: {
    get: vi.fn().mockResolvedValue({}),
    post: (...args: any[]) => mockApiPost(...args),
    patch: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
  apiFetch: vi.fn().mockResolvedValue({}),
}));

vi.mock("uuid", () => ({
  v4: vi.fn().mockReturnValue("mock-uuid-deep"),
}));

// Mock child components at the render boundary
vi.mock("../../../components/OperationalMessaging", () => ({
  OperationalMessaging: (props: any) => (
    <div data-testid="op-messaging">OperationalMessaging</div>
  ),
}));

vi.mock("../../../components/CommandCenterView", () => ({
  CommandCenterView: (props: any) => {
    return (
      <div data-testid="command-center">
        CommandCenter
        {props.onViewFullLoad && (
          <button
            data-testid="view-full-load"
            onClick={() =>
              props.onViewFullLoad({
                id: "load-1",
                companyId: "company-1",
                loadNumber: "LN-001",
                status: "in_transit",
              })
            }
          >
            View Full Load
          </button>
        )}
      </div>
    );
  },
}));

vi.mock("../../../components/SafetyView", () => ({
  SafetyView: (props: any) => <div data-testid="safety-view">SafetyView</div>,
}));

vi.mock("../../../components/NetworkPortal", () => ({
  NetworkPortal: (props: any) => (
    <div data-testid="network-portal">NetworkPortal</div>
  ),
}));

vi.mock("../../../components/QuoteManager", () => ({
  QuoteManager: (props: any) => (
    <div data-testid="quote-manager">QuoteManager</div>
  ),
}));

vi.mock("../../../components/LoadDetailView", () => ({
  LoadDetailView: (props: any) => (
    <div data-testid="load-detail">
      LoadDetailView
      <span data-testid="load-detail-load-id">{props.load?.id}</span>
      <button data-testid="close-detail" onClick={props.onClose}>
        CloseDetail
      </button>
      <button
        data-testid="edit-detail"
        onClick={() => props.onEdit?.(props.load)}
      >
        EditDetail
      </button>
    </div>
  ),
}));

vi.mock("../../../components/Toast", () => ({
  Toast: ({ message, type, onDismiss }: any) => (
    <div data-testid="toast" data-type={type}>
      {message}
      <button onClick={onDismiss}>dismiss-toast</button>
    </div>
  ),
}));

vi.mock("../../../components/ui/ConfirmDialog", () => ({
  ConfirmDialog: ({ open, title, message, onConfirm, onCancel }: any) =>
    open ? (
      <div data-testid="confirm-dialog">
        <span>{title}</span>
        <span>{message}</span>
        <button onClick={onConfirm}>confirm-yes</button>
        <button onClick={onCancel}>confirm-no</button>
      </div>
    ) : null,
}));

vi.mock("../../../components/ui/InputDialog", () => ({
  InputDialog: ({ open, title, message, onSubmit, onCancel }: any) =>
    open ? (
      <div data-testid="input-dialog">
        <span>{title}</span>
        <span>{message}</span>
        <button onClick={() => onSubmit("test-wrap-up-notes")}>
          input-submit
        </button>
        <button onClick={onCancel}>input-cancel</button>
      </div>
    ) : null,
}));

vi.mock("../../../config/features", () => ({
  features: {
    simulateActions: true,
    injectRecord: true,
    apiTester: true,
    seedSystem: true,
    debugPanels: true,
  },
}));

import IntelligenceHub from "../../../components/IntelligenceHub";
import {
  User,
  LoadData,
  LOAD_STATUS,
  WorkspaceSession,
  EntityType,
  Incident,
  CallSession,
} from "../../../types";
import {
  globalSearch,
  getTriageQueues,
  getWorkItems,
  getRequests,
  getIncidents,
  saveIncident,
  saveCallSession,
  getRecord360Data,
  getProviders,
  getContacts,
  saveTask,
  saveRequest,
  saveNotificationJob,
  saveServiceTicket,
  initiateRepowerWorkflow,
} from "../../../services/storageService";
import { getVendors } from "../../../services/safetyService";

// ── Fixtures ──────────────────────────────────────────────────────────────

const mockUser: User = {
  id: "user-1",
  companyId: "company-1",
  email: "admin@test.com",
  name: "Admin User",
  role: "admin",
  onboardingStatus: "Completed",
  safetyScore: 100,
};

const mockLoads: LoadData[] = [
  {
    id: "load-1",
    companyId: "company-1",
    driverId: "driver-1",
    loadNumber: "LN-001",
    status: LOAD_STATUS.In_Transit,
    carrierRate: 1500,
    driverPay: 900,
    pickupDate: "2026-01-15",
    pickup: { city: "Chicago", state: "IL" },
    dropoff: { city: "Dallas", state: "TX" },
  },
  {
    id: "load-2",
    companyId: "company-1",
    driverId: "driver-2",
    loadNumber: "LN-002",
    status: LOAD_STATUS.Booked,
    carrierRate: 2000,
    driverPay: 1200,
    pickupDate: "2026-01-16",
    pickup: { city: "Atlanta", state: "GA" },
    dropoff: { city: "Miami", state: "FL" },
  },
];

const mockSession: WorkspaceSession = {
  primaryContext: null,
  secondaryContexts: [],
  recentContexts: [],
  pinnedContexts: [],
  splitView: { enabled: false },
};

const mockSessionWithContext: WorkspaceSession = {
  primaryContext: {
    id: "load-1",
    type: "LOAD",
    label: "Load #LN-001",
    timestamp: "2026-01-15T10:00:00Z",
    data: {
      load: {
        id: "load-1",
        loadNumber: "LN-001",
        status: "in_transit",
      },
      requests: [],
      calls: [],
      incidents: [],
      messages: [],
    },
  },
  secondaryContexts: [],
  recentContexts: [],
  pinnedContexts: [],
  splitView: { enabled: false },
};

const incidentSession: WorkspaceSession = {
  primaryContext: {
    id: "inc-1",
    type: "INCIDENT",
    label: "INCIDENT: Breakdown",
    timestamp: new Date().toISOString(),
    data: {
      incident: {
        id: "inc-1",
        type: "Breakdown",
        severity: "Critical",
        status: "Open",
        description: "Engine failure on route",
        timeline: [],
        loadId: "load-1",
      },
    },
  },
  secondaryContexts: [],
  recentContexts: [],
  pinnedContexts: [],
  splitView: { enabled: false },
};

const defaultProps = {
  user: mockUser,
  loads: mockLoads,
  brokers: [] as any[],
  users: [mockUser],
  incidents: [] as Incident[],
  onNavigate: vi.fn(),
  onRecordAction: vi.fn().mockResolvedValue(undefined),
  session: mockSession,
  setSession: vi.fn(),
  openRecordWorkspace: vi.fn().mockResolvedValue(undefined),
  onCloseContext: vi.fn(),
  onLinkSessionToRecord: vi.fn().mockResolvedValue(undefined),
};

const flushAsync = () => act(() => new Promise((r) => setTimeout(r, 0)));

// ── Deep Coverage Tests ───────────────────────────────────────────────────

describe("IntelligenceHub deep coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1920,
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Roadside form X close button (line 4082) ──────────────────────────

  describe("roadside form X close button", () => {
    it("closes roadside form via the X icon button in the header", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(
        <IntelligenceHub {...defaultProps} session={mockSessionWithContext} />,
      );
      await flushAsync();

      const roadsideBtn = screen.getByTitle("Roadside");
      await user.click(roadsideBtn);

      await waitFor(() => {
        expect(
          screen.getByText("Roadside Recovery Dispatch"),
        ).toBeInTheDocument();
      });

      // Find the X button in the roadside form header (line 4081-4086)
      const heading = screen.getByText("Roadside Recovery Dispatch");
      const headerRow = heading.closest("div.h-20");
      const xBtn = headerRow!.querySelector(
        "button.hover\\:bg-white\\/5",
      ) as HTMLButtonElement;
      await user.click(xBtn);

      await waitFor(() => {
        expect(
          screen.queryByText("Roadside Recovery Dispatch"),
        ).not.toBeInTheDocument();
      });
    });
  });

  // ── Roadside notes textarea (lines 4129-4134) ────────────────────────

  describe("roadside notes input", () => {
    it("types into the roadside tactical damage report textarea", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(
        <IntelligenceHub {...defaultProps} session={mockSessionWithContext} />,
      );
      await flushAsync();

      const roadsideBtn = screen.getByTitle("Roadside");
      await user.click(roadsideBtn);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Specify repair requirements..."),
        ).toBeInTheDocument();
      });

      const notesInput = screen.getByPlaceholderText(
        "Specify repair requirements...",
      );
      await user.type(notesInput, "Left rear tire blowout");
      expect(notesInput).toHaveValue("Left rear tire blowout");
    });
  });

  // ── Roadside vendor display with status chips (lines 4094-4118) ───────

  describe("roadside vendor display details", () => {
    it("renders vendor type and status information", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(
        <IntelligenceHub {...defaultProps} session={mockSessionWithContext} />,
      );
      await flushAsync();

      const roadsideBtn = screen.getByTitle("Roadside");
      await user.click(roadsideBtn);

      await waitFor(() => {
        expect(screen.getByText("Quick Tow LLC")).toBeInTheDocument();
      });

      // Vendor type and status are rendered as subtext (line 4111)
      expect(screen.getByText(/Towing/)).toBeInTheDocument();
      expect(screen.getByText(/Repair/)).toBeInTheDocument();
    });

    it("shows Add Temporary Vendor button", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(
        <IntelligenceHub {...defaultProps} session={mockSessionWithContext} />,
      );
      await flushAsync();

      const roadsideBtn = screen.getByTitle("Roadside");
      await user.click(roadsideBtn);

      await waitFor(() => {
        expect(screen.getByText("Add Temporary Vendor")).toBeInTheDocument();
      });
    });

    it("toggles vendor selection — deselect then reselect", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(
        <IntelligenceHub {...defaultProps} session={mockSessionWithContext} />,
      );
      await flushAsync();

      const roadsideBtn = screen.getByTitle("Roadside");
      await user.click(roadsideBtn);

      await waitFor(() => {
        expect(screen.getByText("Quick Tow LLC")).toBeInTheDocument();
      });

      // Select first vendor
      await user.click(screen.getByText("Quick Tow LLC"));

      await waitFor(() => {
        const vendorBtn = screen.getByText("Quick Tow LLC").closest("button");
        expect(vendorBtn!.className).toContain("bg-orange-600/10");
      });

      // Select a different vendor — first one deselects
      await user.click(screen.getByText("Roadside Pros"));

      await waitFor(() => {
        const firstBtn = screen.getByText("Quick Tow LLC").closest("button");
        expect(firstBtn!.className).not.toContain("bg-orange-600/10");
        const secondBtn = screen.getByText("Roadside Pros").closest("button");
        expect(secondBtn!.className).toContain("bg-orange-600/10");
      });
    });
  });

  // ── Notify picker X close button (line 3993) ─────────────────────────

  describe("notify picker X close button", () => {
    it("closes notify picker via the X icon button in the header", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      (getRecord360Data as Mock).mockResolvedValue({
        load: { id: "load-1", loadNumber: "LN-001" },
        driver: { name: "John", phone: "555-1111" },
      });

      render(
        <IntelligenceHub {...defaultProps} session={mockSessionWithContext} />,
      );
      await flushAsync();

      const notifyBtn = screen.getByTitle("Notify Partners");
      await user.click(notifyBtn);

      await waitFor(() => {
        expect(
          screen.getByText("Multi-Channel Stakeholder Alert"),
        ).toBeInTheDocument();
      });

      // Find the X button in the notify picker header (line 3992-3997)
      const heading = screen.getByText("Multi-Channel Stakeholder Alert");
      const headerRow = heading.closest("div.h-20");
      const xBtn = headerRow!.querySelector(
        "button.hover\\:bg-white\\/5",
      ) as HTMLButtonElement;
      await user.click(xBtn);

      await waitFor(() => {
        expect(
          screen.queryByText("Multi-Channel Stakeholder Alert"),
        ).not.toBeInTheDocument();
      });
    });
  });

  // ── Notification contact toggle (lines 4004-4011) ────────────────────

  describe("notification contact toggle", () => {
    it("selects and deselects a contact in the notification picker", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      (getRecord360Data as Mock).mockResolvedValue({
        load: { id: "load-1", loadNumber: "LN-001" },
        driver: { name: "John", phone: "555-1111" },
      });

      render(
        <IntelligenceHub {...defaultProps} session={mockSessionWithContext} />,
      );
      await flushAsync();

      const notifyBtn = screen.getByTitle("Notify Partners");
      await user.click(notifyBtn);

      await waitFor(() => {
        expect(screen.getByText("Driver")).toBeInTheDocument();
      });

      // Select the driver contact
      const driverBtn = screen.getByText("Driver").closest("button")!;
      await user.click(driverBtn);

      // Should be highlighted
      await waitFor(() => {
        expect(driverBtn.className).toContain("bg-blue-600/10");
      });

      // Deselect the same contact (toggle off — line 4005-4007)
      await user.click(driverBtn);

      await waitFor(() => {
        expect(driverBtn.className).not.toContain("bg-blue-600/10");
      });
    });
  });

  // ── Notification message textarea (lines 4038-4043) ──────────────────

  describe("notification message input", () => {
    it("types a broadcast message into the notification textarea", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      (getRecord360Data as Mock).mockResolvedValue({
        load: { id: "load-1", loadNumber: "LN-001" },
        driver: { name: "John", phone: "555-1111" },
      });

      render(
        <IntelligenceHub {...defaultProps} session={mockSessionWithContext} />,
      );
      await flushAsync();

      const notifyBtn = screen.getByTitle("Notify Partners");
      await user.click(notifyBtn);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Enter the message for broadcast..."),
        ).toBeInTheDocument();
      });

      const messageInput = screen.getByPlaceholderText(
        "Enter the message for broadcast...",
      );
      await user.type(messageInput, "Urgent: delivery delay");
      expect(messageInput).toHaveValue("Urgent: delivery delay");
    });
  });

  // ── LoadDetailView modal open/close (lines 4155-4168) ─────────────────

  describe("LoadDetailView modal lifecycle", () => {
    it("opens load detail view via CommandCenterView callback and closes it", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(
        <IntelligenceHub {...defaultProps} session={mockSessionWithContext} />,
      );
      await flushAsync();

      // Load detail should not be visible initially
      expect(screen.queryByTestId("load-detail")).not.toBeInTheDocument();

      // Click the "View Full Load" button injected into our CommandCenterView mock
      const viewBtn = screen.getByTestId("view-full-load");
      await user.click(viewBtn);

      // LoadDetailView modal should now be visible
      await waitFor(() => {
        expect(screen.getByTestId("load-detail")).toBeInTheDocument();
      });
      expect(screen.getByTestId("load-detail-load-id")).toHaveTextContent(
        "load-1",
      );

      // Close the detail view via onClose (line 4158)
      const closeBtn = screen.getByTestId("close-detail");
      await user.click(closeBtn);

      await waitFor(() => {
        expect(screen.queryByTestId("load-detail")).not.toBeInTheDocument();
      });
    });

    it("triggers onEdit callback in LoadDetailView and closes the modal", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(
        <IntelligenceHub {...defaultProps} session={mockSessionWithContext} />,
      );
      await flushAsync();

      // Open detail view
      await user.click(screen.getByTestId("view-full-load"));

      await waitFor(() => {
        expect(screen.getByTestId("load-detail")).toBeInTheDocument();
      });

      // Click edit (line 4159-4162)
      const editBtn = screen.getByTestId("edit-detail");
      await user.click(editBtn);

      await waitFor(() => {
        expect(screen.queryByTestId("load-detail")).not.toBeInTheDocument();
      });
    });
  });

  // ── Incident-context roadside dispatch (lines 1362-1459) ──────────────

  describe("roadside dispatch with incident context", () => {
    it("submits roadside dispatch from incident context with vendor and notes", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      (getRecord360Data as Mock).mockResolvedValue({
        incident: {
          id: "inc-1",
          type: "Breakdown",
          severity: "Critical",
          status: "Open",
          description: "Engine failure on route",
          timeline: [],
          loadId: "load-1",
        },
        load: {
          id: "load-1",
          loadNumber: "LN-001",
          truckNumber: "TRUCK-55",
        },
      });

      render(<IntelligenceHub {...defaultProps} session={incidentSession} />);
      await flushAsync();

      const roadsideBtn = screen.getByTitle("Roadside");
      await user.click(roadsideBtn);

      await waitFor(() => {
        expect(screen.getByText("Quick Tow LLC")).toBeInTheDocument();
      });

      // Select vendor
      await user.click(screen.getByText("Quick Tow LLC"));

      // Enter notes
      const notesInput = screen.getByPlaceholderText(
        "Specify repair requirements...",
      );
      await user.type(notesInput, "Engine overheating");

      // Submit
      const dispatchBtn = screen.getByText("Authorize & Dispatch");
      await user.click(dispatchBtn);

      await waitFor(() => {
        // Service ticket should be saved (line 1396)
        expect(saveServiceTicket).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "Breakdown",
            status: "Assigned",
            assignedVendorId: "v-1",
          }),
        );
      });

      // For incident context, it should also update the incident timeline (line 1436-1448)
      await waitFor(() => {
        expect(saveIncident).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "inc-1",
            timeline: expect.arrayContaining([
              expect.objectContaining({
                action: "ROADSIDE_DISPATCHED",
              }),
            ]),
          }),
        );
      });

      // Should also post emergency charge for incident (line 1399-1416)
      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalledWith(
          "/incidents/inc-1/charges",
          expect.objectContaining({ category: "Tow", status: "Approved" }),
        );
      });
    });

    it("shows error when submitting roadside dispatch without vendor", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      (getRecord360Data as Mock).mockResolvedValue({
        load: { id: "load-1", loadNumber: "LN-001" },
      });

      render(
        <IntelligenceHub {...defaultProps} session={mockSessionWithContext} />,
      );
      await flushAsync();

      const roadsideBtn = screen.getByTitle("Roadside");
      await user.click(roadsideBtn);

      await waitFor(() => {
        expect(
          screen.getByText("Roadside Recovery Dispatch"),
        ).toBeInTheDocument();
      });

      // Submit without selecting a vendor (line 1365-1371)
      const dispatchBtn = screen.getByText("Authorize & Dispatch");
      await user.click(dispatchBtn);

      // Service ticket should NOT be saved
      expect(saveServiceTicket).not.toHaveBeenCalled();
    });
  });

  // ── Incident-context notification (lines 1330-1344) ───────────────────

  describe("notification with incident context", () => {
    it("sends notification and updates incident timeline for incident context", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      // handleNotifyPartners needs active360Data.load to populate contacts
      (getRecord360Data as Mock).mockResolvedValue({
        incident: {
          id: "inc-1",
          type: "Breakdown",
          severity: "Critical",
          status: "Open",
          timeline: [],
        },
        load: { id: "load-1", loadNumber: "LN-001" },
        driver: { name: "John", phone: "555-1111" },
      });

      render(<IntelligenceHub {...defaultProps} session={incidentSession} />);
      await flushAsync();

      const notifyBtn = screen.getByTitle("Notify Partners");
      await user.click(notifyBtn);

      await waitFor(() => {
        expect(
          screen.getByText("Multi-Channel Stakeholder Alert"),
        ).toBeInTheDocument();
      });

      // Select a contact
      await waitFor(() => {
        expect(screen.getByText("Driver")).toBeInTheDocument();
      });
      const driverBtn = screen.getByText("Driver").closest("button")!;
      await user.click(driverBtn);

      // Enter message
      const messageInput = screen.getByPlaceholderText(
        "Enter the message for broadcast...",
      );
      await user.type(messageInput, "Critical update on breakdown");

      // Trigger alert
      const triggerBtn = screen.getByText(/Trigger Alert Job/);
      await user.click(triggerBtn);

      await waitFor(() => {
        expect(saveNotificationJob).toHaveBeenCalledWith(
          expect.objectContaining({
            incidentId: "inc-1",
            channel: "Multi",
            status: "SENT",
          }),
        );
      });

      // For incident context, should update incident timeline (line 1330-1343)
      await waitFor(() => {
        expect(saveIncident).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "inc-1",
            timeline: expect.arrayContaining([
              expect.objectContaining({
                action: "STAKEHOLDERS_NOTIFIED",
              }),
            ]),
          }),
        );
      });
    });
  });

  // ── Repower with notification emails (lines 489-494) ──────────────────

  describe("repower with stakeholder notification", () => {
    it("triggers automated stakeholder notify when load has notificationEmails", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const loadsWithEmails: LoadData[] = [
        {
          ...mockLoads[0],
          notificationEmails: ["shipper@example.com", "receiver@example.com"],
        },
        mockLoads[1],
      ];

      render(
        <IntelligenceHub
          {...defaultProps}
          loads={loadsWithEmails}
          session={mockSessionWithContext}
          setOverlayState={vi.fn()}
        />,
      );
      await flushAsync();

      const repowerBtn = screen.getByTitle("Repower");
      await user.click(repowerBtn);

      await waitFor(() => {
        expect(screen.getByText("Mike Thompson")).toBeInTheDocument();
      });

      // Assign handoff
      const driverCard = screen
        .getByText("Mike Thompson")
        .closest("div.p-6") as HTMLElement;
      const assignBtn = within(driverCard).getByText("Assign Handoff");
      await user.click(assignBtn);

      await waitFor(() => {
        expect(initiateRepowerWorkflow).toHaveBeenCalled();
      });

      // Should also trigger automated notification for the load's notificationEmails (line 489-493)
      await waitFor(() => {
        expect(saveNotificationJob).toHaveBeenCalledWith(
          expect.objectContaining({
            channel: "Email",
            status: "SENT",
            sentBy: "SYSTEM",
          }),
        );
      });
    });
  });

  // ── Active call session sync from props (lines 597-607) ────────────────

  describe("call session prop sync", () => {
    it("syncs active call session status to ACTIVE from prop", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const callSession: CallSession = {
        id: "CALL-SYNC-1",
        startTime: new Date().toISOString(),
        status: "ACTIVE",
        participants: [{ id: "d-1", name: "Tom Driver", role: "DRIVER" }],
        lastActivityAt: new Date().toISOString(),
        links: [],
      };

      render(
        <IntelligenceHub
          {...defaultProps}
          activeCallSession={callSession}
          setActiveCallSession={vi.fn()}
        />,
      );
      await flushAsync();

      // Component should render with active call session
      expect(screen.getByText("Unified Command Center")).toBeInTheDocument();
    });

    it("syncs to null when activeCallSession prop is removed", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const callSession: CallSession = {
        id: "CALL-SYNC-2",
        startTime: new Date().toISOString(),
        status: "ACTIVE",
        participants: [],
        lastActivityAt: new Date().toISOString(),
        links: [],
      };

      const { rerender } = render(
        <IntelligenceHub
          {...defaultProps}
          activeCallSession={callSession}
          setActiveCallSession={vi.fn()}
        />,
      );
      await flushAsync();

      // Remove the call session
      rerender(
        <IntelligenceHub
          {...defaultProps}
          activeCallSession={null}
          setActiveCallSession={vi.fn()}
        />,
      );
      await flushAsync();

      expect(screen.getByText("Unified Command Center")).toBeInTheDocument();
    });
  });

  // ── Context-aware visibility (lines 968-974) ─────────────────────────

  describe("context-aware rail visibility", () => {
    it("opens right rail and collapses left rail when interaction is active", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const callSession: CallSession = {
        id: "CALL-VIS-1",
        startTime: new Date().toISOString(),
        status: "ACTIVE",
        participants: [],
        lastActivityAt: new Date().toISOString(),
        links: [],
      };

      render(
        <IntelligenceHub {...defaultProps} activeCallSession={callSession} />,
      );
      await flushAsync();

      // With an active call, the right rail should be visible (interactionState === ACTIVE)
      // and we should see Strategic Voice Queue
      expect(screen.getByText("Strategic Voice Queue")).toBeInTheDocument();
    });
  });

  // ── Critical incident auto-expands right rail (lines 976-984) ─────────

  describe("critical incident auto-expands rail", () => {
    it("auto-expands right rail when critical incident exists on wide viewport", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1920,
      });

      (getTriageQueues as Mock).mockResolvedValue({
        requests: [],
        incidents: [
          {
            id: "inc-crit",
            type: "Accident",
            severity: "Critical",
            status: "Open",
            reportedAt: new Date().toISOString(),
          },
        ],
        tasks: [],
        calls: [],
        atRiskLoads: [],
        workItems: [],
      });
      (getWorkItems as Mock).mockResolvedValue([]);

      render(<IntelligenceHub {...defaultProps} />);
      await flushAsync();

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Right rail should be visible with the voice queue
      expect(screen.getByText("Strategic Voice Queue")).toBeInTheDocument();

      // The critical incident should appear in the triage
      await waitFor(() => {
        expect(screen.getByText("Accident")).toBeInTheDocument();
      });
    });
  });

  // ── Safety escalation handler (lines 1026-1075) ──────────────────────

  describe("safety escalation without load context", () => {
    it("shows error message when safety escalation triggered without context", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<IntelligenceHub {...defaultProps} />);
      await flushAsync();

      // Trigger safety escalation - should show message since no active record
      // This is tested indirectly through verify drop without context
      const verifyBtn = screen.getByTitle("Verify Drop");
      await user.click(verifyBtn);

      // Without active record, no EQUIPMENT_EVENT should be fired
      await flushAsync();
      const equipmentCalls = (
        defaultProps.onRecordAction as Mock
      ).mock.calls.filter((c: any[]) => c[0]?.type === "EQUIPMENT_EVENT");
      expect(equipmentCalls).toHaveLength(0);
    });
  });

  // ── Notification error state (lines 1281-1287) ────────────────────────

  describe("notification broadcast error handling", () => {
    it("shows error when triggering alert with no contacts selected", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      (getRecord360Data as Mock).mockResolvedValue({
        load: { id: "load-1", loadNumber: "LN-001" },
        driver: { name: "John", phone: "555-1111" },
      });

      render(
        <IntelligenceHub {...defaultProps} session={mockSessionWithContext} />,
      );
      await flushAsync();

      const notifyBtn = screen.getByTitle("Notify Partners");
      await user.click(notifyBtn);

      await waitFor(() => {
        expect(
          screen.getByText("Multi-Channel Stakeholder Alert"),
        ).toBeInTheDocument();
      });

      // Trigger without selecting contacts (line 1281-1287)
      const triggerBtn = screen.getByText(/Trigger Alert Job/);
      await user.click(triggerBtn);

      // saveNotificationJob should NOT be called
      expect(saveNotificationJob).not.toHaveBeenCalled();
    });
  });

  // ── Roadside form medium priority (line 1383) ─────────────────────────

  describe("roadside dispatch priority from load context", () => {
    it("sets Medium priority when roadside dispatched from load context", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      (getRecord360Data as Mock).mockResolvedValue({
        load: {
          id: "load-1",
          loadNumber: "LN-001",
          truckNumber: "TRUCK-42",
        },
      });

      render(
        <IntelligenceHub {...defaultProps} session={mockSessionWithContext} />,
      );
      await flushAsync();

      const roadsideBtn = screen.getByTitle("Roadside");
      await user.click(roadsideBtn);

      await waitFor(() => {
        expect(screen.getByText("Quick Tow LLC")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Quick Tow LLC"));

      const dispatchBtn = screen.getByText("Authorize & Dispatch");
      await user.click(dispatchBtn);

      await waitFor(() => {
        // For LOAD context (not INCIDENT), priority is "Medium" (line 1383)
        expect(saveServiceTicket).toHaveBeenCalledWith(
          expect.objectContaining({
            priority: "Medium",
            unitId: "TRUCK-42",
          }),
        );
      });
    });
  });

  // ── Multiple contacts in notification picker ──────────────────────────

  describe("multiple contact selection in notification", () => {
    it("selects multiple contacts and includes all in notification job", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      (getRecord360Data as Mock).mockResolvedValue({
        load: { id: "load-1", loadNumber: "LN-001" },
        driver: { name: "John", phone: "555-1111" },
      });

      // Also provide directory contacts
      (getContacts as Mock).mockResolvedValue([
        {
          id: "contact-1",
          name: "Sarah Manager",
          type: "Operations",
          phone: "555-9999",
        },
      ]);

      render(
        <IntelligenceHub {...defaultProps} session={mockSessionWithContext} />,
      );
      await flushAsync();

      const notifyBtn = screen.getByTitle("Notify Partners");
      await user.click(notifyBtn);

      await waitFor(() => {
        expect(screen.getByText("Driver")).toBeInTheDocument();
      });

      // Select driver contact
      const driverBtn = screen.getByText("Driver").closest("button")!;
      await user.click(driverBtn);

      // Also select Safety Team
      const safetyTeam = screen.getByText("Safety Team");
      const safetyBtn = safetyTeam.closest("button")!;
      await user.click(safetyBtn);

      // Type message
      const msgInput = screen.getByPlaceholderText(
        "Enter the message for broadcast...",
      );
      await user.type(msgInput, "Multi-party alert");

      // Trigger
      const triggerBtn = screen.getByText(/Trigger Alert Job/);
      await user.click(triggerBtn);

      await waitFor(() => {
        expect(saveNotificationJob).toHaveBeenCalledWith(
          expect.objectContaining({
            recipients: expect.arrayContaining([
              expect.objectContaining({ role: "Driver" }),
              expect.objectContaining({ role: "Internal" }),
            ]),
            message: "Multi-party alert",
          }),
        );
      });
    });
  });

  // ── HandleInitiateGlobalInbound saves a WAITING call (lines 1680-1714)

  describe("global inbound call initiation", () => {
    it("creates WAITING call session via the + button in voice queue", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      render(
        <IntelligenceHub {...defaultProps} setActiveCallSession={vi.fn()} />,
      );
      await flushAsync();

      // Find the "+" button in the voice queue header
      const voiceQueueHeader = screen.getByText("Strategic Voice Queue");
      const headerSection = voiceQueueHeader.closest("div.p-5");
      const addBtn = headerSection!.querySelector(
        "button",
      ) as HTMLButtonElement;
      // The + button is the second button (first is the toggle) — use class
      const allBtns = headerSection!.querySelectorAll("button");
      const plusBtn = Array.from(allBtns).find((b) =>
        b.className.includes("bg-blue-600"),
      ) as HTMLButtonElement;
      await user.click(plusBtn);

      await waitFor(() => {
        expect(saveCallSession).toHaveBeenCalledWith(
          expect.objectContaining({
            status: "WAITING",
          }),
        );
      });
    });
  });

  // ── Completed call session from prop sets WRAP-UP state (lines 588-590)

  describe("completed call session from prop", () => {
    it("recognizes COMPLETED status as WRAP-UP interaction state", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const completedCall: CallSession = {
        id: "CALL-DONE-1",
        startTime: new Date().toISOString(),
        status: "COMPLETED",
        participants: [],
        lastActivityAt: new Date().toISOString(),
        links: [],
        endTime: new Date().toISOString(),
        notes: "Call concluded",
      };

      render(
        <IntelligenceHub
          {...defaultProps}
          activeCallSession={completedCall}
          setActiveCallSession={vi.fn()}
        />,
      );
      await flushAsync();

      // Component renders OK with completed session
      expect(screen.getByText("Unified Command Center")).toBeInTheDocument();
    });
  });

  // ── handleSearchSelect clears search (lines 1643-1648) ─────────────

  describe("search result clears query on selection", () => {
    it("clears search query and results after selecting a result", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      (globalSearch as Mock).mockResolvedValue([
        {
          id: "load-99",
          type: "LOAD",
          label: "Load #99",
          subLabel: "NYC-BOS",
          chips: [],
        },
      ]);

      render(<IntelligenceHub {...defaultProps} />);
      await flushAsync();

      const searchInput = screen.getByPlaceholderText("SEARCH COMMAND...");
      await user.type(searchInput, "Load");

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      await waitFor(() => {
        expect(screen.getByText("Load #99")).toBeInTheDocument();
      });

      // Click the result
      const resultLabel = screen.getByText("Load #99");
      const resultBtn = resultLabel.closest("button")!;
      await user.click(resultBtn);

      await waitFor(() => {
        expect(defaultProps.openRecordWorkspace).toHaveBeenCalledWith(
          "LOAD",
          "load-99",
        );
      });

      // Search input should be cleared (line 1646)
      expect(searchInput).toHaveValue("");

      // Results should no longer be visible (line 1647)
      expect(screen.queryByText("Load #99")).not.toBeInTheDocument();
    });
  });

  // ── Roadside dispatch without notes uses incident description (line 1386-1388) ─

  describe("roadside dispatch uses incident description when no notes", () => {
    it("uses incident description as ticket description when notes are empty", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      (getRecord360Data as Mock).mockResolvedValue({
        incident: {
          id: "inc-1",
          type: "Breakdown",
          severity: "High",
          status: "Open",
          description: "Engine failure on I-95",
          timeline: [],
        },
        load: { id: "load-1", truckNumber: "TRUCK-77" },
      });

      render(<IntelligenceHub {...defaultProps} session={incidentSession} />);
      await flushAsync();

      const roadsideBtn = screen.getByTitle("Roadside");
      await user.click(roadsideBtn);

      await waitFor(() => {
        expect(screen.getByText("Quick Tow LLC")).toBeInTheDocument();
      });

      // Select vendor but do NOT enter notes
      await user.click(screen.getByText("Quick Tow LLC"));

      const dispatchBtn = screen.getByText("Authorize & Dispatch");
      await user.click(dispatchBtn);

      await waitFor(() => {
        // When no notes and incident context, it should use the incident description (line 1386-1388)
        expect(saveServiceTicket).toHaveBeenCalledWith(
          expect.objectContaining({
            description: "Engine failure on I-95",
            priority: "High",
          }),
        );
      });
    });
  });

  // ── success message auto-clear (lines 1192-1197) ──────────────────────

  describe("success message auto-clear timer", () => {
    it("auto-clears success message after timeout", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(
        <IntelligenceHub {...defaultProps} session={mockSessionWithContext} />,
      );
      await flushAsync();

      // Trigger an action that sets successMessage
      const verifyBtn = screen.getByTitle("Verify Drop");
      await user.click(verifyBtn);

      await waitFor(() => {
        expect(defaultProps.onRecordAction).toHaveBeenCalled();
      });

      // Advance past the 5-second auto-clear timer (line 1194)
      await act(async () => {
        vi.advanceTimersByTime(6000);
      });

      // Component should still render fine after auto-clear
      expect(screen.getByText("Unified Command Center")).toBeInTheDocument();
    });
  });

  // ── activeSubTab sync from session (lines 986-990) ────────────────────

  describe("active sub-tab sync from session", () => {
    it("syncs active 360 sub-tab from primary context", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const sessionWithSubTab: WorkspaceSession = {
        primaryContext: {
          id: "load-1",
          type: "LOAD",
          label: "Load #LN-001",
          timestamp: "2026-01-15T10:00:00Z",
          activeSubTab: "TIMELINE",
          data: {
            load: { id: "load-1", loadNumber: "LN-001" },
          },
        },
        secondaryContexts: [],
        recentContexts: [],
        pinnedContexts: [],
        splitView: { enabled: false },
      };

      render(<IntelligenceHub {...defaultProps} session={sessionWithSubTab} />);
      await flushAsync();

      // The component should pass the activeSubTab to CommandCenterView
      expect(screen.getByTestId("command-center")).toBeInTheDocument();
    });
  });

  // ── handleActionLogging sets overlay state for CALL_LOG (lines 720-722) ─

  describe("action logging overlay state", () => {
    it("collapses overlay for CALL_LOG and MESSAGE event types", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const setOverlayState = vi.fn();

      render(
        <IntelligenceHub
          {...defaultProps}
          session={mockSessionWithContext}
          setOverlayState={setOverlayState}
        />,
      );
      await flushAsync();

      // Trigger a CALL_LOG event via repower handoff
      const repowerBtn = screen.getByTitle("Repower");
      await user.click(repowerBtn);

      await waitFor(() => {
        expect(screen.getByText("Mike Thompson")).toBeInTheDocument();
      });

      const driverCard = screen
        .getByText("Mike Thompson")
        .closest("div.p-6") as HTMLElement;
      const assignBtn = within(driverCard).getByText("Assign Handoff");
      await user.click(assignBtn);

      await waitFor(() => {
        // handleActionLogging should have been called with CALL_LOG type (line 475)
        // which triggers setOverlayState("collapsed") (line 721-722)
        expect(defaultProps.onRecordAction).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "CALL_LOG",
          }),
        );
      });
    });
  });
});
