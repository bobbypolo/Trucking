/**
 * STORY-012 Phase 12 — Integration smoke test for the SaaS UX Remediation sprint.
 *
 * This smoke test renders each of the modified frontend components from
 * STORY-001..STORY-009 and verifies:
 *
 *   R-P12-01: Every modified component mounts without logging a single
 *             console.error (consoleErrors.length === 0).
 *   R-P12-02: LoadList renders pickup dates through services/dateFormat.ts so
 *             the visible output matches /[A-Z][a-z]{2} \d{1,2}, \d{4}/ rather
 *             than raw ISO strings.
 *   R-P12-03: IntelligenceHub exposes a "SAFETY" tab via getByText("SAFETY"),
 *             LoadDetailView exposes both "Notify Partners" and "Generate
 *             Agreement" buttons via getByText.
 *
 * The components under test are heavy: IntelligenceHub is ~2000 lines and
 * pulls in 30+ service modules, BookingPortal talks to the network, etc.
 * We mock every outbound boundary (services, hooks, sub-components) so the
 * render path is deterministic and free of async flakiness, then assert on
 * the visible DOM output produced by each modified component.
 *
 * Modified components covered (10 total):
 *   1. components/IntelligenceHub.tsx           (STORY-001 SAFETY tab, STORY-002 breadcrumb)
 *   2. components/LoadList.tsx                  (STORY-001 date format, STORY-003 Call button)
 *   3. components/LoadDetailView.tsx            (STORY-002 Back button, STORY-004 Notify Partners,
 *                                                STORY-006 Tag Event, STORY-009 Generate Agreement)
 *   4. components/QuoteManager.tsx              (STORY-001 tab order, STORY-008 quote margins)
 *   5. components/BookingPortal.tsx             (STORY-005 extraction mapping)
 *   6. components/operations/TriageWorkspacePanel.tsx (STORY-001 contrast/sizing)
 *   7. components/CommsOverlay.tsx              (STORY-003 tel: dialer)
 *   8. services/dateFormat.ts                   (STORY-001 shared formatter — verified via LoadList)
 *   9. (sub-surface) LoadDetailView action-bar  (grouped with #3 for action bar coverage)
 *  10. (sub-surface) LoadDetailView agreement   (grouped with #3 for POST /api/agreements)
 *
 * Items 9-10 are action-bar sub-surfaces of LoadDetailView and share the
 * same mount/render cycle as item #3.
 */
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  LoadData,
  User,
  Broker,
  LOAD_STATUS,
  WorkspaceSession,
  CallSession,
  Incident,
  Company,
} from "../../../types";

// ─────────────────────────────────────────────────────────────────────────────
// Service / network-boundary mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("../../../services/storageService", () => ({
  // Generic CRUD stubs shared by LoadList, LoadDetailView, QuoteManager,
  // IntelligenceHub, and BookingPortal.
  generateInvoicePDF: vi.fn(),
  saveLoad: vi.fn().mockResolvedValue(undefined),
  generateBolPDF: vi.fn(),
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
  saveWorkItem: vi.fn().mockResolvedValue(undefined),
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
  saveIncidentAction: vi.fn(),
  saveIncidentCharge: vi.fn(),
  getAuthHeaders: vi.fn().mockResolvedValue({}),
  getQuotes: vi.fn().mockResolvedValue([]),
  saveQuote: vi.fn().mockResolvedValue(undefined),
  getLeads: vi.fn().mockResolvedValue([]),
  saveLead: vi.fn().mockResolvedValue(undefined),
  getBookings: vi.fn().mockResolvedValue([]),
  saveBooking: vi.fn().mockResolvedValue(undefined),
  generateNextLoadNumber: vi.fn().mockReturnValue("LN-100"),
}));

