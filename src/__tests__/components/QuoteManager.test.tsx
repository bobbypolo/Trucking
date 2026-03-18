import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QuoteManager } from "../../../components/QuoteManager";
import type {
  User,
  Company,
  Quote,
  Lead,
  Booking,
  WorkItem,
} from "../../../types";

vi.mock("../../../services/storageService", () => ({
  getQuotes: vi.fn(),
  saveQuote: vi.fn().mockResolvedValue(undefined),
  getLeads: vi.fn(),
  saveLead: vi.fn(),
  getBookings: vi.fn(),
  saveBooking: vi.fn().mockResolvedValue(undefined),
  getWorkItems: vi.fn(),
  saveWorkItem: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../services/authService", () => ({
  checkCapability: vi.fn().mockReturnValue(true),
}));

vi.mock("uuid", () => ({
  v4: vi.fn().mockReturnValue("mock-uuid-001"),
}));

import {
  getQuotes,
  saveQuote,
  saveBooking,
  getLeads,
  getBookings,
  getWorkItems,
  saveWorkItem,
} from "../../../services/storageService";

const mockUser: User = {
  id: "user-1",
  companyId: "company-1",
  email: "admin@test.com",
  name: "Test Admin",
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
  driverPermissions: {} as any,
};

const mockQuotes: Quote[] = [
  {
    id: "q-1",
    companyId: "company-1",
    status: "Draft",
    pickup: { city: "Chicago", state: "IL" },
    dropoff: { city: "Dallas", state: "TX" },
    equipmentType: "Dry Van",
    linehaul: 2000,
    fuelSurcharge: 200,
    accessorials: [],
    totalRate: 2200,
    version: 1,
    validUntil: "2026-02-28",
    ownerId: "user-1",
    createdAt: "2026-01-15T00:00:00Z",
  },
  {
    id: "q-2",
    companyId: "company-1",
    status: "Sent",
    pickup: { city: "Houston", state: "TX" },
    dropoff: { city: "Phoenix", state: "AZ" },
    equipmentType: "Flatbed",
    linehaul: 3500,
    fuelSurcharge: 350,
    accessorials: [{ type: "Lumper", amount: 150 }],
    totalRate: 4000,
    version: 1,
    validUntil: "2026-02-28",
    ownerId: "user-1",
    createdAt: "2026-01-16T00:00:00Z",
  },
  {
    id: "q-3",
    companyId: "company-1",
    status: "Accepted",
    pickup: { city: "Atlanta", state: "GA" },
    dropoff: { city: "Miami", state: "FL" },
    equipmentType: "Dry Van",
    linehaul: 1800,
    fuelSurcharge: 180,
    accessorials: [],
    totalRate: 1980,
    version: 2,
    validUntil: "2026-03-15",
    ownerId: "user-1",
    createdAt: "2026-01-10T00:00:00Z",
  },
];

const mockLeads: Lead[] = [];
const mockBookings: Booking[] = [];
const mockWorkItems: WorkItem[] = [];

describe("QuoteManager component", () => {
  const defaultProps = {
    user: mockUser,
    company: mockCompany,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getQuotes).mockResolvedValue(mockQuotes);
    vi.mocked(getLeads).mockResolvedValue(mockLeads);
    vi.mocked(getBookings).mockResolvedValue(mockBookings);
    vi.mocked(getWorkItems).mockResolvedValue(mockWorkItems);
    vi.mocked(saveQuote).mockResolvedValue(undefined as any);
    vi.mocked(saveBooking).mockResolvedValue(undefined as any);
    vi.mocked(saveWorkItem).mockResolvedValue(undefined as any);
  });

<<<<<<< Updated upstream
  // --- Data loading ---
=======
  // ── INITIAL RENDER & DATA LOADING ──
>>>>>>> Stashed changes

  it("calls data loading services on mount", async () => {
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(getQuotes).toHaveBeenCalled();
      expect(getLeads).toHaveBeenCalledWith("company-1");
      expect(getBookings).toHaveBeenCalledWith("company-1");
      expect(getWorkItems).toHaveBeenCalledWith("company-1");
    });
  });

<<<<<<< Updated upstream
=======
  it("renders the Intake & Quotes heading", async () => {
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Intake & Quotes")).toBeInTheDocument();
    });
  });

  it("renders the Lead Lifecycle subtitle", async () => {
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(
        screen.getByText("Lead Lifecycle & Revenue Conversion"),
      ).toBeInTheDocument();
    });
  });

>>>>>>> Stashed changes
  it("shows error state when data loading fails", async () => {
    vi.mocked(getQuotes).mockRejectedValue(new Error("Network error"));
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(
        screen.getByText(/Unable to load pipeline data/),
      ).toBeInTheDocument();
    });
  });

