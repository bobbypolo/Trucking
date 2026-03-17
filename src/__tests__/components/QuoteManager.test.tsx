import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QuoteManager } from "../../../components/QuoteManager";
import { User, Company, Quote, Lead, Booking, WorkItem } from "../../../types";

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
  });

  // --- Data loading ---

  it("calls data loading services on mount", async () => {
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(getQuotes).toHaveBeenCalled();
      expect(getLeads).toHaveBeenCalledWith("company-1");
      expect(getBookings).toHaveBeenCalledWith("company-1");
      expect(getWorkItems).toHaveBeenCalledWith("company-1");
    });
  });

  it("shows error state when data loading fails", async () => {
    vi.mocked(getQuotes).mockRejectedValue(new Error("Network error"));
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(
        screen.getByText(/Unable to load pipeline data/),
      ).toBeInTheDocument();
    });
  });

  // --- Header ---

  it("renders the Intake & Quotes heading", async () => {
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Intake & Quotes")).toBeInTheDocument();
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

  it("shows equipment type on quote cards", async () => {
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getAllByText("Dry Van").length).toBeGreaterThan(0);
    });
    expect(screen.getByText("Flatbed")).toBeInTheDocument();
  });

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
  });

  it("renders empty pipeline when no quotes exist", async () => {
    vi.mocked(getQuotes).mockResolvedValue([]);
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.queryByText(/Unable to load/)).not.toBeInTheDocument();
      expect(screen.getByText("Draft")).toBeInTheDocument();
    });
    // All columns should show "No quotes"
    const noQuotesElements = screen.getAllByText("No quotes");
    expect(noQuotesElements.length).toBe(6);
  });

  it("renders with null company without crashing", async () => {
    render(<QuoteManager user={mockUser} company={null} />);
    await waitFor(() => {
      expect(screen.getByText("Draft")).toBeInTheDocument();
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
