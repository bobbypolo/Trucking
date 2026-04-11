import React from "react";
import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
  saveIncidentAction: vi.fn(),
  saveIncidentCharge: vi.fn(),
  getAuthHeaders: vi.fn().mockResolvedValue({}),
  saveLoad: vi.fn().mockResolvedValue(undefined),
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

vi.mock("../../../services/authService", () => ({
  checkCapability: vi.fn().mockReturnValue(true),
}));

vi.mock("uuid", () => ({
  v4: vi.fn().mockReturnValue("mock-uuid-breadcrumb"),
}));

// Mock child components at the render boundary
vi.mock("../../../components/OperationalMessaging", () => ({
  OperationalMessaging: () => <div data-testid="op-messaging" />,
}));

vi.mock("../../../components/CommandCenterView", () => ({
  CommandCenterView: () => <div data-testid="command-center" />,
}));

vi.mock("../../../components/SafetyView", () => ({
  SafetyView: () => <div data-testid="safety-view" />,
}));

vi.mock("../../../components/NetworkPortal", () => ({
  NetworkPortal: () => <div data-testid="network-portal" />,
}));

vi.mock("../../../components/QuoteManager", () => ({
  QuoteManager: () => <div data-testid="quote-manager" />,
}));

vi.mock("../../../components/LoadDetailView", () => ({
  LoadDetailView: () => <div data-testid="load-detail" />,
}));

vi.mock("../../../components/OpsDashboardPanel", () => ({
  OpsDashboardPanel: () => <div data-testid="ops-dashboard" />,
}));

vi.mock("../../../components/Toast", () => ({
  Toast: () => <div data-testid="toast" />,
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

import IntelligenceHub from "../../../components/IntelligenceHub";
import {
  User,
  LoadData,
  LOAD_STATUS,
  WorkspaceSession,
  Incident,
} from "../../../types";

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
];

const mockSession: WorkspaceSession = {
  primaryContext: null,
  secondaryContexts: [],
  recentContexts: [],
  pinnedContexts: [],
  splitView: { enabled: false },
};

const baseProps = () => ({
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
});

const flushAsync = () => act(() => new Promise((r) => setTimeout(r, 0)));

describe("IntelligenceHub breadcrumb (STORY-002 Phase 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    vi.clearAllMocks();
  });

  // Tests R-P2-03
  it("renders a breadcrumb bar showing the current tab label (COMMAND) when selectedTab is not 'ops'", async () => {
    // Default initialTab is undefined → selectedTab defaults to "command" (not "ops")
    render(<IntelligenceHub {...baseProps()} />);
    await flushAsync();

    const breadcrumb = screen.getByTestId("breadcrumb");
    expect(breadcrumb).toBeInTheDocument();
    expect(breadcrumb).toHaveTextContent("COMMAND");
  });

  // Tests R-P2-03 (negative case) — breadcrumb should NOT render on ops root
  it("does not render the breadcrumb when selectedTab is 'ops' (root)", async () => {
    render(<IntelligenceHub {...baseProps()} initialTab="ops" />);
    await flushAsync();

    expect(screen.queryByTestId("breadcrumb")).toBeNull();
  });
});
