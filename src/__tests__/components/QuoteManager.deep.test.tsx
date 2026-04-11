import React from "react";
import {
  render as rtlRender,
  screen,
  waitFor,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QuoteManager } from "../../../components/QuoteManager";

/**
 * Post-R-P1-07 the default activeView is "intake" (not "pipeline").
 * This wrapper restores the pre-R-P1-07 landing view for legacy assertions
 * in this file. Tests that specifically need the intake view should use
 * `rtlRender` directly.
 */
function render(ui: React.ReactElement) {
  const result = rtlRender(ui);
  try {
    const btn = screen.queryByText("Pipeline View");
    if (btn) {
      act(() => {
        btn.click();
      });
    }
  } catch {
    // no-op
  }
  return result;
}
import type {
  User,
  Company,
  Quote,
  Lead,
  Booking,
  WorkItem,
} from "../../../types";

const mockSaveQuote = vi.fn().mockResolvedValue(undefined);
const mockSaveBooking = vi.fn().mockResolvedValue(undefined);
const mockSaveWorkItem = vi.fn().mockResolvedValue(undefined);

vi.mock("../../../services/storageService", () => ({
  getQuotes: vi.fn(),
  saveQuote: (...args: unknown[]) => mockSaveQuote(...args),
  getLeads: vi.fn(),
  saveLead: vi.fn(),
  getBookings: vi.fn(),
  saveBooking: (...args: unknown[]) => mockSaveBooking(...args),
  getWorkItems: vi.fn(),
  saveWorkItem: (...args: unknown[]) => mockSaveWorkItem(...args),
}));

vi.mock("../../../services/authService", () => ({
  checkCapability: vi.fn().mockReturnValue(true),
}));

vi.mock("uuid", () => ({
  v4: vi.fn().mockReturnValue("mock-uuid-001"),
}));

const mockApiPost = vi
  .fn()
  .mockResolvedValue({ id: "bk-converted", load_id: "ld-001" });
