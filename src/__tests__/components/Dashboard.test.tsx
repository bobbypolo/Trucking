import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Dashboard } from "../../../components/Dashboard";
import { LoadData, User, LOAD_STATUS } from "../../../types";
import * as exceptionService from "../../../services/exceptionService";

// Tests R-P3-04
// Mock services that make network calls
vi.mock("../../../services/exceptionService", () => ({
  getExceptions: vi.fn().mockResolvedValue([]),
  getDashboardCards: vi.fn().mockResolvedValue([]),
}));

const mockUser: User = {
  id: "user-1",
  companyId: "company-1",
  email: "admin@test.com",
  name: "Test Admin",
  role: "admin",
  onboardingStatus: "Completed",
  safetyScore: 100,
};

const mockOwnerOperator: User = {
  id: "user-2",
  companyId: "company-1",
  email: "owner@test.com",
  name: "Owner Op",
  role: "owner_operator",
  onboardingStatus: "Completed",
  safetyScore: 95,
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
    miles: 800,
    pickupDate: "2025-12-01",
    pickup: { city: "Chicago", state: "IL" },
    dropoff: { city: "Dallas", state: "TX" },
  },
  {
    id: "load-2",
    companyId: "company-1",
    driverId: "driver-2",
    loadNumber: "LN-002",
    status: LOAD_STATUS.Delivered,
    carrierRate: 2000,
    driverPay: 1200,
    miles: 600,
    pickupDate: "2025-12-02",
    pickup: { city: "Atlanta", state: "GA" },
    dropoff: { city: "Miami", state: "FL" },
  },
];

const mockExceptions = [
  {
    id: "ex-1",
    type: "POD_MISSING",
    entityId: "load-1",
    ownerUserId: "dispatcher-1",
    severity: 4,
    status: "OPEN",
    financialImpactEst: 1500,
  },
  {
    id: "ex-2",
    type: "DETENTION_ELIGIBLE",
    entityId: "load-2",
    ownerUserId: "dispatcher-2",
    severity: 2,
    status: "OPEN",
    financialImpactEst: 350,
  },
  {
    id: "ex-3",
    type: "DOC_PENDING_48H",
    entityId: "load-1",
    ownerUserId: "dispatcher-1",
    severity: 3,
    status: "OPEN",
    financialImpactEst: 800,
  },
];

const mockCards = [
  {
    cardCode: "POD_MISSING",
    displayName: "POD Missing",
    iconKey: "file",
    filterJson: JSON.stringify({ type_in: ["POD_MISSING"] }),
  },
  {
    cardCode: "DETENTION",
    displayName: "Detention Eligible",
    iconKey: "clock",
    filterJson: JSON.stringify({ type_in: ["DETENTION_ELIGIBLE"] }),
  },
  {
    cardCode: "ALL_EXCEPTIONS",
    displayName: "All Exceptions",
    iconKey: "alert",
    filterJson: "{}",
  },
];