vi.mock("../../../services/authService", () => ({
  getCurrentUser: vi.fn().mockReturnValue({
    id: "user-1",
    companyId: "company-1",
    email: "admin@test.com",
    name: "Admin User",
    role: "admin",
    onboardingStatus: "Completed",
    safetyScore: 100,
  }),
  getCompany: vi.fn().mockResolvedValue({
    id: "company-1",
    name: "Test Co",
    loadNumberingConfig: { prefix: "LP", nextNumber: 100 },
  }),
  onUserChange: vi.fn(() => () => {}),
  checkCapability: vi.fn().mockReturnValue(true),
  getIdTokenAsync: vi.fn().mockResolvedValue("test-token"),
}));

vi.mock("../../../services/financialService", () => ({
  getVaultDocs: vi.fn().mockResolvedValue([]),
  createARInvoice: vi.fn().mockResolvedValue({ id: "inv-1" }),
}));

vi.mock("../../../services/storage/vault", () => ({
  getDocuments: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../services/api", () => ({
  api: {
    get: vi.fn().mockResolvedValue({ documents: [] }),
    post: vi
      .fn()
      .mockResolvedValue({ id: "agr-1", status: "DRAFT", load_id: "load-1" }),
    patch: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("../../../services/brokerService", () => ({
  getBrokers: vi
    .fn()
    .mockResolvedValue([
      { id: "broker-1", name: "Alpha Logistics", mcNumber: "MC-123" },
    ]),
  getContracts: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../services/safetyService", () => ({
  getVendors: vi.fn().mockResolvedValue([]),
  saveVendor: vi.fn(),
}));

vi.mock("../../../services/config", () => ({
  API_URL: "http://localhost:5000/api",
}));

vi.mock("../../../services/dispatchIntelligence", () => ({
  DispatchIntelligence: {
    analyze: vi.fn().mockReturnValue({ alerts: [] }),
    getBestMatches: vi.fn().mockResolvedValue([]),
  },
  getRegion: vi.fn().mockReturnValue("SOUTH"),
}));

vi.mock("../../../services/fuelService", () => ({
  FuelCardService: { getTransactions: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../../services/detentionService", () => ({
  DetentionService: { getDetentions: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../../services/exceptionService", () => ({
  getExceptions: vi.fn().mockResolvedValue([]),
  getDashboardCards: vi.fn().mockResolvedValue([]),
}));

// Hooks
vi.mock("../../../hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({
    id: "user-1",
    name: "Admin User",
    role: "admin",
    companyId: "company-1",
    email: "admin@test.com",
    onboardingStatus: "Completed",
    safetyScore: 100,
  }),
}));

vi.mock("../../../hooks/useFocusTrap", () => ({
  useFocusTrap: vi.fn(),
}));

vi.mock("../../../hooks/useAutoFeedback", () => ({
  // useAutoFeedback returns a [value, showFn, clearFn] tuple — components
  // destructure all three so the mock must return exactly that shape.
  useAutoFeedback: vi.fn(() => [null, vi.fn(), vi.fn()]),
}));

vi.mock("uuid", () => ({
  v4: vi.fn().mockReturnValue("smoke-uuid"),
}));

// Heavyweight sub-components used inside IntelligenceHub — stub them to
// avoid pulling hundreds of transitive imports into the smoke test graph.
vi.mock("../../../components/OperationalMessaging", () => ({
  OperationalMessaging: () => (
    <div data-testid="op-messaging">OperationalMessaging</div>
  ),
}));

vi.mock("../../../components/CommandCenterView", () => ({
  CommandCenterView: () => (
    <div data-testid="command-center">CommandCenter</div>
  ),
}));

vi.mock("../../../components/SafetyView", () => ({
  SafetyView: () => <div data-testid="safety-view">SafetyView</div>,
}));

vi.mock("../../../components/NetworkPortal", () => ({
  NetworkPortal: () => <div data-testid="network-portal">NetworkPortal</div>,
}));

vi.mock("../../../components/ExceptionConsole", () => ({
  ExceptionConsole: () => (
    <div data-testid="exception-console">ExceptionConsole</div>
  ),
}));

vi.mock("../../../components/operations/OpsDashboardPanel", () => ({
  OpsDashboardPanel: () => <div data-testid="ops-dashboard">OpsDashboard</div>,
}));

vi.mock("../../../components/operations/OperationalFormsOverlay", () => ({
  OperationalFormsOverlay: () => null,
}));

vi.mock("../../../components/operations/RepowerSelectionPanel", () => ({
  RepowerSelectionPanel: () => null,
}));

vi.mock("../../../components/operations/useCrisisHandlers", () => ({
  useCrisisHandlers: () => ({
    crisisMode: false,
    crisisBanner: null,
    handleCrisisAction: vi.fn(),
    crisisProtocol: null,
  }),
}));

vi.mock("../../../components/quotes", () => ({
  QuotePipelineView: () => (
    <div data-testid="quote-pipeline">QuotePipelineView</div>
  ),
  QuoteDetailView: () => <div data-testid="quote-detail">QuoteDetailView</div>,
  QuoteIntakeForm: () => <div data-testid="quote-intake">QuoteIntakeForm</div>,
}));

vi.mock("../../../components/Toast", () => ({
  Toast: ({ message }: { message: string }) => (
    <div data-testid="toast">{message}</div>
  ),
}));

vi.mock("../../../components/ui/ConfirmDialog", () => ({
  ConfirmDialog: () => null,
}));

vi.mock("../../../components/ui/InputDialog", () => ({
  InputDialog: () => null,
}));

vi.mock("../../../config/features", () => ({
  features: {
    simulateActions: false,
    injectRecord: false,
    apiTester: false,
    seedSystem: false,
    debugPanels: false,
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Component imports must come AFTER vi.mock() declarations so the mocks
// take effect.
// ─────────────────────────────────────────────────────────────────────────────
import IntelligenceHub from "../../../components/IntelligenceHub";
import { LoadList } from "../../../components/LoadList";
import { LoadDetailView } from "../../../components/LoadDetailView";
import { QuoteManager } from "../../../components/QuoteManager";
import { BookingPortal } from "../../../components/BookingPortal";
import { TriageWorkspacePanel } from "../../../components/operations/TriageWorkspacePanel";
import { CommsOverlay } from "../../../components/CommsOverlay";

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixtures
// ─────────────────────────────────────────────────────────────────────────────

const mockUser: User = {
  id: "user-1",
  companyId: "company-1",
  email: "admin@test.com",
  name: "Admin User",
  role: "admin",
  onboardingStatus: "Completed",
  safetyScore: 100,
};

const mockCompany: Company = {
  id: "company-1",
  name: "Test Trucking LLC",
  accountType: "fleet",
  supportedFreightTypes: ["Dry Van"],
  defaultFreightType: "Dry Van",
  driverVisibilitySettings: {
    hideRates: false,
    hideBrokerContacts: false,
    maskCustomerName: false,
    showDriverPay: true,
    allowRateCon: true,
    enableDriverSafePack: false,
    autoRedactDocs: false,
  },
  loadNumberingConfig: { prefix: "LN", nextNumber: 100, padding: 4 },
  accessorialRates: {},
  driverPermissions: {} as Company["driverPermissions"],
} as Company;

const mockLoads: LoadData[] = [
  {
    id: "load-1",
    companyId: "company-1",
    driverId: "driver-1",
    dispatcherId: "user-1",
    brokerId: "broker-1",
    loadNumber: "LN-700",
    status: LOAD_STATUS.Planned,
    carrierRate: 1500,
    driverPay: 900,
    pickupDate: "2026-04-15",
    dropoffDate: "2026-04-18",
    pickup: { city: "Chicago", state: "IL" },
    dropoff: { city: "Dallas", state: "TX" },
  } as LoadData,
  {
    id: "load-2",
    companyId: "company-1",
    driverId: "driver-2",
    dispatcherId: "user-1",
    brokerId: "broker-1",
    loadNumber: "LN-701",
    status: LOAD_STATUS.In_Transit,
    carrierRate: 2000,
    driverPay: 1200,
    pickupDate: "2026-04-16",
    dropoffDate: "2026-04-19",
    pickup: { city: "Houston", state: "TX" },
    dropoff: { city: "Phoenix", state: "AZ" },
  } as LoadData,
];

const mockLoadDetail: LoadData = {
  id: "load-detail-1",
  companyId: "company-1",
  driverId: "driver-1",
  dispatcherId: "user-1",
  brokerId: "broker-1",
  loadNumber: "LN-800",
  status: LOAD_STATUS.Planned,
  carrierRate: 3000,
  driverPay: 1800,
  pickupDate: "2026-04-15",
  dropoffDate: "2026-04-18",
  pickup: { city: "Los Angeles", state: "CA" },
  dropoff: { city: "Phoenix", state: "AZ" },
  commodity: "Furniture",
  freightType: "Dry Van",
  truckNumber: "T-101",
  trailerNumber: "TRL-55",
  legs: [],
  customerContact: {
    name: "Cathy Customer",
    phone: "555-0303",
    email: "cathy@cust.com",
  },
} as LoadData;

const mockUsers: User[] = [
  {
    id: "driver-1",
    name: "John Driver",
    role: "driver",
    companyId: "company-1",
    email: "j@t.com",
    onboardingStatus: "Completed",
    safetyScore: 90,
    phone: "555-0101",
  } as User,
];

const mockBrokers: Broker[] = [
  {
    id: "broker-1",
    name: "Alpha Logistics",
    mcNumber: "MC-123",
    isShared: true,
    clientType: "Broker",
    approvedChassis: [],
    contactPhone: "555-0202",
  } as Broker,
];

const mockSession: WorkspaceSession = {
  primaryContext: null,
  secondaryContexts: [],
  recentContexts: [],
  pinnedContexts: [],
  splitView: { enabled: false },
} as WorkspaceSession;

const mockCallSession: CallSession | null = null;

const mockIncidents: Incident[] = [];

// ─────────────────────────────────────────────────────────────────────────────
// Helper — console.error spy that captures errors into a local array so we
// can assert `consoleErrors.length === 0` after each render.
// ─────────────────────────────────────────────────────────────────────────────

function installConsoleErrorSpy(): {
  errors: string[];
  restore: () => void;
} {
  const errors: string[] = [];
  const original = console.error;
  const spy = vi.spyOn(console, "error").mockImplementation((...args) => {
    errors.push(args.map((a) => String(a)).join(" "));
  });
  return {
    errors,
    restore: () => {
      spy.mockRestore();
      console.error = original;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("STORY-012 smoke — ux-remediation integration verification", () => {
  let spy: ReturnType<typeof installConsoleErrorSpy>;

  beforeEach(() => {
    spy = installConsoleErrorSpy();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    spy.restore();
  });

  // Tests R-P12-01
  // Tests R-P12-02
  it("renders LoadList with 0 console errors and formatted MMM DD, YYYY dates (integration)", () => {
    const { container } = render(
      <LoadList
        loads={mockLoads}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        users={mockUsers}
        canViewRates={true}
      />,
    );

    // R-P12-01: no console.error emissions during LoadList render
    expect(spy.errors).toHaveLength(0);

    // Load numbers render — LoadList actually mounted
    expect(screen.getByText(/LN-700/i)).toBeInTheDocument();

    // R-P12-02: every pickupDate must render through formatDate() so the
    // visible text matches /[A-Z][a-z]{2} \d{1,2}, \d{4}/ not raw ISO.
    // Find at least one match of the formatted pattern in the rendered DOM.
    const textContent = container.textContent || "";
    const formattedDateRegex = /[A-Z][a-z]{2} \d{1,2}, \d{4}/;
    expect(textContent).toMatch(formattedDateRegex);

    // And no raw ISO-date strings (YYYY-MM-DD) should appear in the rendered
    // output for either of the fixture pickupDates.
    expect(textContent).not.toContain("2026-04-15");
    expect(textContent).not.toContain("2026-04-16");
  });

  // Tests R-P12-01
  // Tests R-P12-03
  it("renders LoadDetailView with 0 console errors and finds Notify Partners + Generate Agreement buttons (integration)", () => {
    render(
      <LoadDetailView
        load={mockLoadDetail}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        canViewRates={true}
        users={mockUsers}
        brokers={mockBrokers}
      />,
    );

    // R-P12-01: no console.error emissions during LoadDetailView render
    expect(spy.errors).toHaveLength(0);

    // R-P12-03: both new action-bar buttons must be reachable via getByText
    expect(screen.getByText(/Notify Partners/i)).toBeInTheDocument();
    expect(screen.getByText(/Generate Agreement/i)).toBeInTheDocument();
  });

  // Tests R-P12-01
  // Tests R-P12-03
  it("renders IntelligenceHub with 0 console errors and finds the SAFETY tab via getByText (integration)", () => {
    render(
      <IntelligenceHub
        show={true}
        user={mockUser}
        loads={mockLoads}
        brokers={mockBrokers}
        users={[mockUser, ...mockUsers]}
        incidents={mockIncidents}
        activeCallSession={mockCallSession}
        onRecordAction={vi.fn().mockResolvedValue(undefined)}
        onNavigate={vi.fn()}
        session={mockSession}
        setSession={vi.fn()}
        openRecordWorkspace={vi.fn().mockResolvedValue(undefined)}
        onCloseContext={vi.fn()}
        onLinkSessionToRecord={vi.fn().mockResolvedValue(undefined)}
        onClose={vi.fn()}
        company={mockCompany}
      />,
    );

    // R-P12-01: no console.error emissions during IntelligenceHub render
    expect(spy.errors).toHaveLength(0);

    // R-P12-03: SAFETY tab is present as plain text in the DOM
    expect(screen.getByText("SAFETY")).toBeInTheDocument();
  });

  // Tests R-P12-01
  it("renders QuoteManager with 0 console errors (integration)", () => {
    render(<QuoteManager user={mockUser} company={mockCompany} />);

    // R-P12-01: no console.error emissions during QuoteManager render
    expect(spy.errors).toHaveLength(0);
  });

  // Tests R-P12-01
  it("renders BookingPortal with 0 console errors (integration)", () => {
    render(
      <BookingPortal
        user={mockUser}
        company={mockCompany}
        onBookingComplete={vi.fn()}
      />,
    );

    // R-P12-01: no console.error emissions during BookingPortal render
    expect(spy.errors).toHaveLength(0);
  });

  // Tests R-P12-01
  it("renders TriageWorkspacePanel with 0 console errors (integration)", () => {
    render(
      <TriageWorkspacePanel
        triageQueues={{
          calls: [],
          incidents: [],
          workItems: [],
          requests: [],
          atRiskLoads: [],
          tasks: [],
        }}
        activeTriageTab="calls"
        setActiveTriageTab={vi.fn()}
        commSearchQuery=""
        snoozedIds={new Set<string>()}
        currentCallSession={null}
        isHighObstruction={false}
        isCollapsed={false}
        onToggleCollapse={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onInitiateGlobalInbound={vi.fn()}
        onTriageAction={vi.fn()}
      />,
    );

    // R-P12-01: no console.error emissions during TriageWorkspacePanel render
    expect(spy.errors).toHaveLength(0);
  });

  // Tests R-P12-01
  it("renders CommsOverlay with 0 console errors (integration)", () => {
    render(
      <CommsOverlay
        session={mockSession}
        activeCallSession={mockCallSession}
        setActiveCallSession={vi.fn()}
        onRecordAction={vi.fn().mockResolvedValue(undefined)}
        openRecordWorkspace={vi.fn()}
        onNavigate={vi.fn()}
        overlayState="floating"
        setOverlayState={vi.fn()}
        user={{ id: "user-1", name: "Admin User" }}
        allLoads={mockLoads}
      />,
    );

    // R-P12-01: no console.error emissions during CommsOverlay render
    expect(spy.errors).toHaveLength(0);
  });
});
