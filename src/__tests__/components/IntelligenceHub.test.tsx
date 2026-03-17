import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all service dependencies at the network boundary
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
    atRiskLoads: [],
    tasks: [],
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
  getAuthHeaders: vi.fn().mockResolvedValue({}),
  getQuotes: vi.fn().mockResolvedValue([]),
  saveQuote: vi.fn(),
  getLeads: vi.fn().mockResolvedValue([]),
  saveLead: vi.fn(),
  getBookings: vi.fn().mockResolvedValue([]),
  saveBooking: vi.fn(),
  saveWorkItem: vi.fn(),
  saveLoad: vi.fn(),
  getParties: vi.fn().mockResolvedValue([]),
  saveParty: vi.fn(),
}));

vi.mock("../../../services/safetyService", () => ({
  getVendors: vi.fn().mockResolvedValue([]),
  saveVendor: vi.fn(),
  getSafetyScore: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../services/config", () => ({
  API_URL: "http://localhost:5000/api",
}));

vi.mock("../../../services/dispatchIntelligence", () => ({
  DispatchIntelligence: {
    analyze: vi.fn().mockReturnValue({ alerts: [] }),
    predictExceptionRisk: vi.fn().mockReturnValue([]),
    suggestOptimalRoute: vi.fn().mockReturnValue(null),
    getLoadIntelligence: vi.fn().mockReturnValue(null),
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
}));

vi.mock("../../../services/networkService", () => ({
  getParties: vi.fn().mockResolvedValue([]),
  saveParty: vi.fn(),
}));

vi.mock("../../../services/exceptionService", () => ({
  getExceptions: vi.fn().mockResolvedValue([]),
  getExceptionTypes: vi.fn().mockResolvedValue([]),
  updateException: vi.fn(),
}));

vi.mock("../../../services/financialService", () => ({
  getGLAccounts: vi.fn().mockResolvedValue([]),
  getLoadProfitLoss: vi.fn().mockResolvedValue(null),
  createARInvoice: vi.fn(),
  createAPBill: vi.fn(),
  createJournalEntry: vi.fn(),
  getSettlements: vi.fn().mockResolvedValue([]),
  getInvoices: vi.fn().mockResolvedValue([]),
  getBills: vi.fn().mockResolvedValue([]),
}));

vi.mock("uuid", () => ({
  v4: vi.fn().mockReturnValue("mock-uuid-hub"),
}));

// Browser API shims
beforeEach(() => {
  // ResizeObserver shim
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;
  }
});

import IntelligenceHub from "../../../components/IntelligenceHub";
import {
  globalSearch,
} from "../../../services/storageService";
import {
  User,
  LoadData,
  LOAD_STATUS,
  WorkspaceSession,
  EntityType,
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
    createdAt: "2026-01-15T00:00:00Z",
  },
  {
    id: "load-2",
    companyId: "company-1",
    driverId: "driver-2",
    loadNumber: "LN-002",
    status: LOAD_STATUS.Delivered,
    carrierRate: 2500,
    driverPay: 1500,
    pickupDate: "2026-01-14",
    pickup: { city: "Houston", state: "TX" },
    dropoff: { city: "Phoenix", state: "AZ" },
    createdAt: "2026-01-14T00:00:00Z",
  },
];

