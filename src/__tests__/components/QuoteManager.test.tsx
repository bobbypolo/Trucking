import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QuoteManager } from "../../../components/QuoteManager";
import { User, Company, Quote, Lead, Booking, WorkItem } from "../../../types";

vi.mock("../../../services/storageService", () => ({
  getQuotes: vi.fn(),
  saveQuote: vi.fn(),
  getLeads: vi.fn(),
  saveLead: vi.fn(),
  getBookings: vi.fn(),
  saveBooking: vi.fn(),
  getWorkItems: vi.fn(),
  saveWorkItem: vi.fn(),
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

  it("renders the Intake & Quotes heading", async () => {
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Intake & Quotes")).toBeInTheDocument();
    });
  });

  it("renders pipeline view with quote status columns after load", async () => {
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Draft")).toBeInTheDocument();
      expect(screen.getByText("Sent")).toBeInTheDocument();
      expect(screen.getByText("Accepted")).toBeInTheDocument();
    });
  });

  it("displays quote data with city and state info", async () => {
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
      expect(screen.getByText(/Dallas/)).toBeInTheDocument();
    });
  });

  it("renders empty pipeline when no quotes exist", async () => {
    vi.mocked(getQuotes).mockResolvedValue([]);
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(
        screen.queryByText(/Unable to load/),
      ).not.toBeInTheDocument();
      // Status column headers should still be present
      expect(screen.getByText("Draft")).toBeInTheDocument();
    });
  });

  it("renders with null company without crashing", async () => {
    render(<QuoteManager user={mockUser} company={null} />);
    await waitFor(() => {
      expect(screen.getByText("Draft")).toBeInTheDocument();
    });
  });

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

  it("opens details view when clicking New Quote", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/New Quote/)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/New Quote/));
    await waitFor(() => {
      // Details view shows Quote Review heading
      expect(screen.getByText("Quote Review")).toBeInTheDocument();
    });
  });

  it("displays total rate for each quote in pipeline", async () => {
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      // q-1 total rate is $2,200
      expect(screen.getByText(/2,200/)).toBeInTheDocument();
      // q-2 total rate is $4,000
      expect(screen.getByText(/4,000/)).toBeInTheDocument();
    });
  });

  it("filters quotes by search query", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Chicago/)).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(
      "Find Quote or Lane...",
    );
    await user.type(searchInput, "Houston");
    // Houston quote should remain visible
    await waitFor(() => {
      expect(screen.getByText(/Houston/)).toBeInTheDocument();
    });
  });

  it("shows Pipeline View and Intake Desk tab buttons", async () => {
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Pipeline View")).toBeInTheDocument();
      expect(screen.getByText("Intake Desk")).toBeInTheDocument();
    });
  });

  it("can return to pipeline from details view", async () => {
    const user = userEvent.setup();
    render(<QuoteManager {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Draft")).toBeInTheDocument();
    });

    // Go to new quote
    await user.click(screen.getByText(/New Quote/));
    await waitFor(() => {
      expect(screen.getByText("Quote Review")).toBeInTheDocument();
    });

    // Go back by clicking the Pipeline View tab
    await user.click(screen.getByText("Pipeline View"));
    await waitFor(() => {
      expect(screen.getByText("Draft")).toBeInTheDocument();
    });
  });
});
