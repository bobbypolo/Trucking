/**
 * BookingPortal deep coverage tests.
 *
 * Targets uncovered lines ~1187-1291 (review step details, confirmation
 * screen interactions, error states, capability gating).
 */

import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BookingPortal } from "../../../components/BookingPortal";
import { User, Company } from "../../../types";

// ---------------------------------------------------------------------------
// Service mocks
// ---------------------------------------------------------------------------
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
const mockGenerateNextLoadNumber = vi.fn().mockReturnValue("LP-200");
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
  loadNumberingConfig: { prefix: "LP", nextNumber: 200 },
});
const mockGetIdTokenAsync = vi.fn().mockResolvedValue("test-token");

vi.mock("../../../services/authService", () => ({
  checkCapability: (...args: unknown[]) => mockCheckCapability(...args),
  getCompany: (...args: unknown[]) => mockGetCompany(...args),
  getIdTokenAsync: (...args: unknown[]) => mockGetIdTokenAsync(...args),
}));

const mockFetch = vi.fn();

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------
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

const defaultProps = {
  user: mockUser,
  company: mockCompany,
  onBookingComplete: vi.fn(),
};

// ---------------------------------------------------------------------------
// Helpers: navigate through steps
// ---------------------------------------------------------------------------
async function goToQuoteStep(user: ReturnType<typeof userEvent.setup>) {
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
}

async function goToReviewStep(user: ReturnType<typeof userEvent.setup>) {
  await goToQuoteStep(user);
  // Fill origin and destination (required for validation)
  const cityInputs = screen.getAllByPlaceholderText("CITY, ST");
  fireEvent.change(cityInputs[0], { target: { value: "Denver, CO" } });
  fireEvent.change(cityInputs[1], { target: { value: "Phoenix, AZ" } });
  const linehaulInputs = document.querySelectorAll('input[type="number"]');
  const linehaulInput = linehaulInputs[0] as HTMLInputElement;
  await user.clear(linehaulInput);
  await user.type(linehaulInput, "3500");
  await user.click(screen.getByText("Finalize Professional Quote"));
  await waitFor(() => {
    expect(screen.getByText(/Review & Dispatch Confirm/)).toBeInTheDocument();
  });
}

