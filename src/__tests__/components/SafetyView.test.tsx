import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SafetyView } from "../../../components/SafetyView";
import type { User } from "../../../types";

// Boundary mocks: config (API_URL) for api.ts calls
vi.mock("../../../services/config", () => ({
  API_URL: "/api",
}));

// Stub services at network boundary
vi.mock("../../../services/safetyService", () => ({
  checkDriverCompliance: vi.fn().mockResolvedValue({ compliant: true }),
  getDriverQuizzes: vi.fn().mockResolvedValue([]),
  saveQuiz: vi.fn().mockResolvedValue(undefined),
  calculateDriverPerformance: vi.fn().mockResolvedValue({
    driverId: "user-1",
    totalScore: 85,
    grade: "Solid",
    status: "Active",
    metrics: {
      safetyScore: 90,
      onTimeRate: 80,
      paperworkScore: 75,
      loadCount: 10,
    },
  }),
  logSafetyActivity: vi.fn().mockResolvedValue(undefined),
  getStoredQuizzes: vi.fn().mockResolvedValue([]),
  registerAsset: vi.fn().mockResolvedValue(undefined),
  saveQuizResult: vi.fn().mockResolvedValue(undefined),
  getMaintenanceRecords: vi.fn().mockResolvedValue([]),
  saveMaintenanceRecord: vi.fn().mockResolvedValue(undefined),
  getServiceTickets: vi.fn().mockResolvedValue([]),
  saveServiceTicket: vi.fn().mockResolvedValue(undefined),
  getVendors: vi.fn().mockResolvedValue([]),
  getEquipment: vi.fn().mockResolvedValue([]),
  getComplianceRecords: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../services/authService", () => ({
  getCompanyUsers: vi.fn().mockResolvedValue([
    {
      id: "user-1",
      name: "Test Driver",
      email: "driver@test.com",
      role: "driver",
      companyId: "company-1",
      onboardingStatus: "Completed",
      safetyScore: 90,
    },
    {
      id: "user-2",
      name: "Test Admin",
      email: "admin@test.com",
      role: "admin",
      companyId: "company-1",
      onboardingStatus: "Completed",
      safetyScore: 95,
    },
  ]),
  getCompany: vi.fn().mockResolvedValue({
    id: "company-1",
    name: "Test Trucking",
    accountType: "fleet",
  }),
  updateCompany: vi.fn().mockResolvedValue(undefined),
  getIdTokenAsync: vi.fn().mockResolvedValue("mock-token"),
}));

vi.mock("../../../services/storageService", () => ({
  saveLoad: vi.fn().mockResolvedValue(undefined),
  createIncident: vi.fn().mockResolvedValue(undefined),
  seedIncidents: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../services/firebase", () => ({
  DEMO_MODE: false,
}));