<<<<<<< Updated upstream
  // --- Header ---

  it("renders the Intake & Quotes heading", async () => {
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Intake & Quotes")).toBeInTheDocument();
=======
  it("shows retry button on error state", async () => {
    vi.mocked(getQuotes).mockRejectedValue(new Error("Network error"));
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Retry")).toBeInTheDocument();
    });
  });

  it("retries data loading when Retry is clicked", async () => {
    vi.mocked(getQuotes).mockRejectedValueOnce(new Error("Network error"));
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Retry")).toBeInTheDocument();
    });
    vi.mocked(getQuotes).mockResolvedValue(mockQuotes);
    await user.click(screen.getByText("Retry"));
    await waitFor(() => {
      expect(screen.getByText("Draft")).toBeInTheDocument();
    });
  });

  it("renders with null company without crashing", async () => {
    render(<QuoteManager user={mockUser} company={null} />);
    await waitFor(() => {
      expect(screen.getByText("Draft")).toBeInTheDocument();
    });
  });

  // ── PIPELINE VIEW ──

  it("renders pipeline view with all quote status columns", async () => {
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Draft")).toBeInTheDocument();
    });
    expect(screen.getByText("Sent")).toBeInTheDocument();
    expect(screen.getByText("Negotiating")).toBeInTheDocument();
    expect(screen.getByText("Accepted")).toBeInTheDocument();
    expect(screen.getByText("Declined")).toBeInTheDocument();
    expect(screen.getByText("Expired")).toBeInTheDocument();
  });

  it("displays quote counts per status column", async () => {
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      // Draft=1, Sent=1, Accepted=1 each show "(1)", others show "(0)"
      const countOnes = screen.getAllByText("(1)");
      expect(countOnes.length).toBe(3);
      const countZeros = screen.getAllByText("(0)");
      expect(countZeros.length).toBe(3);
>>>>>>> Stashed changes
    });
  });

  it("shows the search input with correct placeholder", async () => {
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("Find Quote or Lane..."),
      ).toBeInTheDocument();
    });
  });

  it("shows the New Quote button", async () => {
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/New Quote/)).toBeInTheDocument();
    });
  });

  it("shows Pipeline View and Intake Desk tab buttons", async () => {
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Pipeline View")).toBeInTheDocument();
      expect(screen.getByText("Intake Desk")).toBeInTheDocument();
    });
  });

  // --- Pipeline view ---

  it("renders pipeline view with all six status columns after load", async () => {
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Draft")).toBeInTheDocument();
      expect(screen.getByText("Sent")).toBeInTheDocument();
      expect(screen.getByText("Accepted")).toBeInTheDocument();
    });
    expect(screen.getByText("Negotiating")).toBeInTheDocument();
    expect(screen.getByText("Declined")).toBeInTheDocument();
    expect(screen.getByText("Expired")).toBeInTheDocument();
  });

  it("displays quote data with city and state info", async () => {
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
      expect(screen.getByText(/Dallas/)).toBeInTheDocument();
    });
  });

  it("displays total rate for each quote in pipeline", async () => {
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/2,200/)).toBeInTheDocument();
      expect(screen.getByText(/4,000/)).toBeInTheDocument();
    });
  });

<<<<<<< Updated upstream
  it("shows equipment type on quote cards", async () => {
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getAllByText("Dry Van").length).toBeGreaterThan(0);
=======
  it("displays equipment type for each quote", async () => {
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      const dryVanLabels = screen.getAllByText("Dry Van");
      expect(dryVanLabels.length).toBeGreaterThan(0);
>>>>>>> Stashed changes
    });
    expect(screen.getByText("Flatbed")).toBeInTheDocument();
  });

<<<<<<< Updated upstream
  it("shows status count for each pipeline column", async () => {
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      // Draft has 1 quote, Sent has 1, Accepted has 1 -- multiple "(1)" exist
      const countElements = screen.getAllByText("(1)");
      expect(countElements.length).toBeGreaterThanOrEqual(3);
    });
  });

  it("shows 'No quotes' placeholder for empty status columns", async () => {
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      const noQuotesElements = screen.getAllByText("No quotes");
      // Negotiating, Declined, Expired have no quotes
      expect(noQuotesElements.length).toBe(3);
    });
=======
  it("shows version number on quote cards", async () => {
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      const v1Elements = screen.getAllByText("v1");
      expect(v1Elements.length).toBeGreaterThan(0);
    });
    expect(screen.getByText("v2")).toBeInTheDocument();
>>>>>>> Stashed changes
  });

  it("renders empty pipeline when no quotes exist", async () => {
    vi.mocked(getQuotes).mockResolvedValue([]);
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.queryByText(/Unable to load/)).not.toBeInTheDocument();
      expect(screen.getByText("Draft")).toBeInTheDocument();
    });
<<<<<<< Updated upstream
    // All columns should show "No quotes"
=======
>>>>>>> Stashed changes
    const noQuotesElements = screen.getAllByText("No quotes");
    expect(noQuotesElements.length).toBe(6);
  });