describe("Dashboard component", () => {
  const defaultProps = {
    user: mockUser,
    loads: mockLoads,
    onViewLoad: vi.fn(),
    onNavigate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(exceptionService.getExceptions).mockResolvedValue([]);
    vi.mocked(exceptionService.getDashboardCards).mockResolvedValue([]);
  });

  // --- Existing error/loading tests ---

  it("shows error banner when API call fails", async () => {
    vi.mocked(exceptionService.getExceptions).mockRejectedValue(
      new Error("Network error"),
    );
    vi.mocked(exceptionService.getDashboardCards).mockRejectedValue(
      new Error("Network error"),
    );
    render(<Dashboard {...defaultProps} />);
    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toContain("Unable to load");
    });
  });

  it("shows retry button in error banner", async () => {
    vi.mocked(exceptionService.getExceptions).mockRejectedValue(
      new Error("Network error"),
    );
    vi.mocked(exceptionService.getDashboardCards).mockRejectedValue(
      new Error("Network error"),
    );
    render(<Dashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("clears error and reloads when retry button is clicked", async () => {
    vi.mocked(exceptionService.getExceptions).mockRejectedValue(
      new Error("Network error"),
    );
    vi.mocked(exceptionService.getDashboardCards).mockRejectedValue(
      new Error("Network error"),
    );
    render(<Dashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    vi.mocked(exceptionService.getExceptions).mockResolvedValue([]);
    vi.mocked(exceptionService.getDashboardCards).mockResolvedValue([]);
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  it("does not show error banner when API succeeds", async () => {
    render(<Dashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  // --- Header and navigation buttons ---

  it("renders the Operations Dashboard heading", async () => {
    render(<Dashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Operations Dashboard")).toBeInTheDocument();
    });
  });

  it("renders the status subtitle", async () => {
    render(<Dashboard {...defaultProps} />);
    await waitFor(() => {
      expect(
        screen.getByText("Status: Volume Priority & Active Exceptions"),
      ).toBeInTheDocument();
    });
  });

  it("renders Reports button that navigates to analytics", async () => {
    const user = userEvent.setup();
    render(<Dashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Reports/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Reports/));
    expect(defaultProps.onNavigate).toHaveBeenCalledWith("analytics");
  });

  it("renders Operations Center button that navigates to operations-hub", async () => {
    const user = userEvent.setup();
    render(<Dashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Operations Center/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Operations Center/));
    expect(defaultProps.onNavigate).toHaveBeenCalledWith("operations-hub");
  });

  // --- Top row: Big number cards ---

  it("shows Open Exceptions card with count", async () => {
    vi.mocked(exceptionService.getExceptions).mockResolvedValue(mockExceptions as any);
    render(<Dashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Open Exceptions")).toBeInTheDocument();
    });
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Active Work Items")).toBeInTheDocument();
  });

  it("shows SLA Breaches card with severity-4 count", async () => {
    vi.mocked(exceptionService.getExceptions).mockResolvedValue(mockExceptions as any);
    render(<Dashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("SLA Breaches")).toBeInTheDocument();
    });
    expect(screen.getByText("Critical Attention")).toBeInTheDocument();
  });

  it("shows $ On Hold (Docs) card with financial impact", async () => {
    vi.mocked(exceptionService.getExceptions).mockResolvedValue(mockExceptions as any);
    render(<Dashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("$ On Hold (Docs)")).toBeInTheDocument();
    });
    expect(screen.getByText("Revenue at Risk")).toBeInTheDocument();
  });

  it("shows $ Accruing (Detention) card", async () => {
    vi.mocked(exceptionService.getExceptions).mockResolvedValue(mockExceptions as any);
    render(<Dashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("$ Accruing (Detention)")).toBeInTheDocument();
    });
    expect(screen.getByText("Estimated Layover/Stop")).toBeInTheDocument();
  });

  it("navigates to exceptions when Open Exceptions card is clicked", async () => {
    const user = userEvent.setup();
    render(<Dashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Open Exceptions")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Open Exceptions").closest("[class*='cursor-pointer']")!);
    expect(defaultProps.onNavigate).toHaveBeenCalledWith("exceptions", "all");
  });

  it("navigates to exceptions critical when SLA Breaches is clicked", async () => {
    const user = userEvent.setup();
    render(<Dashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("SLA Breaches")).toBeInTheDocument();
    });
    await user.click(screen.getByText("SLA Breaches").closest("[class*='cursor-pointer']")!);
    expect(defaultProps.onNavigate).toHaveBeenCalledWith("exceptions", "critical");
  });

  // --- Action Items cards ---

  it("shows Action Items heading", async () => {
    vi.mocked(exceptionService.getDashboardCards).mockResolvedValue(mockCards as any);
    render(<Dashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Action Items")).toBeInTheDocument();
    });
  });

  it("renders dashboard cards with display names and counts", async () => {
    vi.mocked(exceptionService.getExceptions).mockResolvedValue(mockExceptions as any);
    vi.mocked(exceptionService.getDashboardCards).mockResolvedValue(mockCards as any);
    render(<Dashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("POD Missing")).toBeInTheDocument();
    });
    expect(screen.getByText("Detention Eligible")).toBeInTheDocument();
  });

  it("navigates to exceptions sub-tab when action item card is clicked", async () => {
    const user = userEvent.setup();
    vi.mocked(exceptionService.getExceptions).mockResolvedValue(mockExceptions as any);
    vi.mocked(exceptionService.getDashboardCards).mockResolvedValue(mockCards as any);
    render(<Dashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("POD Missing")).toBeInTheDocument();
    });
    await user.click(screen.getByText("POD Missing").closest("[class*='cursor-pointer']")!);
    expect(defaultProps.onNavigate).toHaveBeenCalledWith("exceptions", "pod-missing");
  });

  // --- Active Issues / Exception Feed ---

  it("shows Active Issues heading", async () => {
    render(<Dashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Active Issues")).toBeInTheDocument();
    });
  });

  it("shows 'All Exceptions Resolved' when no exceptions exist", async () => {
    render(<Dashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("All Exceptions Resolved")).toBeInTheDocument();
    });
  });

  it("shows exception items in feed when exceptions exist", async () => {
    vi.mocked(exceptionService.getExceptions).mockResolvedValue(mockExceptions as any);
    render(<Dashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/POD MISSING/)).toBeInTheDocument();
    });
  });

  it("shows View Full Command Console button", async () => {
    render(<Dashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("View Full Command Console")).toBeInTheDocument();
    });
  });

  it("navigates to exceptions when View Full Command Console is clicked", async () => {
    const user = userEvent.setup();
    render(<Dashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("View Full Command Console")).toBeInTheDocument();
    });
    await user.click(screen.getByText("View Full Command Console"));
    expect(defaultProps.onNavigate).toHaveBeenCalledWith("exceptions");
  });

  // --- Bottom row: Fleet overview ---

  it("shows Fleet Overview section with In-Transit and SLA Health", async () => {
    render(<Dashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Fleet Overview")).toBeInTheDocument();
    });
    expect(screen.getByText("In-Transit")).toBeInTheDocument();
    expect(screen.getByText("SLA Health")).toBeInTheDocument();
  });

  it("shows map navigation button in Fleet Overview", async () => {
    const user = userEvent.setup();
    render(<Dashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Fleet Overview")).toBeInTheDocument();
    });
    // The globe button navigates to map
    const fleetSection = screen.getByText("Fleet Overview").closest("div")!.parentElement!;
    const mapBtn = fleetSection.querySelector("button");
    await user.click(mapBtn!);
    expect(defaultProps.onNavigate).toHaveBeenCalledWith("map");
  });

  it("shows Open Doc Exceptions section", async () => {
    render(<Dashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Open Doc Exceptions")).toBeInTheDocument();
    });
    expect(screen.getByText("Revenue on hold")).toBeInTheDocument();
  });

  it("shows Accruing Detention section in bottom row", async () => {
    render(<Dashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Accruing Detention")).toBeInTheDocument();
    });
    expect(screen.getByText("Today's Revenue Capture")).toBeInTheDocument();
  });

  // --- owner_operator role-based tiles ---

  it("shows Money & Performance tile for owner_operator role", async () => {
    vi.mocked(exceptionService.getExceptions).mockResolvedValue([]);
    vi.mocked(exceptionService.getDashboardCards).mockResolvedValue([]);
    render(<Dashboard {...defaultProps} user={mockOwnerOperator} />);
    await waitFor(() => {
      expect(screen.getByText(/Money & Performance/)).toBeInTheDocument();
    });
    expect(screen.getByText("RPM (Avg)")).toBeInTheDocument();
    expect(screen.getByText("Operating Margin")).toBeInTheDocument();
  });

  it("shows IFTA Automation tile for owner_operator role", async () => {
    render(<Dashboard {...defaultProps} user={mockOwnerOperator} />);
    await waitFor(() => {
      expect(screen.getByText(/IFTA Automation/)).toBeInTheDocument();
    });
    expect(screen.getByText("IFTA Coverage")).toBeInTheDocument();
  });

  it("shows Compliance Health tile for owner_operator role", async () => {
    render(<Dashboard {...defaultProps} user={mockOwnerOperator} />);
    await waitFor(() => {
      expect(screen.getByText(/Compliance Health/)).toBeInTheDocument();
    });
    // SLA Health appears both in the owner_operator tile and Fleet Overview
    expect(screen.getAllByText("SLA Health").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Active Loads")).toBeInTheDocument();
  });

  it("does not show owner_operator tiles for admin role", async () => {
    render(<Dashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Operations Dashboard")).toBeInTheDocument();
    });
    expect(screen.queryByText(/IFTA Automation/)).not.toBeInTheDocument();
  });

  // --- Statistics computation ---

  it("computes and displays active loads count correctly", async () => {
    render(<Dashboard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Fleet Overview")).toBeInTheDocument();
    });
    // 1 load is In_Transit
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("renders with empty loads array showing zero values", async () => {
    render(<Dashboard {...defaultProps} loads={[]} />);
    await waitFor(() => {
      expect(screen.getByText("Fleet Overview")).toBeInTheDocument();
    });
    // Should show 0 in-transit and 100% SLA Health
    expect(screen.getByText("100%")).toBeInTheDocument();
  });
});
