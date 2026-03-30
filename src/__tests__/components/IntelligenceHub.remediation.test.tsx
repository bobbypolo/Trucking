/**
 * IntelligenceHub Remediation Tests (C-3)
 *
 * Verifies:
 * - R-P4-07: All 8 mock values removed
 * - R-P4-08: Reports tab added with metrics or empty state
 * - R-P4-09: mockCallers array removed, call queue from real data or empty
 */
import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ── Service mocks ──
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
  v4: vi.fn().mockReturnValue("mock-uuid-remediation"),
}));

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

vi.mock("../../../components/QuoteManager", () => ({
  QuoteManager: () => <div data-testid="quote-manager">QuoteManager</div>,
}));

vi.mock("../../../components/LoadDetailView", () => ({
  LoadDetailView: (props: any) => (
    <div data-testid="load-detail">LoadDetailView</div>
  ),
}));

vi.mock("../../../components/Toast", () => ({
  Toast: ({ message, type, onDismiss }: any) => (
    <div data-testid="toast" data-type={type}>
      {message}
    </div>
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

const defaultProps = {
  show: true,
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
  onClose: vi.fn(),
};

const renderHub = (props = {}) =>
  render(<IntelligenceHub {...defaultProps} {...props} />);

// ── R-P4-07: Source-level grep — 8 mock values must not exist ──
describe("R-P4-07: Mock values removed from source", () => {
  let sourceCode: string;

  beforeEach(() => {
    const filePath = path.resolve(
      __dirname,
      "../../../components/IntelligenceHub.tsx",
    );
    sourceCode = fs.readFileSync(filePath, "utf-8");
  });

  it("does not contain CS-9901 mock call session ID", () => {
    expect(sourceCode).not.toContain('"CS-9901"');
  });

  it("does not contain 888-555-0000 mock phone number", () => {
    expect(sourceCode).not.toContain('"888-555-0000"');
  });

  it("does not contain 800-SAFE-KCI mock phone number", () => {
    expect(sourceCode).not.toContain('"800-SAFE-KCI"');
  });

  it("does not contain 45-60 mins hardcoded ETA", () => {
    expect(sourceCode).not.toContain('"45-60 mins"');
  });

  it('does not contain "John Doe" mock stats name', () => {
    expect(sourceCode).not.toContain('"John Doe"');
  });

  it('does not contain "Trucker Tom" mock caller name', () => {
    expect(sourceCode).not.toContain('"Trucker Tom"');
  });

  it("does not contain mockCallers array declaration", () => {
    expect(sourceCode).not.toMatch(/const\s+mockCallers\s*=/);
  });

  it("does not contain mock call session CS-9902 or Mark Stevens", () => {
    // The entire initial commQueue with mock data should be gone
    expect(sourceCode).not.toContain('"CS-9902"');
    expect(sourceCode).not.toContain('"Mark Stevens"');
  });
});

// ── R-P4-08: Reports tab with metrics or empty state ──
describe("R-P4-08: Reports tab/section exists", () => {
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

  it("renders REPORTS tab chip in the tab bar", async () => {
    await act(async () => {
      renderHub();
    });
    await waitFor(() => {
      expect(screen.getByText("REPORTS")).toBeInTheDocument();
    });
  });

  it("shows metrics when data is present or empty state when not", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await act(async () => {
      renderHub();
    });
    const reportsTab = await screen.findByText("REPORTS");
    await user.click(reportsTab);
    // Allow state update to propagate
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    // With loads present, Reports should show Communication Reports heading and metrics
    expect(screen.getByText("Communication Reports")).toBeInTheDocument();
    // Should show call metrics section
    expect(screen.getByText("Call Metrics")).toBeInTheDocument();
    // Should show interaction summary
    expect(screen.getByText("Interaction Summary")).toBeInTheDocument();
  });

  it("shows No data empty state when no loads or threads", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const emptyLoads: LoadData[] = [
      {
        id: "load-booked",
        companyId: "company-1",
        driverId: "driver-1",
        loadNumber: "LN-BOOKED",
        status: LOAD_STATUS.Booked,
        carrierRate: 1500,
        driverPay: 900,
        pickupDate: "2026-01-15",
        pickup: { city: "Chicago", state: "IL" },
        dropoff: { city: "Dallas", state: "TX" },
      },
    ];
    await act(async () => {
      renderHub({ loads: emptyLoads });
    });
    const reportsTab = await screen.findByText("REPORTS");
    await user.click(reportsTab);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(screen.getByText(/no data/i)).toBeInTheDocument();
  });
});

// ── R-P4-09: mockCallers removed, commQueue initialized empty ──
describe("R-P4-09: mockCallers removed, call queue from real data or empty", () => {
  let sourceCode: string;

  beforeEach(() => {
    const filePath = path.resolve(
      __dirname,
      "../../../components/IntelligenceHub.tsx",
    );
    sourceCode = fs.readFileSync(filePath, "utf-8");
  });

  it("does not contain mockCallers variable declaration", () => {
    expect(sourceCode).not.toMatch(/const\s+mockCallers\s*=/);
  });

  it('does not contain "Mike Thompson" mock caller', () => {
    expect(sourceCode).not.toContain('"Mike Thompson"');
  });

  it('does not contain "Blue Star Towing" mock caller', () => {
    expect(sourceCode).not.toContain('"Blue Star Towing"');
  });

  it('does not contain "Choptank Logistics" in mock caller array context', () => {
    // Choptank should not appear as a hardcoded mock caller
    // It may still appear in dynamic data from API
    expect(sourceCode).not.toMatch(
      /mockCallers.*Choptank|Choptank.*mockCallers/s,
    );
  });

  it("commQueue is initialized as empty array", () => {
    // The useState should be useState<CallSession[]>([]) not with mock data
    const commQueueMatch = sourceCode.match(
      /useState<CallSession\[\]>\(\s*\[\s*\]\s*\)/,
    );
    expect(commQueueMatch).not.toBeNull();
  });
});