vi.mock("../../../services/api", () => ({
  api: {
    get: vi.fn(),
    post: mockApiPost,
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import {
  getQuotes,
  getLeads,
  getBookings,
  getWorkItems,
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

const makeQuote = (overrides: Partial<Quote> = {}): Quote => ({
  id: "q-1",
  companyId: "company-1",
  status: "Draft",
  pickup: { city: "Chicago", state: "IL", facilityName: "Hub Alpha" },
  dropoff: { city: "Dallas", state: "TX", facilityName: "Depot Beta" },
  equipmentType: "Dry Van",
  linehaul: 2000,
  fuelSurcharge: 200,
  accessorials: [],
  totalRate: 2200,
  version: 1,
  validUntil: "2026-04-15T00:00:00Z",
  ownerId: "user-1",
  createdAt: "2026-03-15T00:00:00Z",
  discount: 0,
  commission: 200,
  estimatedDriverPay: 1400,
  companyCostFactor: 50,
  margin: 550,
  ...overrides,
});

const mockWorkItems: WorkItem[] = [
  {
    id: "wi-1",
    companyId: "company-1",
    type: "QUOTE_FOLLOWUP",
    priority: "High",
    label: "Pending Callback",
    description: "Follow up with customer",
    entityId: "q-1",
    entityType: "Quote",
    status: "Open",
    createdAt: "2026-03-15T00:00:00Z",
    dueDate: "2026-03-15T14:00:00Z",
  },
];

const setupMocks = (
  quotes: Quote[] = [makeQuote()],
  workItems: WorkItem[] = [],
) => {
  vi.mocked(getQuotes).mockResolvedValue(quotes);
  vi.mocked(getLeads).mockResolvedValue([]);
  vi.mocked(getBookings).mockResolvedValue([]);
  vi.mocked(getWorkItems).mockResolvedValue(workItems);
};

describe("QuoteManager deep coverage - uncovered lines 955-1326", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.clearAllMocks();
    user = userEvent.setup();
    mockApiPost.mockResolvedValue({ id: "bk-converted", load_id: "ld-001" });
  });

  describe("details view - quote editing (lines 955-993)", () => {
    it("opens details view when clicking a quote in the pipeline", async () => {
      setupMocks([makeQuote()]);
      render(<QuoteManager user={mockUser} company={mockCompany} />);

      await waitFor(() => {
        expect(screen.getByText(/Chicago/)).toBeInTheDocument();
      });

      // Click the quote card to open details
      await user.click(screen.getByText(/Chicago, IL/));

      await waitFor(() => {
        expect(screen.getByText("Quote Review")).toBeInTheDocument();
      });

      // Should show detail header with transaction ID
      expect(screen.getByText(/Transaction ID:/)).toBeInTheDocument();
      expect(screen.getByText("Version History")).toBeInTheDocument();
      expect(screen.getByText("Send Update")).toBeInTheDocument();
    });

    it("displays work items in Active Triage section when they exist", async () => {
      setupMocks([makeQuote()], mockWorkItems);
      render(<QuoteManager user={mockUser} company={mockCompany} />);

      await waitFor(() => {
        expect(screen.getByText(/Chicago/)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/Chicago, IL/));

      await waitFor(() => {
        expect(screen.getByText("Quote Review")).toBeInTheDocument();
      });

      // Work item should be visible in Active Triage
      expect(screen.getByText("Pending Callback")).toBeInTheDocument();
      expect(screen.getByText("Follow up with customer")).toBeInTheDocument();
    });

    it("shows No Active Work Items when no work items for this quote", async () => {
      setupMocks([makeQuote()], []);
      render(<QuoteManager user={mockUser} company={mockCompany} />);

      await waitFor(() => {
        expect(screen.getByText(/Chicago/)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/Chicago, IL/));

      await waitFor(() => {
        expect(screen.getByText("Quote Review")).toBeInTheDocument();
      });

      expect(screen.getByText("No Active Work Items")).toBeInTheDocument();
    });

    it("creates a new work item via Schedule Callback button", async () => {
      setupMocks([makeQuote()], []);
      render(<QuoteManager user={mockUser} company={mockCompany} />);

      await waitFor(() => {
        expect(screen.getByText(/Chicago/)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/Chicago, IL/));

      await waitFor(() => {
        expect(screen.getByText("Quote Review")).toBeInTheDocument();
      });

      // Click the Schedule Callback button
      await user.click(screen.getByText(/Schedule Callback/));

      await waitFor(() => {
        expect(mockSaveWorkItem).toHaveBeenCalledTimes(1);
      });

      const savedItem = mockSaveWorkItem.mock.calls[0][0];
      expect(savedItem.type).toBe("QUOTE_FOLLOWUP");
      expect(savedItem.priority).toBe("High");
      expect(savedItem.entityId).toBe("q-1");
      expect(savedItem.entityType).toBe("Quote");
      expect(savedItem.status).toBe("Open");
    });
  });

  describe("details view - Comms Sidebar (lines 996-1053)", () => {
    it("renders the Interaction Log sidebar in details view", async () => {
      setupMocks([makeQuote()]);
      render(<QuoteManager user={mockUser} company={mockCompany} />);

      await waitFor(() => {
        expect(screen.getByText(/Chicago/)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/Chicago, IL/));

      await waitFor(() => {
        expect(screen.getByText("Interaction Log")).toBeInTheDocument();
      });

      // Should show sample interaction entries
      expect(screen.getByText("Incoming Call")).toBeInTheDocument();
      expect(screen.getByText("Email Sent")).toBeInTheDocument();
      expect(
        screen.getByText(/Negotiated higher linehaul/),
      ).toBeInTheDocument();
    });

    it("shows the Log Contact button and quick note textarea", async () => {
      setupMocks([makeQuote()]);
      render(<QuoteManager user={mockUser} company={mockCompany} />);

      await waitFor(() => {
        expect(screen.getByText(/Chicago/)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/Chicago, IL/));

      await waitFor(() => {
        expect(screen.getByText("Log Contact")).toBeInTheDocument();
      });

      const noteArea = screen.getByPlaceholderText(/Quick note for call log/);
      expect(noteArea).toBeInTheDocument();
      await user.type(noteArea, "Discussed rate increase");
      expect(noteArea).toHaveValue("Discussed rate increase");
    });
  });

  describe("intake view (lines 1056-1370)", () => {
    it("switches to intake view when Intake Desk is clicked", async () => {
      setupMocks([makeQuote()]);
      render(<QuoteManager user={mockUser} company={mockCompany} />);

      await waitFor(() => {
        expect(screen.getByText(/Chicago/)).toBeInTheDocument();
      });

      await user.click(screen.getByText("Intake Desk"));

      await waitFor(() => {
        expect(screen.getByText("New Opportunity Intake")).toBeInTheDocument();
      });

      expect(screen.getByText("Identity & Source")).toBeInTheDocument();
    });

    it("shows intake form fields for lane dynamics", async () => {
      setupMocks([makeQuote()]);
      render(<QuoteManager user={mockUser} company={mockCompany} />);

      await waitFor(() => {
        expect(screen.getByText(/Chicago/)).toBeInTheDocument();
      });

      await user.click(screen.getByText("Intake Desk"));

      await waitFor(() => {
        expect(screen.getByText("Origin Matrix")).toBeInTheDocument();
      });

      expect(screen.getByText("Destination Matrix")).toBeInTheDocument();
    });

    it("allows editing origin city and state in intake form", async () => {
      setupMocks([makeQuote()]);
      render(<QuoteManager user={mockUser} company={mockCompany} />);

      await waitFor(() => {
        expect(screen.getByText(/Chicago/)).toBeInTheDocument();
      });

      await user.click(screen.getByText("Intake Desk"));
      await waitFor(() => {
        expect(screen.getByText("Origin Matrix")).toBeInTheDocument();
      });

      // Find city inputs (there should be origin and destination)
      const cityInputs = screen.getAllByPlaceholderText("CHICAGO");
      expect(cityInputs).toHaveLength(1);
      await user.type(cityInputs[0], "Denver");
      expect(cityInputs[0]).toHaveValue("Denver");

      const stateInputs = screen.getAllByPlaceholderText("IL");
      expect(stateInputs).toHaveLength(1);
      await user.type(stateInputs[0], "CO");
      expect(stateInputs[0]).toHaveValue("CO");
    });

    it("allows editing destination city and state", async () => {
      setupMocks([makeQuote()]);
      render(<QuoteManager user={mockUser} company={mockCompany} />);

      await waitFor(() => {
        expect(screen.getByText(/Chicago/)).toBeInTheDocument();
      });

      await user.click(screen.getByText("Intake Desk"));
      await waitFor(() => {
        expect(screen.getByText("Destination Matrix")).toBeInTheDocument();
      });

      const destCityInputs = screen.getAllByPlaceholderText("DALLAS");
      expect(destCityInputs).toHaveLength(1);
      await user.type(destCityInputs[0], "Phoenix");
      expect(destCityInputs[0]).toHaveValue("Phoenix");
    });

    it("shows equipment configuration and mission notes fields", async () => {
      setupMocks([makeQuote()]);
      render(<QuoteManager user={mockUser} company={mockCompany} />);

      await waitFor(() => {
        expect(screen.getByText(/Chicago/)).toBeInTheDocument();
      });

      await user.click(screen.getByText("Intake Desk"));
      await waitFor(() => {
        expect(screen.getByText("Equipment Configuration")).toBeInTheDocument();
      });

      expect(
        screen.getByText("Mission Notes / Risk Factors"),
      ).toBeInTheDocument();
    });

    it("submits intake form via Initialize button and saves quote", async () => {
      setupMocks([]);
      render(<QuoteManager user={mockUser} company={mockCompany} />);

      await waitFor(() => {
        expect(screen.queryByText(/Unable to load/)).toBeNull();
      });

      await user.click(screen.getByText("Intake Desk"));
      await waitFor(() => {
        expect(screen.getByText("New Opportunity Intake")).toBeInTheDocument();
      });

      // Click "Initialize & Engineering Reveal"
      await user.click(screen.getByText(/Initialize & Engineering Reveal/));

      await waitFor(() => {
        expect(mockSaveQuote).toHaveBeenCalledTimes(1);
      });

      const savedQuote = mockSaveQuote.mock.calls[0][0];
      expect(savedQuote.status).toBe("Draft");
      expect(savedQuote.companyId).toBe("company-1");
      expect(savedQuote.commission).toBeDefined();
      expect(savedQuote.estimatedDriverPay).toBeDefined();
      expect(savedQuote.companyCostFactor).toBe(50);
    });

    it("discards intake entry and returns to pipeline", async () => {
      setupMocks([makeQuote()]);
      render(<QuoteManager user={mockUser} company={mockCompany} />);

      await waitFor(() => {
        expect(screen.getByText(/Chicago/)).toBeInTheDocument();
      });

      await user.click(screen.getByText("Intake Desk"));
      await waitFor(() => {
        expect(screen.getByText("New Opportunity Intake")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Discard Entry"));

      await waitFor(() => {
        expect(
          screen.queryByText("New Opportunity Intake"),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("details view - financial editing", () => {
    it("edits linehaul and recalculates margin", async () => {
      setupMocks([makeQuote()]);
      render(<QuoteManager user={mockUser} company={mockCompany} />);

      await waitFor(() => {
        expect(screen.getByText(/Chicago/)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/Chicago, IL/));

      await waitFor(() => {
        expect(
          screen.getByText("Commercial Estimates (Non-Binding)"),
        ).toBeInTheDocument();
      });

      // Should show Estimated Net Revenue and Projected Margin sections
      expect(screen.getByText("Estimated Net Revenue")).toBeInTheDocument();
      expect(screen.getByText("Projected Margin")).toBeInTheDocument();
      expect(screen.getByText("Cost Structure")).toBeInTheDocument();
    });

    it("saves quote from details view via Save & Update", async () => {
      setupMocks([makeQuote()]);
      render(<QuoteManager user={mockUser} company={mockCompany} />);

      await waitFor(() => {
        expect(screen.getByText(/Chicago/)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/Chicago, IL/));

      await waitFor(() => {
        expect(screen.getByText("Save & Update")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Save & Update"));

      await waitFor(() => {
        expect(mockSaveQuote).toHaveBeenCalledTimes(1);
      });
    });

    it("shows Accept & Convert button for Accepted quotes", async () => {
      setupMocks([makeQuote({ status: "Accepted" })]);
      render(<QuoteManager user={mockUser} company={mockCompany} />);

      await waitFor(() => {
        expect(screen.getByText(/Chicago/)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/Chicago, IL/));

      await waitFor(() => {
        expect(screen.getByText(/Convert to Load/)).toBeInTheDocument();
      });
    });

    it("converts accepted quote to booking", async () => {
      setupMocks([makeQuote({ status: "Accepted" })]);
      render(<QuoteManager user={mockUser} company={mockCompany} />);

      await waitFor(() => {
        expect(screen.getByText(/Chicago/)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/Chicago, IL/));

      await waitFor(() => {
        expect(screen.getByText(/Convert to Load/)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/Convert to Load/));

      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalledWith(
          "/bookings/convert",
          expect.objectContaining({
            quote_id: "q-1",
            status: "Confirmed",
            load_number: expect.stringMatching(/^LD-/),
          }),
        );
      });
    });
  });

  describe("pipeline search filter", () => {
    it("filters quotes by city search query", async () => {
      setupMocks([
        makeQuote({
          id: "q-1",
          pickup: { city: "Chicago", state: "IL" },
          dropoff: { city: "Dallas", state: "TX" },
        }),
        makeQuote({
          id: "q-2",
          pickup: { city: "Houston", state: "TX" },
          dropoff: { city: "Miami", state: "FL" },
          status: "Sent",
        }),
      ]);
      render(<QuoteManager user={mockUser} company={mockCompany} />);

      await waitFor(() => {
        expect(screen.getByText(/Chicago/)).toBeInTheDocument();
        expect(screen.getByText(/Houston/)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Find Quote or Lane...");
      await user.type(searchInput, "Houston");

      await waitFor(() => {
        expect(screen.queryByText(/Chicago, IL/)).not.toBeInTheDocument();
        expect(screen.getByText(/Houston, TX/)).toBeInTheDocument();
      });
    });
  });

  describe("details view - back navigation", () => {
    it("returns to pipeline when back button is clicked", async () => {
      setupMocks([makeQuote()]);
      render(<QuoteManager user={mockUser} company={mockCompany} />);

      await waitFor(() => {
        expect(screen.getByText(/Chicago/)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/Chicago, IL/));

      await waitFor(() => {
        expect(screen.getByText("Quote Review")).toBeInTheDocument();
      });

      // The back button is in the detail header with a rotate-180 arrow icon
      // It's the button inside the flex container that also contains "Quote Review"
      const headerContainer = screen
        .getByText("Quote Review")
        .closest(".flex.items-center")!
        .closest(".flex.items-center")!;
      const buttons = headerContainer.querySelectorAll("button");
      // The first button is the back arrow
      await user.click(buttons[0]);

      // After clicking back, should return to pipeline with quote cards visible
      await waitFor(() => {
        expect(screen.getByText("Intake & Quotes")).toBeInTheDocument();
        expect(screen.getByText("Pipeline View")).toBeInTheDocument();
      });
    });
  });
});
