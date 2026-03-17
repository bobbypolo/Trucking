import React from "react";
import { render, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// IntelligenceHub has many service dependencies; mock them all
vi.mock("../../../services/storageService", () => ({
  globalSearch: vi.fn().mockResolvedValue([]),
  getRecord360Data: vi.fn().mockResolvedValue(null),
  getIncidents: vi.fn().mockResolvedValue([]),
  getLoadSummary: vi.fn().mockResolvedValue(null),
  getDriverSummary: vi.fn().mockResolvedValue(null),
  getBrokerSummary: vi.fn().mockResolvedValue(null),
  getMessages: vi.fn().mockResolvedValue([]),
  getRequests: vi.fn().mockResolvedValue([]),
  getTriageQueues: vi.fn().mockResolvedValue({ queues: [], incidents: [], requests: [], workItems: [] }),
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
  getAuthHeaders: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../../services/safetyService", () => ({
  getVendors: vi.fn().mockResolvedValue([]),
  saveVendor: vi.fn(),
}));

vi.mock("../../../services/config", () => ({
  API_URL: "http://localhost:5000/api",
}));

vi.mock("../../../services/dispatchIntelligence", () => ({
  DispatchIntelligence: { analyze: vi.fn().mockReturnValue({ alerts: [] }) },
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
}));

vi.mock("uuid", () => ({
  v4: vi.fn().mockReturnValue("mock-uuid-hub"),
}));

// Mock sub-components
vi.mock("../../../components/OperationalMessaging", () => ({
  OperationalMessaging: () => <div data-testid="op-messaging">OperationalMessaging</div>,
}));

vi.mock("../../../components/CommandCenterView", () => ({
  CommandCenterView: () => <div data-testid="command-center">CommandCenter</div>,
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
  LoadDetailView: () => <div data-testid="load-detail">LoadDetailView</div>,
}));

import IntelligenceHub from "../../../components/IntelligenceHub";
import { User, LoadData, LOAD_STATUS, WorkspaceSession, EntityType } from "../../../types";

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
  id: "session-1",
  userId: "user-1",
  startedAt: "2026-01-15T10:00:00Z",
  status: "active",
  contextStack: [],
  linkedRecordIds: [],
  notes: [],
};

describe("IntelligenceHub component", () => {
  const defaultProps = {
    user: mockUser,
    loads: mockLoads,
    brokers: [] as any[],
    users: [mockUser],
    onViewLoad: vi.fn(),
    onNavigate: vi.fn(),
    onRefreshData: vi.fn(),
    onRecordAction: vi.fn().mockResolvedValue(undefined),
    session: mockSession,
    setSession: vi.fn(),
    openRecordWorkspace: vi.fn().mockResolvedValue(undefined),
    onCloseContext: vi.fn(),
    onLinkSessionToRecord: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", async () => {
    const { container } = render(<IntelligenceHub {...defaultProps} />);
    await waitFor(() => expect(container).toBeTruthy());
  });

  it("renders with admin user", async () => {
    const { container } = render(<IntelligenceHub {...defaultProps} />);
    await waitFor(() => expect(container).toBeTruthy());
  });

  it("renders with empty loads", async () => {
    const { container } = render(
      <IntelligenceHub {...defaultProps} loads={[]} users={[]} />,
    );
    await waitFor(() => expect(container).toBeTruthy());
  });

  it("renders for dispatcher role", async () => {
    const dispatcherUser = { ...mockUser, role: "dispatcher" as const };
    const { container } = render(
      <IntelligenceHub {...defaultProps} user={dispatcherUser} users={[dispatcherUser]} />,
    );
    await waitFor(() => expect(container).toBeTruthy());
  });

  it("accepts all optional props", async () => {
    const { container } = render(
      <IntelligenceHub {...defaultProps} company={null as any} />,
    );
    await waitFor(() => expect(container).toBeTruthy());
  });
});
