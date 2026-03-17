import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BookingPortal } from "../../../components/BookingPortal";
import { User, Company } from "../../../types";

// Mock services at network boundary
vi.mock("../../../services/brokerService", () => ({
  getBrokers: vi.fn().mockResolvedValue([
    { id: "broker-1", name: "Alpha Logistics", mcNumber: "MC-123" },
    { id: "broker-2", name: "Beta Freight", mcNumber: "MC-456" },
  ]),
  getContracts: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../services/storageService", () => ({
  saveLoad: vi.fn().mockResolvedValue(undefined),
  generateNextLoadNumber: vi.fn().mockReturnValue("LP-100"),
  saveQuote: vi.fn().mockResolvedValue(undefined),
  saveBooking: vi.fn().mockResolvedValue(undefined),
  saveLead: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../services/authService", () => ({
  checkCapability: vi.fn().mockReturnValue(true),
  getCompany: vi.fn().mockResolvedValue({
    id: "company-1",
    name: "Test Co",
    loadNumberingConfig: { prefix: "LP", nextNumber: 100 },
  }),
}));

vi.mock("../../../services/ocrService", () => ({
  extractLoadData: vi.fn().mockResolvedValue({
    loadData: {
      pickup: { city: "Denver", state: "CO" },
      dropoff: { city: "Phoenix", state: "AZ" },
      carrierRate: 2500,
      freightType: "Dry Van",
    },
  }),
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

const mockCompany: Company = {
  id: "company-1",
  name: "Test Co",
  accountType: "fleet",
  subscriptionTier: "Fleet Core",
  operatingMode: "Small Team",
} as Company;

describe("BookingPortal component", () => {
  const defaultProps = {
    user: mockUser,
    company: mockCompany,
    onBookingComplete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initial rendering (intake step)", () => {
    it("renders without crashing", () => {
      const { container } = render(<BookingPortal {...defaultProps} />);
      expect(container).toBeTruthy();
    });

    it("renders the main header", () => {
      render(<BookingPortal {...defaultProps} />);
      expect(screen.getByText("Intake & Quotes")).toBeInTheDocument();
    });

    it("renders the subtitle", () => {
      render(<BookingPortal {...defaultProps} />);
      expect(
        screen.getByText(/Sales Workspace.*Lead to Booking Pipeline/i),
      ).toBeInTheDocument();
    });

    it("renders step indicators", () => {
      render(<BookingPortal {...defaultProps} />);
      expect(screen.getByText(/1\. intake/i)).toBeInTheDocument();
      expect(screen.getByText(/2\. quote/i)).toBeInTheDocument();
      expect(screen.getByText(/3\. review/i)).toBeInTheDocument();
      expect(screen.getByText(/4\. confirmation/i)).toBeInTheDocument();
    });

    it("renders Lead Identification section", () => {
      render(<BookingPortal {...defaultProps} />);
      expect(screen.getByText("Lead Identification")).toBeInTheDocument();
    });

    it("renders Intake Strategy section", () => {
      render(<BookingPortal {...defaultProps} />);
      expect(screen.getByText("Intake Strategy")).toBeInTheDocument();
    });

    it("renders caller/contact input", () => {
      render(<BookingPortal {...defaultProps} />);
      expect(
        screen.getByPlaceholderText("Who are we speaking with?"),
      ).toBeInTheDocument();
    });

    it("renders phone input", () => {
      render(<BookingPortal {...defaultProps} />);
      expect(
        screen.getByPlaceholderText("(555) 000-0000"),
      ).toBeInTheDocument();
    });

    it("renders AI Scan Intelligence button", () => {
      render(<BookingPortal {...defaultProps} />);
      expect(screen.getByText("AI Scan Intelligence")).toBeInTheDocument();
    });

    it("renders Manual Phone Quote button", () => {
      render(<BookingPortal {...defaultProps} />);
      expect(screen.getByText("Manual Phone Quote")).toBeInTheDocument();
    });

    it("renders client select dropdown", () => {
      render(<BookingPortal {...defaultProps} />);
      expect(screen.getByText("Select Partner")).toBeInTheDocument();
    });

    it("populates broker options after mount", async () => {
      render(<BookingPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("Alpha Logistics")).toBeInTheDocument();
        expect(screen.getByText("Beta Freight")).toBeInTheDocument();
      });
    });
  });

  describe("intake form interactions", () => {
    it("allows typing caller name", async () => {
      const user = userEvent.setup();
      render(<BookingPortal {...defaultProps} />);
      const input = screen.getByPlaceholderText("Who are we speaking with?");
      await user.type(input, "Jane Smith");
      expect(input).toHaveValue("Jane Smith");
    });

    it("allows typing phone number", async () => {
      const user = userEvent.setup();
      render(<BookingPortal {...defaultProps} />);
      const input = screen.getByPlaceholderText("(555) 000-0000");
      await user.type(input, "555-123-4567");
      expect(input).toHaveValue("555-123-4567");
    });
  });

  describe("navigation to quote step", () => {
    it("moves to quote step when Manual Phone Quote is clicked", async () => {
      const user = userEvent.setup();
      render(<BookingPortal {...defaultProps} />);
      await user.click(screen.getByText("Manual Phone Quote"));
      // Should now be on the quote step
      await waitFor(() => {
        expect(screen.getByText(/Build Quote/)).toBeInTheDocument();
      });
    });

    it("renders quote form fields in quote step", async () => {
      const user = userEvent.setup();
      render(<BookingPortal {...defaultProps} />);
      await user.click(screen.getByText("Manual Phone Quote"));
      await waitFor(() => {
        expect(screen.getByText(/Lane Baseline/)).toBeInTheDocument();
        expect(screen.getByText(/Equipment Requirement/)).toBeInTheDocument();
        expect(screen.getByText(/Commercial Structure/)).toBeInTheDocument();
      });
    });

    it("renders linehaul rate input in quote step", async () => {
      const user = userEvent.setup();
      render(<BookingPortal {...defaultProps} />);
      await user.click(screen.getByText("Manual Phone Quote"));
      await waitFor(() => {
        expect(screen.getByText("Linehaul Rate")).toBeInTheDocument();
      });
    });

    it("renders equipment type select in quote step", async () => {
      const user = userEvent.setup();
      render(<BookingPortal {...defaultProps} />);
      await user.click(screen.getByText("Manual Phone Quote"));
      await waitFor(() => {
        const text = document.body.textContent || "";
        expect(text).toContain("Intermodal");
        expect(text).toContain("Dry Van");
      });
    });

    it("renders back to intake button in quote step", async () => {
      const user = userEvent.setup();
      render(<BookingPortal {...defaultProps} />);
      await user.click(screen.getByText("Manual Phone Quote"));
      await waitFor(() => {
        expect(screen.getByText("Back to Intake")).toBeInTheDocument();
      });
    });

    it("navigates back to intake from quote step", async () => {
      const user = userEvent.setup();
      render(<BookingPortal {...defaultProps} />);
      await user.click(screen.getByText("Manual Phone Quote"));
      await waitFor(() => {
        expect(screen.getByText("Back to Intake")).toBeInTheDocument();
      });
      await user.click(screen.getByText("Back to Intake"));
      await waitFor(() => {
        expect(screen.getByText("Lead Identification")).toBeInTheDocument();
      });
    });

    it("renders Finalize Professional Quote button", async () => {
      const user = userEvent.setup();
      render(<BookingPortal {...defaultProps} />);
      await user.click(screen.getByText("Manual Phone Quote"));
      await waitFor(() => {
        expect(
          screen.getByText("Finalize Professional Quote"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("total rate calculation", () => {
    it("shows Total Quote Value field", async () => {
      const user = userEvent.setup();
      render(<BookingPortal {...defaultProps} />);
      await user.click(screen.getByText("Manual Phone Quote"));
      await waitFor(() => {
        expect(screen.getByText("Total Quote Value")).toBeInTheDocument();
      });
    });
  });

  describe("feedback messages", () => {
    it("shows error when finalizing quote without broker or rate", async () => {
      const user = userEvent.setup();
      render(<BookingPortal {...defaultProps} />);
      await user.click(screen.getByText("Manual Phone Quote"));
      await waitFor(() => {
        expect(
          screen.getByText("Finalize Professional Quote"),
        ).toBeInTheDocument();
      });
      await user.click(screen.getByText("Finalize Professional Quote"));
      await waitFor(() => {
        const text = document.body.textContent || "";
        expect(text).toContain("Missing broker or rate");
      });
    });
  });
});