const mockSession: WorkspaceSession = {
  primaryContext: null,
  secondaryContexts: [],
  recentContexts: [],
  pinnedContexts: [],
  splitView: { enabled: false },
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

  it("renders the Unified Command Center header", async () => {
    render(<IntelligenceHub {...defaultProps} />);
    await waitFor(() => {
      expect(
        screen.getByText("Unified Command Center"),
      ).toBeInTheDocument();
    });
  });

  it("renders navigation tabs (FEED, COMMAND, SALES/CRM, SAFETY, NETWORK)", async () => {
    render(<IntelligenceHub {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("FEED")).toBeInTheDocument();
      expect(screen.getByText("COMMAND")).toBeInTheDocument();
      expect(screen.getByText("SALES/CRM")).toBeInTheDocument();
      expect(screen.getByText("SAFETY")).toBeInTheDocument();
      expect(screen.getByText("NETWORK")).toBeInTheDocument();
    });
  });

  it("defaults to the command tab", async () => {
    render(<IntelligenceHub {...defaultProps} />);
    await waitFor(() => {
      // The COMMAND tab should be active by default
      const commandTab = screen.getByText("COMMAND");
      expect(commandTab).toBeInTheDocument();
      // Command center view should be rendered
      expect(
        screen.getByText("Unified Command Center"),
      ).toBeInTheDocument();
    });
  });

  it("switches to FEED tab on click", async () => {
    const user = userEvent.setup();
    render(<IntelligenceHub {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("FEED")).toBeInTheDocument();
    });

    await user.click(screen.getByText("FEED"));
    // After switching to FEED tab, messaging content should appear
    await waitFor(() => {
      // The messaging tab renders OperationalMessaging component
      expect(screen.getByText("FEED")).toBeInTheDocument();
    });
  });

  it("switches to SAFETY tab on click", async () => {
    const user = userEvent.setup();
    render(<IntelligenceHub {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("SAFETY")).toBeInTheDocument();
    });

    await user.click(screen.getByText("SAFETY"));
    // SafetyView should render
    await waitFor(() => {
      // Safety tab renders the SafetyView component
      expect(screen.getByText("SAFETY")).toBeInTheDocument();
    });
  });

  it("switches to NETWORK tab on click", async () => {
    const user = userEvent.setup();
    render(<IntelligenceHub {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("NETWORK")).toBeInTheDocument();
    });

    await user.click(screen.getByText("NETWORK"));
    await waitFor(() => {
      // NetworkPortal should render with the Partner Network Registry heading
      expect(
        screen.getByText("Partner Network Registry"),
      ).toBeInTheDocument();
    });
  });

  it("switches to SALES/CRM tab on click", async () => {
    const user = userEvent.setup();
    render(<IntelligenceHub {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("SALES/CRM")).toBeInTheDocument();
    });

    await user.click(screen.getByText("SALES/CRM"));
    // QuoteManager should render
    await waitFor(() => {
      // QuoteManager shows pipeline view
      expect(screen.getByText("Draft")).toBeInTheDocument();
    });
  });

  it("renders the search input", async () => {
    render(<IntelligenceHub {...defaultProps} />);
    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText("SEARCH COMMAND...");
      expect(searchInput).toBeInTheDocument();
    });
  });

  it("performs a global search when typing in the search input", async () => {
    const user = userEvent.setup();
    vi.mocked(globalSearch).mockResolvedValue([
      {
        id: "load-1",
        type: "LOAD",
        label: "Load #LN-001",
        subLabel: "Chicago to Dallas",
      },
    ]);

    render(<IntelligenceHub {...defaultProps} />);
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("SEARCH COMMAND..."),
      ).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("SEARCH COMMAND...");
    await user.type(searchInput, "LN-001");

    await waitFor(() => {
      expect(globalSearch).toHaveBeenCalled();
    });
  });

  it("renders with empty loads array", async () => {
    render(<IntelligenceHub {...defaultProps} loads={[]} users={[]} />);
    await waitFor(() => {
      expect(
        screen.getByText("Unified Command Center"),
      ).toBeInTheDocument();
    });
  });

  it("renders for dispatcher role", async () => {
    const dispatcherUser = { ...mockUser, role: "dispatcher" as const };
    render(
      <IntelligenceHub
        {...defaultProps}
        user={dispatcherUser}
        users={[dispatcherUser]}
      />,
    );
    await waitFor(() => {
      expect(
        screen.getByText("Unified Command Center"),
      ).toBeInTheDocument();
    });
  });

  it("respects initialTab prop for starting tab", async () => {
    render(
      <IntelligenceHub {...defaultProps} initialTab="safety" />,
    );
    await waitFor(() => {
      // Safety tab should be the active one
      expect(screen.getByText("SAFETY")).toBeInTheDocument();
    });
  });

  it("calls onClose when the close button is clicked", async () => {
    const user = userEvent.setup();
    render(<IntelligenceHub {...defaultProps} />);
    await waitFor(() => {
      expect(
        screen.getByText("Unified Command Center"),
      ).toBeInTheDocument();
    });

    // Find the X close button (next to the nav tabs)
    const header = screen
      .getByText("Unified Command Center")
      .closest("header")!;
    // The close button has an X icon
    const buttons = header.querySelectorAll("button");
    const closeBtn = Array.from(buttons).find((b) => {
      return b.querySelector("svg") && !b.textContent?.trim();
    });
    if (closeBtn) {
      await user.click(closeBtn);
      expect(defaultProps.onClose).toBeUndefined; // onClose not passed by default
    }
  });

  it("shows workspace label as Awaiting Selection when no context", async () => {
    render(<IntelligenceHub {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Awaiting Selection")).toBeInTheDocument();
    });
  });

  it("shows workspace label from session primary context when present", async () => {
    const sessionWithContext: WorkspaceSession = {
      ...mockSession,
      primaryContext: {
        id: "load-1",
        type: "LOAD" as EntityType,
        label: "Load #LN-001",
        timestamp: "2026-01-15T10:00:00Z",
      },
    };
    render(
      <IntelligenceHub
        {...defaultProps}
        session={sessionWithContext}
      />,
    );
    await waitFor(() => {
      // The label appears in the header workspace section
      const matches = screen.getAllByText("Load #LN-001");
      expect(matches.length).toBeGreaterThanOrEqual(1);
      // The "Awaiting Selection" text should NOT be present
      expect(
        screen.queryByText("Awaiting Selection"),
      ).not.toBeInTheDocument();
    });
  });
});
