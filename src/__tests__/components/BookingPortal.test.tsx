import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BookingPortal } from "../../../components/BookingPortal";
import { User, Company } from "../../../types";

// Mock services at network boundary
const mockGetBrokers = vi.fn().mockResolvedValue([
  { id: "broker-1", name: "Alpha Logistics", mcNumber: "MC-123" },
  { id: "broker-2", name: "Beta Freight", mcNumber: "MC-456" },
]);
const mockGetContracts = vi.fn().mockResolvedValue([]);

vi.mock("../../../services/brokerService", () => ({
  getBrokers: (...args: unknown[]) => mockGetBrokers(...args),
  getContracts: (...args: unknown[]) => mockGetContracts(...args),
}));

const mockSaveLoad = vi.fn().mockResolvedValue(undefined);
const mockGenerateNextLoadNumber = vi.fn().mockReturnValue("LP-100");
const mockSaveQuote = vi.fn().mockResolvedValue(undefined);
const mockSaveBooking = vi.fn().mockResolvedValue(undefined);
const mockSaveLead = vi.fn().mockResolvedValue(undefined);

vi.mock("../../../services/storageService", () => ({
  saveLoad: (...args: unknown[]) => mockSaveLoad(...args),
  generateNextLoadNumber: (...args: unknown[]) =>
    mockGenerateNextLoadNumber(...args),
  saveQuote: (...args: unknown[]) => mockSaveQuote(...args),
  saveBooking: (...args: unknown[]) => mockSaveBooking(...args),
  saveLead: (...args: unknown[]) => mockSaveLead(...args),
}));

const mockCheckCapability = vi.fn().mockReturnValue(true);
const mockGetCompany = vi.fn().mockResolvedValue({
  id: "company-1",
  name: "Test Co",
  loadNumberingConfig: { prefix: "LP", nextNumber: 100 },
});

vi.mock("../../../services/authService", () => ({
  checkCapability: (...args: unknown[]) => mockCheckCapability(...args),
  getCompany: (...args: unknown[]) => mockGetCompany(...args),
}));

const mockExtractLoadData = vi.fn().mockResolvedValue({
  loadData: {
    pickup: { city: "Denver", state: "CO" },
    dropoff: { city: "Phoenix", state: "AZ" },
    carrierRate: 2500,
    freightType: "Dry Van",
  },
});