<<<<<<< Updated upstream
  it("renders with null company without crashing", async () => {
    render(<QuoteManager user={mockUser} company={null} />);
    await waitFor(() => {
      expect(screen.getByText("Draft")).toBeInTheDocument();
=======
  it("shows the search input with correct placeholder", async () => {
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText(
        "Find Quote or Lane...",
      );
      expect(searchInput).toBeInTheDocument();
    });
  });

  it("shows the New Quote button", async () => {
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/New Quote/)).toBeInTheDocument();
    });
  });

  it("shows Pipeline View and Intake Desk tab buttons", async () => {
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Pipeline View")).toBeInTheDocument();
      expect(screen.getByText("Intake Desk")).toBeInTheDocument();
    });
  });

  // ── SEARCH / FILTER ──

  it("filters quotes by search query", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText("Find Quote or Lane...");
    await user.type(searchInput, "Houston");
    await waitFor(() => {
      expect(screen.getByText(/Houston/)).toBeInTheDocument();
    });
  });

  it("search is case-insensitive", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText("Find Quote or Lane...");
    await user.type(searchInput, "chicago");
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
  });

  it("shows empty columns when search matches no quotes", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText("Find Quote or Lane...");
    await user.type(searchInput, "ZZZZZZNOTFOUND");
    await waitFor(() => {
      expect(screen.queryByText(/Chicago/)).not.toBeInTheDocument();
    });
  });

  // ── QUOTE CREATION ──

  it("opens details view when clicking New Quote", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/New Quote/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/New Quote/));
    await waitFor(() => {
      expect(screen.getByText("Quote Review")).toBeInTheDocument();
    });
  });

  it("new quote starts with Draft status and shows transaction ID", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/New Quote/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/New Quote/));
    await waitFor(() => {
      expect(screen.getByText("Quote Review")).toBeInTheDocument();
    });
    expect(screen.getByText(/Transaction ID:/)).toBeInTheDocument();
  });

  // ── DETAILS VIEW ──

  it("opens details view when clicking a quote card", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText("Quote Review")).toBeInTheDocument();
    });
  });

  it("shows Origin and Destination sections in details view", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText("ORIGIN HUB")).toBeInTheDocument();
    });
    expect(screen.getByText("DESTINATION HUB")).toBeInTheDocument();
  });

  it("shows Operational Matrix section in details view", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText("Operational Matrix")).toBeInTheDocument();
    });
  });

  it("shows Financial Engineering section in details view", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText("Financial Engineering")).toBeInTheDocument();
    });
  });

  it("displays linehaul and fuel surcharge labels in details", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText("Linehaul & Revenue")).toBeInTheDocument();
    });
    expect(screen.getByText("BASE")).toBeInTheDocument();
    expect(screen.getByText("FUEL")).toBeInTheDocument();
  });

  it("displays cost structure in details view", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText("Cost Structure")).toBeInTheDocument();
    });
    expect(screen.getByText("Driver Pay (Est.)")).toBeInTheDocument();
    expect(screen.getByText("Sales Commission")).toBeInTheDocument();
    expect(screen.getByText("Fixed Overhead")).toBeInTheDocument();
  });

  it("shows Net Revenue and Projected Margin", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText("Net Revenue")).toBeInTheDocument();
    });
    expect(screen.getByText("Projected Margin")).toBeInTheDocument();
  });

  it("shows Save & Update button in details view", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText("Save & Update")).toBeInTheDocument();
    });
  });

  it("shows Strategic Assumptions section", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText("Strategic Assumptions")).toBeInTheDocument();
    });
    expect(screen.getByText("Valid Through")).toBeInTheDocument();
    expect(screen.getByText("Equipment Profile")).toBeInTheDocument();
  });

  it("shows Version History and Send Update buttons", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText(/Version History/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Send Update/)).toBeInTheDocument();
  });

  it("shows Interaction Log sidebar in details view", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText("Interaction Log")).toBeInTheDocument();
    });
    expect(screen.getByText("Incoming Call")).toBeInTheDocument();
    expect(screen.getByText("Email Sent")).toBeInTheDocument();
  });

  it("shows Active Triage section with no work items", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText("Active Triage")).toBeInTheDocument();
    });
    expect(screen.getByText("No Active Work Items")).toBeInTheDocument();
  });

  it("shows Schedule Callback button in details view", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText(/Schedule Callback/)).toBeInTheDocument();
    });
  });

  it("creates a work item when Schedule Callback is clicked", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText(/Schedule Callback/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Schedule Callback/));
    await waitFor(() => {
      expect(saveWorkItem).toHaveBeenCalled();
    });
  });

  // ── QUOTE EDITING ──

  it("can edit pickup city in details view", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText("ORIGIN HUB")).toBeInTheDocument();
    });
    const cityInputs = screen.getAllByPlaceholderText("City");
    expect(cityInputs.length).toBeGreaterThan(0);
    await user.clear(cityInputs[0]);
    await user.type(cityInputs[0], "Denver");
    expect(cityInputs[0]).toHaveValue("Denver");
  });

  it("can edit linehaul value", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText("Linehaul & Revenue")).toBeInTheDocument();
    });
    const linehaulInput = screen.getByPlaceholderText("Linehaul");
    expect(linehaulInput).toBeInTheDocument();
    await user.clear(linehaulInput);
    await user.type(linehaulInput, "3000");
    expect(linehaulInput).toHaveValue(3000);
  });

  it("can edit fuel surcharge value", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText("Linehaul & Revenue")).toBeInTheDocument();
    });
    const fscInput = screen.getByPlaceholderText("FSC");
    expect(fscInput).toBeInTheDocument();
    await user.clear(fscInput);
    await user.type(fscInput, "500");
    expect(fscInput).toHaveValue(500);
  });

  it("can edit notes field in details view", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText("Strategic Assumptions")).toBeInTheDocument();
    });
    const notesInput = screen.getByPlaceholderText(
      /equipment age requirements/,
    );
    expect(notesInput).toBeInTheDocument();
    await user.type(notesInput, "Team drivers required");
    expect(notesInput).toHaveValue("Team drivers required");
  });

  // ── SAVE QUOTE ──

  it("saves quote when Save & Update is clicked", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText("Save & Update")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Save & Update"));
    await waitFor(() => {
      expect(saveQuote).toHaveBeenCalled();
    });
  });

  it("returns to pipeline after saving", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText("Save & Update")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Save & Update"));
    await waitFor(() => {
      expect(screen.getByText("Draft")).toBeInTheDocument();
    });
  });

  // ── STATUS TRANSITIONS / BOOKING CONVERSION ──

  it("shows Accept & Convert button for Accepted quotes", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Atlanta/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Atlanta, GA/));
    await waitFor(() => {
      expect(screen.getByText("Quote Review")).toBeInTheDocument();
    });
    expect(screen.getByText(/Accept & Convert/)).toBeInTheDocument();
  });

  it("does not show Accept & Convert for Draft quotes", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText("Quote Review")).toBeInTheDocument();
    });
    expect(screen.queryByText(/Accept & Convert/)).not.toBeInTheDocument();
  });

  it("converts accepted quote to booking", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Atlanta/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Atlanta, GA/));
    await waitFor(() => {
      expect(screen.getByText(/Accept & Convert/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Accept & Convert/));
    await waitFor(() => {
      expect(saveBooking).toHaveBeenCalled();
    });
  });

  it("shows success toast after booking conversion", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Atlanta/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Atlanta, GA/));
    await waitFor(() => {
      expect(screen.getByText(/Accept & Convert/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Accept & Convert/));
    await waitFor(() => {
      expect(
        screen.getByText(/Quote Converted to Booking/),
      ).toBeInTheDocument();
    });
  });

  // ── NAVIGATION ──

  it("can return to pipeline from details view via Pipeline View tab", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Draft")).toBeInTheDocument();
    });
    await user.click(screen.getByText(/New Quote/));
    await waitFor(() => {
      expect(screen.getByText("Quote Review")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Pipeline View"));
    await waitFor(() => {
      expect(screen.getByText("Draft")).toBeInTheDocument();
    });
  });

  it("can return to pipeline from details view via back arrow", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText("Quote Review")).toBeInTheDocument();
    });
    const backButtons = screen
      .getAllByRole("button")
      .filter(
        (btn) => btn.querySelector("svg") && btn.className.includes("p-3"),
      );
    expect(backButtons.length).toBeGreaterThan(0);
    await user.click(backButtons[0]);
    await waitFor(() => {
      expect(screen.getByText("Draft")).toBeInTheDocument();
    });
  });

  // ── INTAKE DESK VIEW ──

  it("switches to Intake Desk view", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Intake Desk")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Intake Desk"));
    await waitFor(() => {
      expect(screen.getByText("New Opportunity Intake")).toBeInTheDocument();
    });
  });

  it("shows Identity & Source section in intake", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Intake Desk")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Intake Desk"));
    await waitFor(() => {
      expect(screen.getByText("Identity & Source")).toBeInTheDocument();
    });
    expect(screen.getByText("Inquiry Channel")).toBeInTheDocument();
    expect(screen.getByText(/Company \/ Entity Name/)).toBeInTheDocument();
    expect(screen.getByText("Contact Intelligence")).toBeInTheDocument();
  });

  it("shows Origin and Destination Matrix in intake", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Intake Desk")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Intake Desk"));
    await waitFor(() => {
      expect(screen.getByText("Origin Matrix")).toBeInTheDocument();
    });
    expect(screen.getByText("Destination Matrix")).toBeInTheDocument();
  });

  it("shows Equipment Configuration in intake", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Intake Desk")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Intake Desk"));
    await waitFor(() => {
      expect(screen.getByText("Equipment Configuration")).toBeInTheDocument();
    });
  });

  it("shows Discard Entry and Initialize buttons in intake", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Intake Desk")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Intake Desk"));
    await waitFor(() => {
      expect(screen.getByText("Discard Entry")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Initialize & Engineering Reveal/),
    ).toBeInTheDocument();
  });

  it("can fill intake form fields", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Intake Desk")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Intake Desk"));
    await waitFor(() => {
      expect(screen.getByText("Origin Matrix")).toBeInTheDocument();
    });
    const cityHubInputs = screen.getAllByPlaceholderText("CHICAGO");
    expect(cityHubInputs.length).toBeGreaterThan(0);
    await user.type(cityHubInputs[0], "Memphis");
    expect(cityHubInputs[0]).toHaveValue("Memphis");
  });

  it("discards entry and returns to pipeline", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Intake Desk")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Intake Desk"));
    await waitFor(() => {
      expect(screen.getByText("Discard Entry")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Discard Entry"));
    await waitFor(() => {
      expect(screen.getByText("Draft")).toBeInTheDocument();
    });
  });

  it("submits intake form and calls saveQuote", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Intake Desk")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Intake Desk"));
    await waitFor(() => {
      expect(
        screen.getByText(/Initialize & Engineering Reveal/),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Initialize & Engineering Reveal/));
    await waitFor(() => {
      expect(saveQuote).toHaveBeenCalled();
    });
  });

  it("can fill dropoff city and state in intake form", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Intake Desk")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Intake Desk"));
    await waitFor(() => {
      expect(screen.getByText("Destination Matrix")).toBeInTheDocument();
    });
    const dallasInputs = screen.getAllByPlaceholderText("DALLAS");
    expect(dallasInputs.length).toBeGreaterThan(0);
    await user.type(dallasInputs[0], "Houston");
    expect(dallasInputs[0]).toHaveValue("Houston");
    const txInputs = screen.getAllByPlaceholderText("TX");
    expect(txInputs.length).toBeGreaterThan(0);
    await user.type(txInputs[0], "TX");
    expect(txInputs[0]).toHaveValue("TX");
  });

  it("can fill pickup state in intake form", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Intake Desk")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Intake Desk"));
    await waitFor(() => {
      expect(screen.getByText("Origin Matrix")).toBeInTheDocument();
    });
    const ilInputs = screen.getAllByPlaceholderText("IL");
    expect(ilInputs.length).toBeGreaterThan(0);
    await user.type(ilInputs[0], "TN");
    expect(ilInputs[0]).toHaveValue("TN");
  });

  it("can change equipment configuration in intake form", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Intake Desk")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Intake Desk"));
    await waitFor(() => {
      expect(screen.getByText("Equipment Configuration")).toBeInTheDocument();
    });
    // The equipment select has option text like "53' DRY VAN (Standard)" with value "Dry Van"
    // Verify the select options exist
    expect(screen.getByText("53' DRY VAN (Standard)")).toBeInTheDocument();
    expect(
      screen.getByText("TEMPERATURE CONTROLLED (Reefer)"),
    ).toBeInTheDocument();
    expect(screen.getByText("OPEN DECK / FLATBED")).toBeInTheDocument();
    expect(screen.getByText("INTERMODAL / CONTAINER")).toBeInTheDocument();
  });

  it("can fill mission notes in intake form", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Intake Desk")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Intake Desk"));
    await waitFor(() => {
      expect(
        screen.getByText(/Mission Notes/),
      ).toBeInTheDocument();
    });
    const notesInput = screen.getByPlaceholderText(
      /Specify high-value cargo/,
    );
    expect(notesInput).toBeInTheDocument();
    await user.type(notesInput, "High value cargo");
    expect(notesInput).toHaveValue("High value cargo");
  });

  it("shows inquiry channel select in intake form", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Intake Desk")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Intake Desk"));
    await waitFor(() => {
      expect(screen.getByText("Inquiry Channel")).toBeInTheDocument();
    });
    // Verify the select options exist
    expect(screen.getByText("Phone Interaction")).toBeInTheDocument();
  });

  it("shows the version info in intake header", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Intake Desk")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Intake Desk"));
    await waitFor(() => {
      expect(
        screen.getByText(/High-Density Command Lead Entry/),
      ).toBeInTheDocument();
    });
  });

  // ── RATE/PRICE CALCULATIONS ──

  it("shows gross revenue calculation in details", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText(/Gross: \$2,200/)).toBeInTheDocument();
    });
  });

  it("shows discount input in details view", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText("Discount")).toBeInTheDocument();
    });
  });

  // ── COMMS SIDEBAR ──

  it("shows call log and note-taking area in comms sidebar", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText("Interaction Log")).toBeInTheDocument();
    });
    expect(
      screen.getByPlaceholderText("Quick note for call log..."),
    ).toBeInTheDocument();
    expect(screen.getByText("Log Contact")).toBeInTheDocument();
  });

  it("shows interaction history entries in comms sidebar", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(
        screen.getByText("Negotiated higher linehaul for special handling."),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText("Quote Version 1 dispatched to client."),
    ).toBeInTheDocument();
  });

  // ── WORK ITEMS ──

  it("displays existing work items linked to the selected quote", async () => {
    vi.mocked(getWorkItems).mockResolvedValue([
      {
        id: "wi-1",
        companyId: "company-1",
        type: "QUOTE_FOLLOWUP",
        priority: "High",
        label: "Follow up on pricing",
        description: "Customer wants updated rates",
        entityId: "q-1",
        entityType: "Quote",
        status: "Open",
        createdAt: "2026-03-10T00:00:00Z",
        dueDate: "2026-03-17T00:00:00Z",
      },
    ] as WorkItem[]);
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText("Follow up on pricing")).toBeInTheDocument();
    });
    expect(
      screen.getByText("Customer wants updated rates"),
    ).toBeInTheDocument();
  });

  it("Log Contact button calls window.open with tel: URI", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText("Log Contact")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Log Contact"));
    expect(openSpy).toHaveBeenCalledWith("tel:5551234567");
    openSpy.mockRestore();
  });

  it("shows the MoreHorizontal options button in comms sidebar", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText("Interaction Log")).toBeInTheDocument();
    });
    // The MoreHorizontal button exists in sidebar
    const noteArea = screen.getByPlaceholderText("Quick note for call log...");
    expect(noteArea).toBeInTheDocument();
  });

  it("can enter text in the quick note field in comms sidebar", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText("Interaction Log")).toBeInTheDocument();
    });
    const noteArea = screen.getByPlaceholderText("Quick note for call log...");
    await user.type(noteArea, "Called customer re: pricing");
    expect(noteArea).toHaveValue("Called customer re: pricing");
  });

  it("can edit discount value in details view", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText("Discount")).toBeInTheDocument();
    });
    const discountInput = screen.getByPlaceholderText(
      /Disconnect \/ Adjustment/,
    );
    expect(discountInput).toBeInTheDocument();
    await user.type(discountInput, "100");
    expect(discountInput).toHaveValue(100);
  });

  it("can edit driver pay value in details view", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText("Driver Pay (Est.)")).toBeInTheDocument();
    });
    // Driver pay and commission are in the cost structure area
    const costInputs = screen
      .getByText("Driver Pay (Est.)")
      .closest("div")!
      .querySelector("input");
    expect(costInputs).toBeInTheDocument();
  });

  it("can edit sales commission value in details view", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText("Sales Commission")).toBeInTheDocument();
    });
    const commissionRow = screen
      .getByText("Sales Commission")
      .closest("div")!;
    const commInput = commissionRow.querySelector("input");
    expect(commInput).toBeInTheDocument();
  });

  it("shows fixed overhead amount in details view", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText("Fixed Overhead")).toBeInTheDocument();
    });
    // Fixed overhead shows $50 from companyCostFactor default
    expect(screen.getByText("$50")).toBeInTheDocument();
  });

  it("shows margin percentage in details view", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText("Projected Margin")).toBeInTheDocument();
    });
    // Margin percentage is shown in parentheses e.g. "(x.x%)"
    expect(screen.getByText(/%\)/)).toBeInTheDocument();
  });

  it("can edit dropoff city in details view", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText("DESTINATION HUB")).toBeInTheDocument();
    });
    const cityInputs = screen.getAllByPlaceholderText("City");
    // Second city input is dropoff
    expect(cityInputs.length).toBeGreaterThanOrEqual(2);
    await user.clear(cityInputs[1]);
    await user.type(cityInputs[1], "Denver");
    expect(cityInputs[1]).toHaveValue("Denver");
  });

  it("can edit pickup and dropoff state in details view", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText("ORIGIN HUB")).toBeInTheDocument();
    });
    const stateInputs = screen.getAllByPlaceholderText("State");
    expect(stateInputs.length).toBeGreaterThanOrEqual(2);
    await user.clear(stateInputs[0]);
    await user.type(stateInputs[0], "CO");
    expect(stateInputs[0]).toHaveValue("CO");
  });

  it("can edit facility name in details view", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText("ORIGIN HUB")).toBeInTheDocument();
    });
    const facilityInput = screen.getByPlaceholderText("Location Alpha");
    expect(facilityInput).toBeInTheDocument();
    await user.type(facilityInput, "Main Warehouse");
    expect(facilityInput).toHaveValue("Main Warehouse");
  });

  it("shows equipment profile selector in details", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/));
    await waitFor(() => {
      expect(screen.getByText("Equipment Profile")).toBeInTheDocument();
    });
    // Details view has equipment options
    expect(screen.getByText("Dry Van Service")).toBeInTheDocument();
  });

  // ── EDGE CASES ──

  it("handles quote with margin field displayed in pipeline", async () => {
    vi.mocked(getQuotes).mockResolvedValue([
      {
        ...mockQuotes[0],
        margin: 500,
      },
    ]);
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Margin: \$500/)).toBeInTheDocument();
>>>>>>> Stashed changes
    });
  });

  // --- Search / filter ---

  it("filters quotes by search query", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText("Find Quote or Lane...");
    await user.type(searchInput, "Houston");
    await waitFor(() => {
      expect(screen.getByText(/Houston/)).toBeInTheDocument();
    });
  });

  it("hides non-matching quotes when search is applied", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText("Find Quote or Lane...");
    await user.type(searchInput, "Houston");
    // Chicago quote should no longer be visible in its column
    await waitFor(() => {
      expect(screen.queryByText(/Chicago, IL/)).not.toBeInTheDocument();
    });
  });

  // --- Quote creation ---

  it("opens details view when clicking New Quote", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/New Quote/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/New Quote/));
    await waitFor(() => {
      expect(screen.getByText("Quote Review")).toBeInTheDocument();
    });
  });

  it("shows Operational Matrix section in details view", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/New Quote/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/New Quote/));
    await waitFor(() => {
      expect(screen.getByText("Operational Matrix")).toBeInTheDocument();
    });
    expect(screen.getByText("ORIGIN HUB")).toBeInTheDocument();
    expect(screen.getByText("DESTINATION HUB")).toBeInTheDocument();
  });

  it("shows Financial Engineering section in details view", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/New Quote/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/New Quote/));
    await waitFor(() => {
      expect(screen.getByText("Financial Engineering")).toBeInTheDocument();
    });
    expect(screen.getByText(/Linehaul & Revenue/)).toBeInTheDocument();
    expect(screen.getByText("Net Revenue")).toBeInTheDocument();
    expect(screen.getByText("Projected Margin")).toBeInTheDocument();
  });

  it("shows Strategic Assumptions section in details view", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/New Quote/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/New Quote/));
    await waitFor(() => {
      expect(screen.getByText("Strategic Assumptions")).toBeInTheDocument();
    });
    expect(screen.getByText("Valid Through")).toBeInTheDocument();
    expect(screen.getByText("Equipment Profile")).toBeInTheDocument();
  });

  it("shows Save & Update button in details view", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/New Quote/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/New Quote/));
    await waitFor(() => {
      expect(screen.getByText("Save & Update")).toBeInTheDocument();
    });
  });

  it("calls saveQuote when Save & Update is clicked", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/New Quote/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/New Quote/));
    await waitFor(() => {
      expect(screen.getByText("Save & Update")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Save & Update"));
    await waitFor(() => {
      expect(saveQuote).toHaveBeenCalled();
    });
  });

  it("shows Interaction Log sidebar in details view", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/New Quote/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/New Quote/));
    await waitFor(() => {
      expect(screen.getByText("Interaction Log")).toBeInTheDocument();
    });
  });

  it("shows Active Triage section with no work items", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/New Quote/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/New Quote/));
    await waitFor(() => {
      expect(screen.getByText("Active Triage")).toBeInTheDocument();
    });
    expect(screen.getByText("No Active Work Items")).toBeInTheDocument();
  });

  it("shows Schedule Callback button in Active Triage", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/New Quote/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/New Quote/));
    await waitFor(() => {
      expect(screen.getByText(/Schedule Callback/)).toBeInTheDocument();
    });
  });

  it("calls saveWorkItem when Schedule Callback is clicked", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/New Quote/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/New Quote/));
    await waitFor(() => {
      expect(screen.getByText(/Schedule Callback/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Schedule Callback/));
    await waitFor(() => {
      expect(saveWorkItem).toHaveBeenCalled();
    });
  });

  // --- Navigation between views ---

  it("can return to pipeline from details view", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Draft")).toBeInTheDocument();
    });
    await user.click(screen.getByText(/New Quote/));
    await waitFor(() => {
      expect(screen.getByText("Quote Review")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Pipeline View"));
    await waitFor(() => {
      expect(screen.getByText("Draft")).toBeInTheDocument();
    });
  });

  // --- Status transitions: quote detail click ---

  it("opens details view when a quote card in pipeline is clicked", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    // Click the Chicago -> Dallas quote card
    await user.click(screen.getByText(/Chicago, IL/).closest("[class*='cursor-pointer']")!);
    await waitFor(() => {
      expect(screen.getByText("Quote Review")).toBeInTheDocument();
    });
  });

  // --- Accept & Convert (booking conversion) ---

  it("shows Accept & Convert button for Accepted quotes", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Atlanta/)).toBeInTheDocument();
    });
    // Click the Accepted quote (Atlanta -> Miami)
    await user.click(screen.getByText(/Atlanta, GA/).closest("[class*='cursor-pointer']")!);
    await waitFor(() => {
      expect(screen.getByText("Quote Review")).toBeInTheDocument();
    });
    expect(screen.getByText(/Accept & Convert/)).toBeInTheDocument();
  });

  it("calls saveBooking when Accept & Convert is clicked", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Atlanta/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Atlanta, GA/).closest("[class*='cursor-pointer']")!);
    await waitFor(() => {
      expect(screen.getByText(/Accept & Convert/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Accept & Convert/));
    await waitFor(() => {
      expect(saveBooking).toHaveBeenCalled();
    });
  });

  it("does not show Accept & Convert for Draft quotes", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Chicago, IL/).closest("[class*='cursor-pointer']")!);
    await waitFor(() => {
      expect(screen.getByText("Quote Review")).toBeInTheDocument();
    });
    expect(screen.queryByText(/Accept & Convert/)).not.toBeInTheDocument();
  });

  // --- Intake Desk view ---

  it("switches to Intake Desk view when Intake Desk tab is clicked", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Intake Desk")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Intake Desk"));
    await waitFor(() => {
      expect(screen.getByText("New Opportunity Intake")).toBeInTheDocument();
    });
  });

  it("shows Identity & Source section on Intake Desk", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Intake Desk")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Intake Desk"));
    await waitFor(() => {
      expect(screen.getByText(/Identity & Source/)).toBeInTheDocument();
    });
    expect(screen.getByText("Inquiry Channel")).toBeInTheDocument();
  });

  it("shows Origin Matrix and Destination Matrix on Intake Desk", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Intake Desk")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Intake Desk"));
    await waitFor(() => {
      expect(screen.getByText("Origin Matrix")).toBeInTheDocument();
    });
    expect(screen.getByText("Destination Matrix")).toBeInTheDocument();
  });

  it("shows Equipment Configuration on Intake Desk", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Intake Desk")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Intake Desk"));
    await waitFor(() => {
      expect(screen.getByText("Equipment Configuration")).toBeInTheDocument();
    });
  });

  it("shows Discard Entry and Initialize buttons on Intake Desk", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Intake Desk")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Intake Desk"));
    await waitFor(() => {
      expect(screen.getByText("Discard Entry")).toBeInTheDocument();
    });
    expect(screen.getByText(/Initialize & Engineering Reveal/)).toBeInTheDocument();
  });

  it("returns to pipeline when Discard Entry is clicked", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Intake Desk")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Intake Desk"));
    await waitFor(() => {
      expect(screen.getByText("Discard Entry")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Discard Entry"));
    await waitFor(() => {
      expect(screen.getByText("Draft")).toBeInTheDocument();
    });
  });

  it("saves and navigates to details when Initialize is clicked on Intake", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Intake Desk")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Intake Desk"));
    await waitFor(() => {
      expect(screen.getByText(/Initialize & Engineering Reveal/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Initialize & Engineering Reveal/));
    await waitFor(() => {
      expect(saveQuote).toHaveBeenCalled();
    });
  });

  // --- Rate calculation: linehaul input ---

  it("updates rate calculation when linehaul is changed in details", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/New Quote/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/New Quote/));
    await waitFor(() => {
      expect(screen.getByText("Financial Engineering")).toBeInTheDocument();
    });
    // Find the linehaul input (placeholder "Linehaul")
    const linehaulInput = screen.getByPlaceholderText("Linehaul");
    await user.clear(linehaulInput);
    await user.type(linehaulInput, "3000");
    // The rate calculation should reflect a total
    await waitFor(() => {
      expect(screen.getByText("Net Revenue")).toBeInTheDocument();
    });
  });

  // --- Version history button ---

  it("shows Version History button in details view", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/New Quote/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/New Quote/));
    await waitFor(() => {
      expect(screen.getByText("Version History")).toBeInTheDocument();
    });
  });

  it("shows Send Update button in details view", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/New Quote/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/New Quote/));
    await waitFor(() => {
      expect(screen.getByText("Send Update")).toBeInTheDocument();
    });
  });

  // --- Cost structure in details ---

  it("shows Cost Structure labels in details view", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/New Quote/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/New Quote/));
    await waitFor(() => {
      expect(screen.getByText("Cost Structure")).toBeInTheDocument();
    });
    expect(screen.getByText("Driver Pay (Est.)")).toBeInTheDocument();
    expect(screen.getByText("Sales Commission")).toBeInTheDocument();
    expect(screen.getByText("Fixed Overhead")).toBeInTheDocument();
  });
});