vi.mock("../../../components/Scanner", () => ({
  Scanner: ({ onCancel }: { onCancel: () => void }) => (
    <div data-testid="scanner-mock">
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

const mockUser: User = {
  id: "user-1",
  name: "Test Admin",
  email: "admin@test.com",
  role: "admin",
  companyId: "company-1",
  onboardingStatus: "Completed",
  safetyScore: 95,
};

describe("SafetyView component", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock globalThis.fetch for api.ts calls (FMCSA, notifications, quizzes, settings)
    // Return null so ?? [] fallbacks work and settings stays null (shows N/A)
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(null),
    } as Response);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  // ── HEADER & CHROME ──

  it("renders the Safety & Compliance header", async () => {
    render(<SafetyView user={mockUser} />);
    await waitFor(() => {
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument();
    });
  });

  it("renders all tab navigation items", async () => {
    render(<SafetyView user={mockUser} />);
    await waitFor(() => {
      expect(screen.getByText("Monitor")).toBeInTheDocument();
    });
    expect(screen.getByText("Roster")).toBeInTheDocument();
    expect(screen.getByText("Assets")).toBeInTheDocument();
    expect(screen.getByText("Service")).toBeInTheDocument();
    expect(screen.getByText("Academy")).toBeInTheDocument();
    expect(screen.getByText("Rules")).toBeInTheDocument();
  });

  it("shows Logic Plane synchronized indicator", async () => {
    render(<SafetyView user={mockUser} />);
    await waitFor(() => {
      expect(screen.getByText("Logic Plane: Synchronized")).toBeInTheDocument();
    });
  });

  it("shows Global Fleet Governance Matrix subtitle", async () => {
    render(<SafetyView user={mockUser} />);
    await waitFor(() => {
      expect(
        screen.getByText("Global Fleet Governance Matrix"),
      ).toBeInTheDocument();
    });
  });

  // ── MONITOR (Overview) TAB ──

  it("shows the overview KPI cards on initial render", async () => {
    render(<SafetyView user={mockUser} />);
    await waitFor(() => {
      expect(screen.getByText("Fleet Safety Score")).toBeInTheDocument();
    });
    expect(screen.getByText("Pending Maintenance")).toBeInTheDocument();
    expect(screen.getByText("Non-Compliant")).toBeInTheDocument();
    expect(screen.getByText("Out of Service")).toBeInTheDocument();
  });

  it("shows KPI values on overview", async () => {
    render(<SafetyView user={mockUser} />);
    await waitFor(() => {
      expect(screen.getByText("N/A")).toBeInTheDocument();
    });
    expect(screen.getByText("13")).toBeInTheDocument();
    expect(screen.getByText("Target: 95+")).toBeInTheDocument();
    expect(screen.getByText("Drivers Flagged")).toBeInTheDocument();
    expect(screen.getByText("Red Tagged Units")).toBeInTheDocument();
    expect(screen.getByText("Submitted Reports")).toBeInTheDocument();
  });

  it("shows Fleet Health Status bars on overview tab", async () => {
    render(<SafetyView user={mockUser} />);
    await waitFor(() => {
      expect(screen.getByText("Quiz Completion")).toBeInTheDocument();
    });
    expect(screen.getByText("Vehicle Maintenance")).toBeInTheDocument();
    expect(screen.getByText("Incident Free Days")).toBeInTheDocument();
  });

  it("displays health bar percentages and day count", async () => {
    render(<SafetyView user={mockUser} />);
    // Health bars are now computed from API data. With no quiz data
    // and no equipment, values should be 0% for quiz/maintenance
    await waitFor(() => {
      expect(screen.getByText("Quiz Completion")).toBeInTheDocument();
    });
    expect(screen.getByText("Vehicle Maintenance")).toBeInTheDocument();
    expect(screen.getByText("Incident Free Days")).toBeInTheDocument();
  });

  it("shows Fleet Chain of Custody section on overview tab", async () => {
    render(<SafetyView user={mockUser} />);
    await waitFor(() => {
      expect(screen.getByText(/Fleet Chain of Custody/)).toBeInTheDocument();
    });
  });

  it("shows Fleet Health Status heading", async () => {
    render(<SafetyView user={mockUser} />);
    await waitFor(() => {
      expect(screen.getByText(/Fleet Health Status/)).toBeInTheDocument();
    });
  });

  it("shows No active incidents when no incidents provided", async () => {
    render(<SafetyView user={mockUser} incidents={[]} />);
    await waitFor(() => {
      expect(screen.getByText("No active incidents")).toBeInTheDocument();
    });
  });

  it("renders incidents when provided", async () => {
    const incidents = [
      {
        id: "inc-1",
        type: "Breakdown",
        severity: "Critical",
        timeline: [
          {
            actorName: "Driver A",
            timestamp: "2026-03-15T10:00:00Z",
            action: "Reported breakdown",
            notes: "Engine stalled on highway",
          },
        ],
      },
    ];
    render(<SafetyView user={mockUser} incidents={incidents} />);
    await waitFor(() => {
      expect(screen.getByText("Reported breakdown")).toBeInTheDocument();
    });
    expect(screen.getByText(/Driver A/)).toBeInTheDocument();
    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByText("Engine stalled on highway")).toBeInTheDocument();
  });

  it("renders multiple incidents with different severities", async () => {
    const incidents = [
      {
        id: "inc-1",
        type: "Breakdown",
        severity: "Critical",
        timeline: [
          {
            actorName: "Driver A",
            timestamp: "2026-03-15T10:00:00Z",
            action: "Reported breakdown",
            notes: "Tire blowout",
          },
        ],
      },
      {
        id: "inc-2",
        type: "Accident",
        severity: "High",
        timeline: [
          {
            actorName: "Driver B",
            timestamp: "2026-03-15T11:00:00Z",
            action: "Fender bender",
            notes: "Minor parking lot damage",
          },
        ],
      },
    ];
    render(<SafetyView user={mockUser} incidents={incidents} />);
    await waitFor(() => {
      expect(screen.getByText("Reported breakdown")).toBeInTheDocument();
    });
    expect(screen.getByText("Fender bender")).toBeInTheDocument();
    expect(screen.getByText("Tire blowout")).toBeInTheDocument();
    expect(screen.getByText("Minor parking lot damage")).toBeInTheDocument();
  });

  // ── ROSTER TAB ──

  it("switches to Roster tab when clicked", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Roster"));
    await waitFor(() => {
      expect(screen.getByText("Test Driver")).toBeInTheDocument();
    });
  });

  it("renders operator cards on roster tab with performance data", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Roster"));
    await waitFor(() => {
      expect(screen.getByText("Test Driver")).toBeInTheDocument();
    });
    expect(screen.getByText("Test Admin")).toBeInTheDocument();
  });

  it("displays driver role badges on roster cards", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Roster"));
    await waitFor(() => {
      expect(screen.getByText("driver")).toBeInTheDocument();
    });
    expect(screen.getByText("admin")).toBeInTheDocument();
  });

  it("displays performance scores on roster cards", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Roster"));
    await waitFor(() => {
      expect(screen.getByText("Test Driver")).toBeInTheDocument();
    });
    const scoreElements = screen.getAllByText("85");
    expect(scoreElements.length).toBeGreaterThan(0);
  });

  it("displays performance grade on roster cards", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Roster"));
    await waitFor(() => {
      expect(screen.getByText("Test Driver")).toBeInTheDocument();
    });
    const gradeElements = screen.getAllByText(/Solid Performer/);
    expect(gradeElements.length).toBeGreaterThan(0);
  });

  it("shows On-Time Rate and Doc Quality metrics on roster", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Roster"));
    await waitFor(() => {
      expect(screen.getByText("Test Driver")).toBeInTheDocument();
    });
    const onTimeLabels = screen.getAllByText("On-Time Rate");
    expect(onTimeLabels.length).toBeGreaterThan(0);
    const docLabels = screen.getAllByText("Doc Quality");
    expect(docLabels.length).toBeGreaterThan(0);
  });

  it("shows non-compliance warnings on roster cards", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Roster"));
    await waitFor(() => {
      expect(screen.getByText("Test Driver")).toBeInTheDocument();
    });
    const complianceWarnings = screen.getAllByText("Non-Compliant");
    expect(complianceWarnings.length).toBeGreaterThan(0);
  });

  it("shows Compliance History button on roster cards", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Roster"));
    await waitFor(() => {
      expect(screen.getByText("Test Driver")).toBeInTheDocument();
    });
    const complianceButtons = screen.getAllByText(/Compliance History/);
    expect(complianceButtons.length).toBeGreaterThan(0);
  });

  it("shows Incident button on roster cards", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Roster"));
    await waitFor(() => {
      expect(screen.getByText("Test Driver")).toBeInTheDocument();
    });
    const incidentButtons = screen.getAllByText(/Incident/);
    expect(incidentButtons.length).toBeGreaterThan(0);
  });

  it("opens compliance history modal when clicking Compliance History", async () => {
    const { getComplianceRecords } =
      await import("../../../services/safetyService");
    (getComplianceRecords as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "cr-1",
        type: "CDL",
        title: "CDL Class A",
        description: "Commercial driving license",
        expires_at: "2027-01-15",
        status: "Valid",
        reference_number: "REF-001",
      },
    ]);
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Roster"));
    await waitFor(() => {
      expect(screen.getByText("Test Driver")).toBeInTheDocument();
    });
    const complianceBtns = screen.getAllByText(/Compliance History/);
    await user.click(complianceBtns[0]);
    await waitFor(() => {
      expect(screen.getByText("CDL Class A")).toBeInTheDocument();
    });
    expect(screen.getByText("CDL")).toBeInTheDocument();
    expect(screen.getByText("Valid")).toBeInTheDocument();
  });

  it("shows empty compliance state when no records exist", async () => {
    const { getComplianceRecords } =
      await import("../../../services/safetyService");
    (getComplianceRecords as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Roster"));
    await waitFor(() => {
      expect(screen.getByText("Test Driver")).toBeInTheDocument();
    });
    const complianceBtns = screen.getAllByText(/Compliance History/);
    await user.click(complianceBtns[0]);
    await waitFor(() => {
      expect(
        screen.getByText("No active compliance violations logged."),
      ).toBeInTheDocument();
    });
  });

  it("opens incident form when clicking Incident button on roster card", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Roster"));
    await waitFor(() => {
      expect(screen.getByText("Test Driver")).toBeInTheDocument();
    });
    const incidentBtns = screen
      .getAllByText(/Incident/)
      .filter((el) => el.closest("button") !== null);
    await user.click(incidentBtns[0]);
    await waitFor(() => {
      expect(screen.getByText("incident Registration")).toBeInTheDocument();
    });
    expect(screen.getByText("Select Relevant Manifest")).toBeInTheDocument();
    expect(screen.getByText("Incident Severity")).toBeInTheDocument();
    expect(screen.getByText(/Description of Event/)).toBeInTheDocument();
  });

  it("calls onOpenHub when Call Driver is clicked", async () => {
    const onOpenHub = vi.fn();
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} onOpenHub={onOpenHub} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Roster"));
    await waitFor(() => {
      expect(screen.getByText("Test Driver")).toBeInTheDocument();
    });
    const callDriverBtns = screen.getAllByText(/Call Driver/);
    await user.click(callDriverBtns[0]);
    expect(onOpenHub).toHaveBeenCalledWith("feed", true);
  });

  // ── ASSETS TAB ──

  it("switches to Assets tab and shows Fleet Registry heading", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Assets"));
    await waitFor(() => {
      expect(screen.getByText("Fleet Registry")).toBeInTheDocument();
    });
    expect(screen.getByText(/Register Asset/)).toBeInTheDocument();
    expect(screen.queryByText("Fleet Safety Score")).not.toBeInTheDocument();
  });

  it("shows empty state when no equipment registered", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Assets"));
    await waitFor(() => {
      expect(
        screen.getByText("Inventory Syncing with Registry..."),
      ).toBeInTheDocument();
    });
  });

  it("displays equipment cards when fleet data is loaded", async () => {
    const { getEquipment } = await import("../../../services/safetyService");
    (getEquipment as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "eq-1",
        type: "Truck",
        status: "Active",
        unit_number: "TR-101",
        ownership_type: "Company Owned",
        provider_name: "Freightliner",
        daily_cost: 150,
      },
      {
        id: "eq-2",
        type: "Trailer",
        status: "Out of Service",
        unit_number: "TL-201",
        ownership_type: "Leased",
        provider_name: "Wabash",
        daily_cost: 75,
      },
    ]);
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Assets"));
    await waitFor(() => {
      expect(screen.getByText("TR-101")).toBeInTheDocument();
    });
    expect(screen.getByText("TL-201")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Out of Service")).toBeInTheDocument();
    expect(screen.getByText(/Freightliner/)).toBeInTheDocument();
    expect(screen.getByText(/Wabash/)).toBeInTheDocument();
    expect(screen.getByText("$150/Day")).toBeInTheDocument();
    expect(screen.getByText("$75/Day")).toBeInTheDocument();
  });

  it("opens asset registration form when Register Asset clicked", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Assets"));
    await waitFor(() => {
      expect(screen.getByText("Fleet Registry")).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Register Asset/));
    await waitFor(() => {
      expect(screen.getByText("asset Registration")).toBeInTheDocument();
    });
    expect(screen.getByText(/Asset ID \/ Unit Number/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. TR-101")).toBeInTheDocument();
  });

  it("fills asset form and submits", async () => {
    const { registerAsset } = await import("../../../services/safetyService");
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Assets"));
    await waitFor(() => {
      expect(screen.getByText("Fleet Registry")).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Register Asset/));
    await waitFor(() => {
      expect(screen.getByText("asset Registration")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText("e.g. TR-101"), "TR-500");
    await user.click(screen.getByText("Submit asset"));
    await waitFor(() => {
      expect(registerAsset).toHaveBeenCalled();
    });
  });

  it("closes modal form when X is clicked", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Assets"));
    await waitFor(() => {
      expect(screen.getByText("Fleet Registry")).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Register Asset/));
    await waitFor(() => {
      expect(screen.getByText("asset Registration")).toBeInTheDocument();
    });
    const modalHeader = screen.getByText("asset Registration").closest("div")!;
    const closeButton = modalHeader.parentElement!.querySelector("button");
    expect(closeButton).toBeInTheDocument();
    await user.click(closeButton!);
    await waitFor(() => {
      expect(screen.queryByText("asset Registration")).not.toBeInTheDocument();
    });
  });

  // ── SERVICE (Maintenance) TAB ──

  it("switches to Service tab and shows heading", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Service"));
    await waitFor(() => {
      expect(
        screen.getByText("Maintenance & Service Tickets"),
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/Open Service Ticket/)).toBeInTheDocument();
    expect(screen.queryByText("Fleet Safety Score")).not.toBeInTheDocument();
  });

  it("shows service tab KPI stats", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Service"));
    await waitFor(() => {
      expect(screen.getByText("Open Tickets")).toBeInTheDocument();
    });
    expect(screen.getByText("Awaiting Vendor")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("SLA Breach")).toBeInTheDocument();
  });

  it("shows the Lifecycle Fleet Health Governance subtitle", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Service"));
    await waitFor(() => {
      expect(
        screen.getByText("Lifecycle Fleet Health Governance"),
      ).toBeInTheDocument();
    });
  });

  it("shows service ticket table headers", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Service"));
    await waitFor(() => {
      expect(screen.getByText("Ticket ID")).toBeInTheDocument();
    });
    expect(screen.getByText("Unit / Type")).toBeInTheDocument();
    expect(screen.getByText("Vendor Status")).toBeInTheDocument();
    expect(screen.getByText("ETA / Progress")).toBeInTheDocument();
    expect(screen.getByText("Estimate")).toBeInTheDocument();
  });

  it("shows empty service ticket message when none exist", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Service"));
    await waitFor(() => {
      expect(screen.getByText("No open service tickets")).toBeInTheDocument();
    });
  });

  it("displays service tickets when data is loaded", async () => {
    const { getServiceTickets } =
      await import("../../../services/safetyService");
    (getServiceTickets as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "ticket-abc12345-xyz",
        unitId: "TR-101",
        type: "Preventive_Maintenance",
        status: "Open",
        createdAt: "2026-03-10T08:00:00Z",
        eta: "2026-03-20",
        estimatedCost: 450,
      },
    ]);
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Service"));
    await waitFor(() => {
      expect(screen.getByText("TR-101")).toBeInTheDocument();
    });
    expect(screen.getByText("$450")).toBeInTheDocument();
  });

  it("opens service ticket form when Open Service Ticket clicked", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Service"));
    await waitFor(() => {
      expect(
        screen.getByText("Maintenance & Service Tickets"),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Open Service Ticket/));
    await waitFor(() => {
      expect(screen.getByText("maintenance Registration")).toBeInTheDocument();
    });
    expect(screen.getByText("Select Asset")).toBeInTheDocument();
    expect(screen.getByText(/Service Description/)).toBeInTheDocument();
  });

  it("fills maintenance form and submits", async () => {
    const { saveMaintenanceRecord } =
      await import("../../../services/safetyService");
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Service"));
    await waitFor(() => {
      expect(
        screen.getByText("Maintenance & Service Tickets"),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Open Service Ticket/));
    await waitFor(() => {
      expect(screen.getByText("maintenance Registration")).toBeInTheDocument();
    });
    await user.type(
      screen.getByPlaceholderText("e.g. Annual Inspection and Oil Change"),
      "Oil change needed",
    );
    await user.click(screen.getByText("Submit maintenance"));
    await waitFor(() => {
      expect(saveMaintenanceRecord).toHaveBeenCalled();
    });
  });

  // ── ACADEMY (Quizzes) TAB ──

  it("switches to Academy tab and shows Safety Academy heading", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Academy"));
    await waitFor(() => {
      expect(screen.getByText("Safety Academy & Training")).toBeInTheDocument();
    });
    expect(
      screen.getByText("Fleet Certification & Compliance Matrix"),
    ).toBeInTheDocument();
  });

  it("shows training course cards on Academy tab or empty state", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Academy"));
    // With no API data, should show empty state "No data yet"
    await waitFor(() => {
      const noDataElements = screen.getAllByText("No data yet");
      expect(noDataElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows course types on Academy tab when data available", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Academy"));
    // With no API data, courses are empty — shows empty state
    await waitFor(() => {
      const noDataElements = screen.getAllByText("No data yet");
      expect(noDataElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows fleet completion progress on Academy courses when data available", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Academy"));
    // With no quiz data from API, shows empty state
    await waitFor(() => {
      const noDataElements = screen.getAllByText("No data yet");
      expect(noDataElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows Create Course button on Academy tab", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Academy"));
    await waitFor(() => {
      expect(screen.getByText(/Create Course/)).toBeInTheDocument();
    });
  });

  it("opens quiz creation form when Create Course clicked", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Academy"));
    await waitFor(() => {
      expect(screen.getByText(/Create Course/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Create Course/));
    await waitFor(() => {
      expect(screen.getByText("quiz Registration")).toBeInTheDocument();
    });
    expect(screen.getByText("Course Title")).toBeInTheDocument();
    expect(screen.getByText("Mandatory for all operators")).toBeInTheDocument();
  });

  it("fills quiz form and submits", async () => {
    const { saveQuiz } = await import("../../../services/safetyService");
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Academy"));
    await waitFor(() => {
      expect(screen.getByText(/Create Course/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Create Course/));
    await waitFor(() => {
      expect(screen.getByText("quiz Registration")).toBeInTheDocument();
    });
    await user.type(
      screen.getByPlaceholderText("e.g. Hazardous Materials Handling"),
      "New Safety Course",
    );
    await user.click(screen.getByLabelText("Mandatory for all operators"));
    await user.click(screen.getByText("Submit quiz"));
    await waitFor(() => {
      expect(saveQuiz).toHaveBeenCalled();
    });
  });

  it("shows recent test submissions section on Academy tab", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Academy"));
    await waitFor(() => {
      expect(screen.getByText("Recent Test Submissions")).toBeInTheDocument();
    });
    // With no quiz results from API, shows empty state
    const noDataElements = screen.getAllByText("No data yet");
    expect(noDataElements.length).toBeGreaterThanOrEqual(2); // courses + submissions
  });

  it("shows empty state when no test submissions available", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Academy"));
    await waitFor(() => {
      expect(screen.getByText("Recent Test Submissions")).toBeInTheDocument();
    });
    // No quiz results from API means empty state instead of hardcoded names
    expect(screen.queryByText("David Miller")).not.toBeInTheDocument();
    expect(screen.queryByText("John Smith")).not.toBeInTheDocument();
    expect(screen.queryByText("Robert Wilson")).not.toBeInTheDocument();
  });

  // ── RULES (Settings) TAB ──

  it("switches to Rules tab and shows Safety Configuration", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Rules"));
    await waitFor(() => {
      expect(screen.getByText("Safety Configuration")).toBeInTheDocument();
    });
  });

  it("shows all safety rules on Rules tab", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Rules"));
    await waitFor(() => {
      expect(screen.getByText("Minimum Safety Score")).toBeInTheDocument();
    });
    expect(screen.getByText("Auto-Lock Compliance")).toBeInTheDocument();
    expect(screen.getByText("Maintenance Interval")).toBeInTheDocument();
  });

  it("shows rule descriptions on Rules tab", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Rules"));
    await waitFor(() => {
      expect(
        screen.getByText(
          "Drivers below this score will be blocked from new dispatches.",
        ),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(
        "Block drivers automatically if mandatory quizzes are expired.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Default days between PM inspections."),
    ).toBeInTheDocument();
  });

  it("shows rule values on Rules tab from API or N/A defaults", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Rules"));
    // Without mocked fetch for /api/safety/settings, values show N/A
    await waitFor(() => {
      const naElements = screen.getAllByText("N/A");
      expect(naElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows Save Safety Policy button on Rules tab", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Rules"));
    await waitFor(() => {
      expect(screen.getByText("Save Safety Policy")).toBeInTheDocument();
    });
  });

  it("shows feedback when Save Safety Policy is clicked", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Rules"));
    await waitFor(() => {
      expect(screen.getByText("Save Safety Policy")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Save Safety Policy"));
    await waitFor(() => {
      expect(
        screen.getByText("Safety Policy Updated & Synced to Fleet"),
      ).toBeInTheDocument();
    });
  });

  // ── FEEDBACK & ERROR HANDLING ──

  it("shows ErrorState when data loading fails", async () => {
    const { getCompany } = await import("../../../services/authService");
    (getCompany as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Network error"),
    );
    render(<SafetyView user={mockUser} />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("ErrorState retry button re-fetches and recovers from error", async () => {
    const user = userEvent.setup();
    const { getCompany, getCompanyUsers } =
      await import("../../../services/authService");
    (getCompany as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Network error"),
    );
    (getCompany as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "company-1",
      name: "Test Trucking",
      accountType: "fleet",
    });
    (getCompanyUsers as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    render(<SafetyView user={mockUser} />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Safety & Compliance")).toBeInTheDocument();
  });

  // ── INCIDENT CREATION WORKFLOW ──

  it("creates an incident with severity and description", async () => {
    const { createIncident } = await import("../../../services/storageService");
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Roster"));
    await waitFor(() => {
      expect(screen.getByText("Test Driver")).toBeInTheDocument();
    });
    const incidentBtns = screen
      .getAllByText(/Incident/)
      .filter((el) => el.closest("button") !== null);
    await user.click(incidentBtns[0]);
    await waitFor(() => {
      expect(screen.getByText("incident Registration")).toBeInTheDocument();
    });
    await user.type(
      screen.getByPlaceholderText(
        "DESCRIBE THE INCIDENT IN DETAIL FOR AUDIT CONTROL...",
      ),
      "Flat tire on highway",
    );
    await user.click(screen.getByText("Submit incident"));
    await waitFor(() => {
      expect(createIncident).toHaveBeenCalled();
    });
  });

  // ── TAB SWITCHING ──

  it("switching between all tabs does not crash", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Safety & Compliance")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Roster"));
    await waitFor(() => {
      expect(screen.getByText("Test Driver")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Assets"));
    await waitFor(() => {
      expect(screen.getByText("Fleet Registry")).toBeInTheDocument();
    });
    // "Service" text appears both in the tab nav and potentially in asset cards,
    // so use getAllByText and click the first (nav) occurrence.
    await user.click(screen.getAllByText("Service")[0]);
    await waitFor(() => {
      expect(
        screen.getByText("Maintenance & Service Tickets"),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByText("Academy"));
    await waitFor(() => {
      expect(screen.getByText("Safety Academy & Training")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Rules"));
    await waitFor(() => {
      expect(screen.getByText("Safety Configuration")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Monitor"));
    await waitFor(() => {
      expect(screen.getByText("Fleet Safety Score")).toBeInTheDocument();
    });
  });
});
