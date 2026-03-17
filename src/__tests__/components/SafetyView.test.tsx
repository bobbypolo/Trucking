import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SafetyView } from "../../../components/SafetyView";
import type { User } from "../../../types";

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
  getServiceTickets: vi.fn().mockReturnValue([]),
  saveServiceTicket: vi.fn().mockResolvedValue(undefined),
  getVendors: vi.fn().mockReturnValue([]),
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Existing tests (overview, header, nav) ---

  it("renders the Safety & Compliance header", async () => {
    render(<SafetyView user={mockUser} />);
    expect(screen.getByText("Safety & Compliance")).toBeInTheDocument();
  });

  it("renders the overview tab navigation", async () => {
    render(<SafetyView user={mockUser} />);
    expect(screen.getByText("Monitor")).toBeInTheDocument();
    expect(screen.getByText("Roster")).toBeInTheDocument();
    expect(screen.getByText("Assets")).toBeInTheDocument();
    expect(screen.getByText("Service")).toBeInTheDocument();
    expect(screen.getByText("Academy")).toBeInTheDocument();
    expect(screen.getByText("Rules")).toBeInTheDocument();
  });

  it("shows the overview KPI cards on initial render", async () => {
    render(<SafetyView user={mockUser} />);
    await waitFor(() => {
      expect(screen.getByText("Fleet Safety Score")).toBeInTheDocument();
    });
    expect(screen.getByText("Pending Maintenance")).toBeInTheDocument();
    expect(screen.getByText("Non-Compliant")).toBeInTheDocument();
    expect(screen.getByText("Out of Service")).toBeInTheDocument();
  });

  it("shows Fleet Health Status bars on overview tab", async () => {
    render(<SafetyView user={mockUser} />);
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

  it("shows 'No active incidents' when no incidents provided", async () => {
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
  });

  it("shows Logic Plane synchronized indicator", async () => {
    render(<SafetyView user={mockUser} />);
    expect(
      screen.getByText("Logic Plane: Synchronized"),
    ).toBeInTheDocument();
  });

  it("shows Global Fleet Governance Matrix subtitle", async () => {
    render(<SafetyView user={mockUser} />);
    expect(
      screen.getByText("Global Fleet Governance Matrix"),
    ).toBeInTheDocument();
  });

  it("shows feedback message when data loading fails", async () => {
    const { getCompany } = await import("../../../services/authService");
    (getCompany as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Network error"),
    );
    render(<SafetyView user={mockUser} />);
    await waitFor(() => {
      expect(
        screen.getByText(/Logic Sync Interrupted/),
      ).toBeInTheDocument();
    });
  });

  it("dismisses feedback message when X is clicked", async () => {
    const { getCompany } = await import("../../../services/authService");
    (getCompany as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Network error"),
    );
    render(<SafetyView user={mockUser} />);
    await waitFor(() => {
      expect(screen.getByText(/Logic Sync Interrupted/)).toBeInTheDocument();
    });
    const feedbackText = screen.getByText(/Logic Sync Interrupted/);
    const feedbackContainer = feedbackText.closest('[class*="fixed"]');
    expect(feedbackContainer).not.toBeNull();
    const closeBtn = feedbackContainer!.querySelector("button");
    expect(closeBtn).not.toBeNull();
    fireEvent.click(closeBtn!);
    await waitFor(() => {
      expect(screen.queryByText(/Logic Sync Interrupted/)).not.toBeInTheDocument();
    });
  });

  // --- Monitor tab: KPI values and health bars ---

  it("displays KPI numeric values on overview tab", async () => {
    render(<SafetyView user={mockUser} />);
    await waitFor(() => {
      expect(screen.getByText("65")).toBeInTheDocument();
    });
    expect(screen.getByText("Target: 95+")).toBeInTheDocument();
    expect(screen.getByText("Submitted Reports")).toBeInTheDocument();
    expect(screen.getByText("Drivers Flagged")).toBeInTheDocument();
    expect(screen.getByText("Red Tagged Units")).toBeInTheDocument();
  });

  it("displays Fleet Health progress percentages", async () => {
    render(<SafetyView user={mockUser} />);
    await waitFor(() => {
      expect(screen.getByText("124 Days")).toBeInTheDocument();
    });
  });

  it("renders multiple incidents with separate timelines", async () => {
    const incidents = [
      {
        id: "inc-1",
        type: "Collision",
        severity: "Critical",
        timeline: [
          { actorName: "Driver X", timestamp: "2026-03-10T08:00:00Z", action: "Collision reported", notes: "Rear-end collision" },
          { actorName: "Safety Mgr", timestamp: "2026-03-10T09:00:00Z", action: "Investigation started", notes: "Photos collected" },
        ],
      },
      {
        id: "inc-2",
        type: "Equipment",
        severity: "High",
        timeline: [
          { actorName: "Driver Y", timestamp: "2026-03-11T14:00:00Z", action: "Tire blowout", notes: "Left rear tire" },
        ],
      },
    ];
    render(<SafetyView user={mockUser} incidents={incidents} />);
    await waitFor(() => {
      expect(screen.getByText("Collision reported")).toBeInTheDocument();
    });
    expect(screen.getByText("Investigation started")).toBeInTheDocument();
    expect(screen.getByText("Tire blowout")).toBeInTheDocument();
    expect(screen.getByText(/Driver X/)).toBeInTheDocument();
    expect(screen.getByText(/Driver Y/)).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  // --- Roster tab deep tests ---

  it("switches to Roster tab and shows operator cards", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await user.click(screen.getByText("Roster"));
    await waitFor(() => {
      expect(screen.getByText("Test Driver")).toBeInTheDocument();
    });
    expect(screen.getByText("Test Admin")).toBeInTheDocument();
  });

  it("shows operator performance scores on roster tab", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await user.click(screen.getByText("Roster"));
    await waitFor(() => {
      expect(screen.getByText("Test Driver")).toBeInTheDocument();
    });
    const scoreElements = screen.getAllByText("85");
    expect(scoreElements.length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Solid Performer/).length).toBeGreaterThan(0);
  });

  it("shows On-Time Rate and Doc Quality metrics on roster tab", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await user.click(screen.getByText("Roster"));
    await waitFor(() => {
      expect(screen.getByText("Test Driver")).toBeInTheDocument();
    });
    expect(screen.getAllByText("On-Time Rate").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Doc Quality").length).toBeGreaterThan(0);
  });

  it("shows non-compliant alerts on roster cards", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await user.click(screen.getByText("Roster"));
    await waitFor(() => {
      expect(screen.getByText("Test Driver")).toBeInTheDocument();
    });
    expect(screen.getAllByText("Non-Compliant").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Mandatory Quiz Missing/).length).toBeGreaterThan(0);
  });

  it("shows Compliance History, Incident, and Call Driver buttons on roster", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await user.click(screen.getByText("Roster"));
    await waitFor(() => {
      expect(screen.getByText("Test Driver")).toBeInTheDocument();
    });
    expect(screen.getAllByText(/Compliance History/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Incident/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Call Driver/).length).toBeGreaterThan(0);
  });

  it("opens incident form from roster card", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await user.click(screen.getByText("Roster"));
    await waitFor(() => {
      expect(screen.getByText("Test Driver")).toBeInTheDocument();
    });
    const incidentBtns = screen.getAllByText(/Incident/);
    await user.click(incidentBtns[0]);
    await waitFor(() => {
      expect(screen.getByText("incident Registration")).toBeInTheDocument();
    });
    expect(screen.getByText("Select Relevant Manifest")).toBeInTheDocument();
    expect(screen.getByText("Incident Severity")).toBeInTheDocument();
    expect(screen.getByText("Description of Event")).toBeInTheDocument();
  });

  it("opens compliance history modal from roster card", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await user.click(screen.getByText("Roster"));
    await waitFor(() => {
      expect(screen.getByText("Test Driver")).toBeInTheDocument();
    });
    const historyBtns = screen.getAllByText(/Compliance History/);
    await user.click(historyBtns[0]);
    await waitFor(() => {
      expect(screen.getByText("No active compliance violations logged.")).toBeInTheDocument();
    });
  });

  it("closes compliance history modal when X is clicked", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await user.click(screen.getByText("Roster"));
    await waitFor(() => {
      expect(screen.getByText("Test Driver")).toBeInTheDocument();
    });
    // There are multiple "Compliance History" buttons on roster cards, click the first
    const historyBtns = screen.getAllByText(/Compliance History/);
    await user.click(historyBtns[0]);
    await waitFor(() => {
      expect(screen.getByText("No active compliance violations logged.")).toBeInTheDocument();
    });
    // The modal heading is inside a fixed overlay. Find the close button in it.
    const noViolationsText = screen.getByText("No active compliance violations logged.");
    const modal = noViolationsText.closest('[class*="fixed"]');
    const closeButton = modal!.querySelector("button");
    await user.click(closeButton!);
    await waitFor(() => {
      expect(screen.queryByText("No active compliance violations logged.")).not.toBeInTheDocument();
    });
  });

  // --- Assets tab deep tests ---

  it("shows empty fleet registry message when no equipment exists", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await user.click(screen.getByText("Assets"));
    await waitFor(() => {
      expect(screen.getByText("Fleet Registry")).toBeInTheDocument();
    });
    expect(screen.getByText(/Inventory Syncing with Registry/)).toBeInTheDocument();
  });

  it("opens asset registration modal when Register Asset is clicked", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await user.click(screen.getByText("Assets"));
    await waitFor(() => {
      expect(screen.getByText(/Register Asset/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Register Asset/));
    await waitFor(() => {
      expect(screen.getByText("asset Registration")).toBeInTheDocument();
    });
    expect(screen.getByText("Asset ID / Unit Number")).toBeInTheDocument();
  });

  it("closes asset registration modal when X is clicked", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await user.click(screen.getByText("Assets"));
    await waitFor(() => {
      expect(screen.getByText(/Register Asset/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Register Asset/));
    await waitFor(() => {
      expect(screen.getByText("asset Registration")).toBeInTheDocument();
    });
    const modalHeader = screen.getByText("asset Registration").closest("div")!.parentElement!;
    const closeBtn = modalHeader.querySelector("button");
    await user.click(closeBtn!);
    await waitFor(() => {
      expect(screen.queryByText("asset Registration")).not.toBeInTheDocument();
    });
  });

  it("submits asset registration form and calls registerAsset", async () => {
    const { registerAsset } = await import("../../../services/safetyService");
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await user.click(screen.getByText("Assets"));
    await waitFor(() => {
      expect(screen.getByText(/Register Asset/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Register Asset/));
    await waitFor(() => {
      expect(screen.getByText("asset Registration")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText("e.g. TR-101"), "TR-999");
    await user.click(screen.getByText("Submit asset"));
    await waitFor(() => {
      expect(registerAsset).toHaveBeenCalled();
    });
  });

  // --- Service tab deep tests ---

  it("shows service tab KPI cards", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await user.click(screen.getByText("Service"));
    await waitFor(() => {
      expect(screen.getByText("Open Tickets")).toBeInTheDocument();
    });
    expect(screen.getByText("Awaiting Vendor")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("SLA Breach")).toBeInTheDocument();
  });

  it("shows service ticket table headers on Service tab", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await user.click(screen.getByText("Service"));
    await waitFor(() => {
      expect(screen.getByText("Ticket ID")).toBeInTheDocument();
    });
    expect(screen.getByText("Unit / Type")).toBeInTheDocument();
    expect(screen.getByText("Vendor Status")).toBeInTheDocument();
    expect(screen.getByText("ETA / Progress")).toBeInTheDocument();
    expect(screen.getByText("Estimate")).toBeInTheDocument();
  });

  it("shows 'No open service tickets' when no tickets exist", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await user.click(screen.getByText("Service"));
    await waitFor(() => {
      expect(screen.getByText("No open service tickets")).toBeInTheDocument();
    });
  });

  it("opens maintenance ticket modal from Service tab", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await user.click(screen.getByText("Service"));
    await waitFor(() => {
      expect(screen.getByText(/Open Service Ticket/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Open Service Ticket/));
    await waitFor(() => {
      expect(screen.getByText("maintenance Registration")).toBeInTheDocument();
    });
    expect(screen.getByText("Select Asset")).toBeInTheDocument();
    expect(screen.getByText("Service Description")).toBeInTheDocument();
  });

  // --- Academy tab deep tests ---

  it("switches to Academy tab and shows training courses", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await user.click(screen.getByText("Academy"));
    await waitFor(() => {
      expect(screen.getByText("Safety Academy & Training")).toBeInTheDocument();
    });
    expect(screen.getByText("Winter Operations 2025")).toBeInTheDocument();
    expect(screen.getByText("Hazmat Handling (L1)")).toBeInTheDocument();
    expect(screen.getByText("Hours of Service Compliance")).toBeInTheDocument();
  });

  it("shows course completion percentages on Academy tab", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await user.click(screen.getByText("Academy"));
    await waitFor(() => {
      expect(screen.getByText("42%")).toBeInTheDocument();
    });
    expect(screen.getByText("98%")).toBeInTheDocument();
  });

  it("shows recent test submissions on Academy tab", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await user.click(screen.getByText("Academy"));
    await waitFor(() => {
      expect(screen.getByText("Recent Test Submissions")).toBeInTheDocument();
    });
    expect(screen.getByText("David Miller")).toBeInTheDocument();
    expect(screen.getByText("John Smith")).toBeInTheDocument();
    expect(screen.getByText("Robert Wilson")).toBeInTheDocument();
    expect(screen.getAllByText("Passed").length).toBe(2);
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("opens Create Course modal from Academy tab", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
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

  // --- Rules tab deep tests ---

  it("switches to Rules tab and shows Safety Configuration", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await user.click(screen.getByText("Rules"));
    await waitFor(() => {
      expect(screen.getByText("Safety Configuration")).toBeInTheDocument();
    });
    expect(screen.getByText("Minimum Safety Score")).toBeInTheDocument();
    expect(screen.getByText("Auto-Lock Compliance")).toBeInTheDocument();
    expect(screen.getByText("Maintenance Interval")).toBeInTheDocument();
  });

  it("shows safety rule descriptions on Rules tab", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await user.click(screen.getByText("Rules"));
    await waitFor(() => {
      expect(screen.getByText(/Drivers below this score will be blocked/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Block drivers automatically if mandatory quizzes are expired/)).toBeInTheDocument();
    expect(screen.getByText(/Default days between PM inspections/)).toBeInTheDocument();
  });

  it("shows safety rule values on Rules tab", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await user.click(screen.getByText("Rules"));
    await waitFor(() => {
      expect(screen.getByText("75")).toBeInTheDocument();
    });
    expect(screen.getByText("On")).toBeInTheDocument();
    expect(screen.getByText("90 Days")).toBeInTheDocument();
  });

  it("shows feedback when Save Safety Policy is clicked", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    await user.click(screen.getByText("Rules"));
    await waitFor(() => {
      expect(screen.getByText("Save Safety Policy")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Save Safety Policy"));
    await waitFor(() => {
      expect(screen.getByText(/Safety Policy Updated & Synced to Fleet/)).toBeInTheDocument();
    });
  });

  // --- Tab navigation ---

  it("navigates between tabs preserving correct content", async () => {
    const user = userEvent.setup();
    render(<SafetyView user={mockUser} />);
    expect(screen.getByText("Fleet Safety Score")).toBeInTheDocument();
    await user.click(screen.getByText("Rules"));
    await waitFor(() => {
      expect(screen.getByText("Safety Configuration")).toBeInTheDocument();
    });
    expect(screen.queryByText("Fleet Safety Score")).not.toBeInTheDocument();
    await user.click(screen.getByText("Monitor"));
    await waitFor(() => {
      expect(screen.getByText("Fleet Safety Score")).toBeInTheDocument();
    });
    expect(screen.queryByText("Safety Configuration")).not.toBeInTheDocument();
  });

  it("renders with loads prop without crashing", async () => {
    const loads = [
      {
        id: "load-1",
        companyId: "company-1",
        driverId: "user-1",
        loadNumber: "LN-001",
        status: "active" as const,
        carrierRate: 1500,
        driverPay: 750,
        pickupDate: "2025-12-01",
        pickup: { city: "Chicago", state: "IL" },
        dropoff: { city: "Dallas", state: "TX" },
      },
    ];
    render(<SafetyView user={mockUser} loads={loads} />);
    expect(screen.getByText("Safety & Compliance")).toBeInTheDocument();
  });
});