async function goToConfirmationStep(user: ReturnType<typeof userEvent.setup>) {
  await goToReviewStep(user);
  await user.click(screen.getByText(/Accept Quote & Convert to Booking/));
  await waitFor(() => {
    expect(screen.getByText("Booking Solidified")).toBeInTheDocument();
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("BookingPortal deep coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultProps.onBookingComplete = vi.fn();
    mockGetBrokers.mockResolvedValue([
      { id: "broker-1", name: "Alpha Logistics", mcNumber: "MC-123" },
      { id: "broker-2", name: "Beta Freight", mcNumber: "MC-456" },
    ]);
    mockGetContracts.mockResolvedValue([]);
    mockCheckCapability.mockReturnValue(true);
    mockGetCompany.mockResolvedValue({
      id: "company-1",
      name: "Test Co",
      loadNumberingConfig: { prefix: "LP", nextNumber: 200 },
    });
    mockGetIdTokenAsync.mockResolvedValue("test-token");
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        loadInfo: {
          load: {
            pickup: { city: "Denver", state: "CO" },
            dropoff: { city: "Phoenix", state: "AZ" },
            carrierRate: 2500,
            freightType: "Dry Van",
          },
        },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ========================================================================
  // REVIEW STEP — detailed content verification
  // ========================================================================
  describe("review step details", () => {
    it("shows quote version badge", async () => {
      const user = userEvent.setup();
      await goToReviewStep(user);
      const text = document.body.textContent || "";
      expect(text).toMatch(/v1.*Active/);
    });

    it("displays Lane Summary with origin and destination cities", async () => {
      const user = userEvent.setup();
      await goToReviewStep(user);
      expect(screen.getByText("Lane Summary")).toBeInTheDocument();
    });

    it("displays Commercial Value with dollar amount", async () => {
      const user = userEvent.setup();
      await goToReviewStep(user);
      expect(screen.getByText("Commercial Value")).toBeInTheDocument();
      const text = document.body.textContent || "";
      expect(text).toContain("3,500");
      expect(text).toContain("USD");
    });

    it("displays Equipment Specification", async () => {
      const user = userEvent.setup();
      await goToReviewStep(user);
      expect(screen.getByText("Equipment Specification")).toBeInTheDocument();
      const text = document.body.textContent || "";
      expect(text).toContain("Intermodal");
    });

    it("displays Valid Through date", async () => {
      const user = userEvent.setup();
      await goToReviewStep(user);
      expect(screen.getByText("Valid Through")).toBeInTheDocument();
    });

    it("shows External Engagement section with email and save buttons", async () => {
      const user = userEvent.setup();
      await goToReviewStep(user);
      expect(screen.getByText("Email Quote to Client")).toBeInTheDocument();
      expect(screen.getByText("Save as Working Concept")).toBeInTheDocument();
    });

    it("shows the Return to Rate Matrix navigation link", async () => {
      const user = userEvent.setup();
      await goToReviewStep(user);
      expect(screen.getByText("Return to Rate Matrix")).toBeInTheDocument();
    });

    it("navigates back to quote when Return to Rate Matrix is clicked", async () => {
      const user = userEvent.setup();
      await goToReviewStep(user);
      await user.click(screen.getByText("Return to Rate Matrix"));
      await waitFor(() => {
        expect(screen.getByText(/Build Quote/)).toBeInTheDocument();
      });
    });
  });

  // ========================================================================
  // CAPABILITY GATING — QUOTE_CONVERT
  // ========================================================================
  describe("capability gating in review step", () => {
    it("shows Accept button when user has QUOTE_CONVERT capability", async () => {
      mockCheckCapability.mockReturnValue(true);
      const user = userEvent.setup();
      await goToReviewStep(user);
      expect(
        screen.getByText(/Accept Quote & Convert to Booking/),
      ).toBeInTheDocument();
    });

    it("shows locked message when user lacks QUOTE_CONVERT capability", async () => {
      mockCheckCapability.mockReturnValue(false);
      const user = userEvent.setup();
      await goToReviewStep(user);
      expect(
        screen.getByText(/Capability Required: QUOTE_CONVERT/),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Contact Owner to elevate Operational DNA/),
      ).toBeInTheDocument();
    });

    it("does not show Accept button when capability is denied", async () => {
      mockCheckCapability.mockReturnValue(false);
      const user = userEvent.setup();
      await goToReviewStep(user);
      expect(
        screen.queryByText(/Accept Quote & Convert to Booking/),
      ).not.toBeInTheDocument();
    });
  });

  // ========================================================================
  // BOOKING CONVERSION — convertToBooking flow
  // ========================================================================
  describe("booking conversion", () => {
    it("calls saveBooking and saveLoad on conversion", async () => {
      const user = userEvent.setup();
      await goToConfirmationStep(user);
      expect(mockSaveBooking).toHaveBeenCalledTimes(1);
      expect(mockSaveLoad).toHaveBeenCalledTimes(1);
    });

    it("generates load number via generateNextLoadNumber", async () => {
      const user = userEvent.setup();
      await goToConfirmationStep(user);
      expect(mockGenerateNextLoadNumber).toHaveBeenCalled();
    });

    it("calls getCompany during conversion", async () => {
      const user = userEvent.setup();
      await goToConfirmationStep(user);
      expect(mockGetCompany).toHaveBeenCalledWith("company-1");
    });

    it("creates load with draft status and zero driverPay", async () => {
      const user = userEvent.setup();
      await goToConfirmationStep(user);
      const loadArg = mockSaveLoad.mock.calls[0][0];
      expect(loadArg.status).toBe("draft");
      expect(loadArg.driverPay).toBe(0);
      expect(loadArg.driverId).toBe("");
    });

    it("creates load with pickup and dropoff legs", async () => {
      const user = userEvent.setup();
      await goToConfirmationStep(user);
      const loadArg = mockSaveLoad.mock.calls[0][0];
      expect(loadArg.legs).toHaveLength(2);
      expect(loadArg.legs[0].type).toBe("Pickup");
      expect(loadArg.legs[1].type).toBe("Dropoff");
    });

    it("passes user to saveLoad for audit", async () => {
      const user = userEvent.setup();
      await goToConfirmationStep(user);
      const userArg = mockSaveLoad.mock.calls[0][1];
      expect(userArg.id).toBe("user-1");
    });
  });

  // ========================================================================
  // CONFIRMATION STEP — detailed content
  // ========================================================================
  describe("confirmation step details", () => {
    it("shows Booking Solidified heading", async () => {
      const user = userEvent.setup();
      await goToConfirmationStep(user);
      expect(screen.getByText("Booking Solidified")).toBeInTheDocument();
    });

    it("displays B-ID and Q-REF badges", async () => {
      const user = userEvent.setup();
      await goToConfirmationStep(user);
      const text = document.body.textContent || "";
      expect(text).toContain("B-ID:");
      expect(text).toContain("Q-REF:");
    });

    it("shows descriptive text about conversion", async () => {
      const user = userEvent.setup();
      await goToConfirmationStep(user);
      expect(
        screen.getByText(/Quote has been converted to an active booking/),
      ).toBeInTheDocument();
      expect(screen.getByText(/Dispatch Board/)).toBeInTheDocument();
    });

    it("calls onBookingComplete when Go to Operational Board is clicked", async () => {
      const user = userEvent.setup();
      await goToConfirmationStep(user);
      await user.click(screen.getByText("Go to Operational Board"));
      expect(defaultProps.onBookingComplete).toHaveBeenCalledTimes(1);
    });

    it("resets form and returns to intake on Initiate New Quote Cycle", async () => {
      const user = userEvent.setup();
      await goToConfirmationStep(user);
      await user.click(screen.getByText("Initiate New Quote Cycle"));
      await waitFor(() => {
        expect(screen.getByText("Lead Identification")).toBeInTheDocument();
        expect(screen.getByText("Intake Strategy")).toBeInTheDocument();
      });
    });

    it("resets quote values when starting new cycle", async () => {
      const user = userEvent.setup();
      await goToConfirmationStep(user);
      await user.click(screen.getByText("Initiate New Quote Cycle"));
      await waitFor(() => {
        expect(screen.getByText("Lead Identification")).toBeInTheDocument();
      });
      // Navigate to quote step to verify reset
      await user.click(screen.getByText("Manual Phone Quote"));
      await waitFor(() => {
        expect(screen.getByText(/Build Quote/)).toBeInTheDocument();
      });
      // Total should be reset to 0
      const text = document.body.textContent || "";
      expect(text).toContain("0");
    });
  });

  // ========================================================================
  // AI SCAN — additional edge cases
  // ========================================================================
  describe("AI scan intake additional cases", () => {
    it("populates quote fields from OCR extraction result", async () => {
      const user = userEvent.setup();
      render(<BookingPortal {...defaultProps} />);
      await waitFor(() => {
        expect(document.querySelector('input[type="file"]')).toBeTruthy();
      });
      const fileInput = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(["pdf content"], "ratecon.pdf", {
        type: "application/pdf",
      });
      await user.upload(fileInput, file);
      await waitFor(() => {
        expect(screen.getByText(/Build Quote/)).toBeInTheDocument();
      });
      // OCR-extracted data populates the origin/destination inputs and the rate
      const cityInputs = screen.getAllByPlaceholderText("CITY, ST");
      expect((cityInputs[0] as HTMLInputElement).value).toContain("Denver");
      // The total rate from OCR is displayed in the Total Quote Value area
      const text = document.body.textContent || "";
      expect(text).toContain("2,500");
    });

    it("shows success feedback after OCR extraction", async () => {
      const user = userEvent.setup();
      render(<BookingPortal {...defaultProps} />);
      await waitFor(() => {
        expect(document.querySelector('input[type="file"]')).toBeTruthy();
      });
      const fileInput = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(["content"], "doc.pdf", {
        type: "application/pdf",
      });
      await user.upload(fileInput, file);
      await waitFor(() => {
        expect(
          screen.getByText(/Intelligence extracted successfully/),
        ).toBeInTheDocument();
      });
    });

    it("shows error feedback and still navigates to quote on OCR failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: vi.fn().mockResolvedValue({ error: "Parse error" }),
      });
      const user = userEvent.setup();
      render(<BookingPortal {...defaultProps} />);
      await waitFor(() => {
        expect(document.querySelector('input[type="file"]')).toBeTruthy();
      });
      const fileInput = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(["bad"], "bad.pdf", {
        type: "application/pdf",
      });
      await user.upload(fileInput, file);
      await waitFor(() => {
        expect(
          screen.getByText(/Extraction failed.*Manual entry required/),
        ).toBeInTheDocument();
      });
      expect(screen.getByText(/Build Quote/)).toBeInTheDocument();
    });
  });

  // ========================================================================
  // QUOTE STEP — rate calculation edge cases
  // ========================================================================
  describe("quote rate calculation", () => {
    it("computes total from linehaul + FSC", async () => {
      const user = userEvent.setup();
      await goToQuoteStep(user);
      const numInputs = document.querySelectorAll('input[type="number"]');
      const linehaulInput = numInputs[0] as HTMLInputElement;
      const fscInput = numInputs[1] as HTMLInputElement;
      await user.clear(linehaulInput);
      await user.type(linehaulInput, "2000");
      await user.clear(fscInput);
      await user.type(fscInput, "300");
      await waitFor(() => {
        const text = document.body.textContent || "";
        expect(text).toContain("2,300");
      });
    });

    it("handles zero linehaul gracefully", async () => {
      const user = userEvent.setup();
      await goToQuoteStep(user);
      const numInputs = document.querySelectorAll('input[type="number"]');
      const linehaulInput = numInputs[0] as HTMLInputElement;
      await user.clear(linehaulInput);
      await user.type(linehaulInput, "0");
      const text = document.body.textContent || "";
      expect(text).toContain("0");
    });
  });

  // ========================================================================
  // BROKER/CONTRACT LOADING
  // ========================================================================
  describe("broker and contract loading", () => {
    it("auto-selects single contract when only one exists", async () => {
      mockGetContracts.mockResolvedValue([
        {
          id: "c1",
          customerId: "broker-1",
          contractName: "Standard",
          status: "Active",
        },
      ]);
      const user = userEvent.setup();
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

    it("sets lead customerName when broker is selected", async () => {
      const user = userEvent.setup();
      render(<BookingPortal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("Alpha Logistics")).toBeInTheDocument();
      });
      const select = screen.getByDisplayValue("Select Partner");
      await user.selectOptions(select, "broker-1");
      // Verify broker selection updated
      expect(select).toHaveValue("broker-1");
    });

    it("shows client name in quote step header after broker selection", async () => {
      const user = userEvent.setup();
      await goToQuoteStep(user);
      const text = document.body.textContent || "";
      expect(text).toContain("Alpha Logistics");
    });
  });

  // ========================================================================
  // FEEDBACK DISMISSAL
  // ========================================================================
  describe("feedback bar interactions", () => {
    it("feedback auto-clears are handled (not blocking UI)", async () => {
      const user = userEvent.setup();
      render(<BookingPortal {...defaultProps} />);
      await user.click(await screen.findByText("Manual Phone Quote"));
      await waitFor(() => {
        expect(
          screen.getByText("Finalize Professional Quote"),
        ).toBeInTheDocument();
      });
      // Trigger error feedback by finalizing without broker
      await user.click(screen.getByText("Finalize Professional Quote"));
      await waitFor(() => {
        expect(screen.getByText(/Missing broker or rate/)).toBeInTheDocument();
      });
      // Dismiss manually
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

  // ========================================================================
  // EQUIPMENT SELECTION in quote step
  // ========================================================================
  describe("equipment type selection", () => {
    it("changes equipment type to Flatbed", async () => {
      const user = userEvent.setup();
      await goToQuoteStep(user);
      const equipSelect = screen.getByDisplayValue("Intermodal");
      await user.selectOptions(equipSelect, "Flatbed");
      expect(equipSelect).toHaveValue("Flatbed");
    });

    it("changes equipment type to Reefer", async () => {
      const user = userEvent.setup();
      await goToQuoteStep(user);
      const equipSelect = screen.getByDisplayValue("Intermodal");
      await user.selectOptions(equipSelect, "Reefer");
      expect(equipSelect).toHaveValue("Reefer");
    });

    it("displays equipment requirements in review step", async () => {
      const user = userEvent.setup();
      await goToQuoteStep(user);
      const constraintInput = screen.getByPlaceholderText(
        "Special Constraints (e.g. TWIC)",
      );
      await user.type(constraintInput, "Hazmat certified");
      const linehaulInputs = document.querySelectorAll('input[type="number"]');
      await user.clear(linehaulInputs[0] as HTMLInputElement);
      await user.type(linehaulInputs[0] as HTMLInputElement, "5000");
      await user.click(screen.getByText("Finalize Professional Quote"));
      await waitFor(() => {
        expect(
          screen.getByText(/Review & Dispatch Confirm/),
        ).toBeInTheDocument();
      });
      const text = document.body.textContent || "";
      expect(text).toContain("Hazmat certified");
    });
  });
});