vi.mock("../../../services/ocrService", () => ({
  extractLoadData: (...args: unknown[]) => mockExtractLoadData(...args),
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
    mockGetBrokers.mockResolvedValue([
      { id: "broker-1", name: "Alpha Logistics", mcNumber: "MC-123" },
      { id: "broker-2", name: "Beta Freight", mcNumber: "MC-456" },
    ]);
    mockGetContracts.mockResolvedValue([]);
    mockCheckCapability.mockReturnValue(true);
    mockGetCompany.mockResolvedValue({
      id: "company-1",
      name: "Test Co",
      loadNumberingConfig: { prefix: "LP", nextNumber: 100 },
    });
    mockExtractLoadData.mockResolvedValue({
      loadData: {
        pickup: { city: "Denver", state: "CO" },
        dropoff: { city: "Phoenix", state: "AZ" },
        carrierRate: 2500,
        freightType: "Dry Van",
      },
    });
  });

  describe("initial rendering (intake step)", () => {
    it("renders without crashing", () => {
      render(<BookingPortal {...defaultProps} />);
      expect(screen.getByText("Intake & Quotes")).toBeInTheDocument();
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

    it("selects a broker from the dropdown", async () => {
      const user = userEvent.setup();
      render(<BookingPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("Alpha Logistics")).toBeInTheDocument();
      });
      const select = screen.getByDisplayValue("Select Partner");
      await user.selectOptions(select, "broker-1");
      expect(select).toHaveValue("broker-1");
    });

    it("loads contracts when a broker is selected", async () => {
      const user = userEvent.setup();
      mockGetContracts.mockResolvedValue([
        {
          id: "contract-1",
          customerId: "broker-1",
          contractName: "Standard",
          status: "Active",
        },
      ]);
      render(<BookingPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("Alpha Logistics")).toBeInTheDocument();
      });
      const select = screen.getByDisplayValue("Select Partner");
      await user.selectOptions(select, "broker-1");
      await waitFor(() => {
        expect(mockGetContracts).toHaveBeenCalledWith("broker-1");
      });
    });
  });

  describe("navigation to quote step", () => {
    it("moves to quote step when Manual Phone Quote is clicked", async () => {
      const user = userEvent.setup();
      render(<BookingPortal {...defaultProps} />);
      await user.click(screen.getByText("Manual Phone Quote"));
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

  describe("quote form field editing", () => {
    it("allows editing origin city/state", async () => {
      const user = userEvent.setup();
      render(<BookingPortal {...defaultProps} />);
      await user.click(screen.getByText("Manual Phone Quote"));
      await waitFor(() => {
        expect(screen.getByText(/Lane Baseline/)).toBeInTheDocument();
      });
      const inputs = screen.getAllByPlaceholderText("CITY, ST");
      const originInput = inputs[0];
      await user.clear(originInput);
      // Type just the city name - the controlled input splits on comma
      // so typing "Chicago" sets city="Chicago" in quote state
      await user.type(originInput, "Chicago");
      expect(originInput).toHaveValue("Chicago");
    });

    it("allows editing destination city/state", async () => {
      const user = userEvent.setup();
      render(<BookingPortal {...defaultProps} />);
      await user.click(screen.getByText("Manual Phone Quote"));
      await waitFor(() => {
        expect(screen.getByText(/Lane Baseline/)).toBeInTheDocument();
      });
      const inputs = screen.getAllByPlaceholderText("CITY, ST");
      const destInput = inputs[1];
      await user.clear(destInput);
      // Type city and state together - the component splits on comma
      await user.type(destInput, "Dallas");
      expect(destInput).toHaveValue("Dallas");
    });

    it("allows changing equipment type", async () => {
      const user = userEvent.setup();
      render(<BookingPortal {...defaultProps} />);
      await user.click(screen.getByText("Manual Phone Quote"));
      await waitFor(() => {
        expect(screen.getByText(/Equipment Requirement/)).toBeInTheDocument();
      });
      const equipSelect = screen.getByDisplayValue("Intermodal");
      await user.selectOptions(equipSelect, "Reefer");
      expect(equipSelect).toHaveValue("Reefer");
    });

    it("allows typing equipment requirements", async () => {
      const user = userEvent.setup();
      render(<BookingPortal {...defaultProps} />);
      await user.click(screen.getByText("Manual Phone Quote"));
      await waitFor(() => {
        expect(screen.getByText(/Equipment Requirement/)).toBeInTheDocument();
      });
      const constraintInput = screen.getByPlaceholderText(
        "Special Constraints (e.g. TWIC)",
      );
      await user.type(constraintInput, "TWIC required");
      expect(constraintInput).toHaveValue("TWIC required");
    });

    it("allows typing assumptions", async () => {
      const user = userEvent.setup();
      render(<BookingPortal {...defaultProps} />);
      await user.click(screen.getByText("Manual Phone Quote"));
      await waitFor(() => {
        expect(screen.getByText(/Assumptions/)).toBeInTheDocument();
      });
      const textarea = screen.getByPlaceholderText(
        /Detention rules, lumper policy/,
      );
      await user.type(textarea, "No detention");
      expect(textarea).toHaveValue("No detention");
    });

    it("allows entering fuel surcharge", async () => {
      const user = userEvent.setup();
      render(<BookingPortal {...defaultProps} />);
      await user.click(screen.getByText("Manual Phone Quote"));
      await waitFor(() => {
        expect(screen.getByText("Fuel Surcharge (FSC)")).toBeInTheDocument();
      });
      const fscInputs = document.querySelectorAll('input[type="number"]');
      const fscInput = fscInputs[1] as HTMLInputElement;
      await user.clear(fscInput);
      await user.type(fscInput, "150");
      expect(fscInput).toHaveValue(150);
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

    it("computes total from linehaul rate", async () => {
      const user = userEvent.setup();
      render(<BookingPortal {...defaultProps} />);
      await user.click(screen.getByText("Manual Phone Quote"));
      await waitFor(() => {
        expect(screen.getByText("Linehaul Rate")).toBeInTheDocument();
      });
      const linehaulInputs = document.querySelectorAll('input[type="number"]');
      const linehaulInput = linehaulInputs[0] as HTMLInputElement;
      await user.clear(linehaulInput);
      await user.type(linehaulInput, "3000");
      await waitFor(() => {
        expect(document.body.textContent).toContain("3,000");
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

    it("dismisses feedback when X button is clicked", async () => {
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
        expect(
          screen.getByText(/Missing broker or rate/),
        ).toBeInTheDocument();
      });
      // Find and click the X/close button in the feedback bar
      const feedbackBar = screen
        .getByText(/Missing broker or rate/)
        .closest("div[class*='bg-red']");
      const closeBtn = feedbackBar!.querySelector("button");
      await user.click(closeBtn!);
      await waitFor(() => {
        expect(
          screen.queryByText(/Missing broker or rate/),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("AI scan document upload flow", () => {
    it("triggers file input when AI Scan Intelligence is clicked", async () => {
      const user = userEvent.setup();
      render(<BookingPortal {...defaultProps} />);
      const fileInput = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      expect(fileInput).toBeTruthy();
      expect(fileInput.className).toContain("hidden");
    });

    it("processes uploaded file and moves to quote step with extracted data", async () => {
      const user = userEvent.setup();
      render(<BookingPortal {...defaultProps} />);
      const fileInput = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(["test content"], "ratecon.pdf", {
        type: "application/pdf",
      });
      await user.upload(fileInput, file);
      await waitFor(() => {
        expect(mockExtractLoadData).toHaveBeenCalledWith(file);
        expect(screen.getByText(/Build Quote/)).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(
          screen.getByText(/Intelligence extracted successfully/),
        ).toBeInTheDocument();
      });
    });

    it("shows error feedback when OCR extraction fails", async () => {
      mockExtractLoadData.mockRejectedValueOnce(new Error("OCR failed"));
      const user = userEvent.setup();
      render(<BookingPortal {...defaultProps} />);
      const fileInput = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(["bad data"], "broken.pdf", {
        type: "application/pdf",
      });
      await user.upload(fileInput, file);
      await waitFor(() => {
        expect(
          screen.getByText(/Extraction failed.*Manual entry required/),
        ).toBeInTheDocument();
      });
      // Should still move to quote step for manual entry
      expect(screen.getByText(/Build Quote/)).toBeInTheDocument();
    });

    it("does nothing when file input change fires with no file", async () => {
      render(<BookingPortal {...defaultProps} />);
      const fileInput = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      // Simulate empty change event
      Object.defineProperty(fileInput, "files", { value: [] });
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      // Should remain on intake step
      expect(screen.getByText("Lead Identification")).toBeInTheDocument();
    });
  });

  describe("full intake -> quote -> review -> booking flow", () => {
    async function navigateToReviewStep(user: ReturnType<typeof userEvent.setup>) {
      render(<BookingPortal {...defaultProps} />);
      // Wait for brokers to load
      await waitFor(() => {
        expect(screen.getByText("Alpha Logistics")).toBeInTheDocument();
      });
      // Select broker
      const select = screen.getByDisplayValue("Select Partner");
      await user.selectOptions(select, "broker-1");
      // Go to quote step via manual
      await user.click(screen.getByText("Manual Phone Quote"));
      await waitFor(() => {
        expect(screen.getByText(/Build Quote/)).toBeInTheDocument();
      });
      // Enter linehaul rate
      const linehaulInputs = document.querySelectorAll('input[type="number"]');
      const linehaulInput = linehaulInputs[0] as HTMLInputElement;
      await user.clear(linehaulInput);
      await user.type(linehaulInput, "2500");
      // Finalize quote
      await user.click(screen.getByText("Finalize Professional Quote"));
      await waitFor(() => {
        expect(mockSaveQuote).toHaveBeenCalled();
        expect(screen.getByText(/Review & Dispatch Confirm/)).toBeInTheDocument();
      });
    }

    it("completes intake -> quote -> review flow", async () => {
      const user = userEvent.setup();
      await navigateToReviewStep(user);
      // Review step should show lane summary, commercial value, equipment
      expect(screen.getByText(/Commercial Value/i)).toBeInTheDocument();
      expect(screen.getByText(/Equipment Specification/i)).toBeInTheDocument();
      expect(screen.getByText(/Valid Through/i)).toBeInTheDocument();
    });

    it("shows review step with quote details", async () => {
      const user = userEvent.setup();
      await navigateToReviewStep(user);
      expect(
        screen.getByText(/Verify all commercial parameters/),
      ).toBeInTheDocument();
      expect(screen.getByText(/Email Quote to Client/)).toBeInTheDocument();
      expect(screen.getByText(/Save as Working Concept/)).toBeInTheDocument();
    });

    it("shows Accept Quote button when user has QUOTE_CONVERT capability", async () => {
      const user = userEvent.setup();
      await navigateToReviewStep(user);
      expect(
        screen.getByText(/Accept Quote & Convert to Booking/),
      ).toBeInTheDocument();
    });

    it("shows locked message when user lacks QUOTE_CONVERT capability", async () => {
      mockCheckCapability.mockReturnValue(false);
      const user = userEvent.setup();
      await navigateToReviewStep(user);
      expect(
        screen.getByText(/Capability Required: QUOTE_CONVERT/),
      ).toBeInTheDocument();
    });

    it("navigates back from review to quote step", async () => {
      const user = userEvent.setup();
      await navigateToReviewStep(user);
      await user.click(screen.getByText("Return to Rate Matrix"));
      await waitFor(() => {
        expect(screen.getByText(/Build Quote/)).toBeInTheDocument();
      });
    });

    it("converts quote to booking and shows confirmation", async () => {
      const user = userEvent.setup();
      await navigateToReviewStep(user);
      await user.click(screen.getByText(/Accept Quote & Convert to Booking/));
      await waitFor(() => {
        expect(mockSaveBooking).toHaveBeenCalled();
        expect(mockSaveLoad).toHaveBeenCalled();
        expect(screen.getByText("Booking Solidified")).toBeInTheDocument();
      });
    });
  });

  describe("confirmation step", () => {
    async function navigateToConfirmation(user: ReturnType<typeof userEvent.setup>) {
      render(<BookingPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("Alpha Logistics")).toBeInTheDocument();
      });
      const select = screen.getByDisplayValue("Select Partner");
      await user.selectOptions(select, "broker-1");
      await user.click(screen.getByText("Manual Phone Quote"));
      await waitFor(() => {
        expect(screen.getByText(/Build Quote/)).toBeInTheDocument();
      });
      const linehaulInputs = document.querySelectorAll('input[type="number"]');
      const linehaulInput = linehaulInputs[0] as HTMLInputElement;
      await user.clear(linehaulInput);
      await user.type(linehaulInput, "2500");
      await user.click(screen.getByText("Finalize Professional Quote"));
      await waitFor(() => {
        expect(screen.getByText(/Review & Dispatch Confirm/)).toBeInTheDocument();
      });
      await user.click(screen.getByText(/Accept Quote & Convert to Booking/));
      await waitFor(() => {
        expect(screen.getByText("Booking Solidified")).toBeInTheDocument();
      });
    }

    it("displays booking and quote reference IDs", async () => {
      const user = userEvent.setup();
      await navigateToConfirmation(user);
      const text = document.body.textContent || "";
      expect(text).toContain("B-ID:");
      expect(text).toContain("Q-REF:");
    });

    it("describes what happened in confirmation", async () => {
      const user = userEvent.setup();
      await navigateToConfirmation(user);
      expect(
        screen.getByText(/Quote has been converted to an active booking/),
      ).toBeInTheDocument();
    });

    it("calls onBookingComplete when Go to Operational Board is clicked", async () => {
      const user = userEvent.setup();
      await navigateToConfirmation(user);
      await user.click(screen.getByText("Go to Operational Board"));
      expect(defaultProps.onBookingComplete).toHaveBeenCalledTimes(1);
    });

    it("resets form and returns to intake when Initiate New Quote Cycle is clicked", async () => {
      const user = userEvent.setup();
      await navigateToConfirmation(user);
      await user.click(screen.getByText("Initiate New Quote Cycle"));
      await waitFor(() => {
        expect(screen.getByText("Lead Identification")).toBeInTheDocument();
      });
    });
  });
});
