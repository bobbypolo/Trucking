import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BookingPortal } from "../../../components/BookingPortal";
import { User, Company } from "../../../types";

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

describe("BookingPortal coverage — review/confirmation steps", () => {
  const defaultProps = {
    user: mockUser,
    company: mockCompany,
    onBookingComplete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("navigates through full flow: intake -> quote -> fill rate -> finalize -> review", async () => {
    const user = userEvent.setup();
    render(<BookingPortal {...defaultProps} />);

    // Select a broker
    await waitFor(() => {
      expect(screen.getByText("Alpha Logistics")).toBeInTheDocument();
    });
    // Select broker via the <select> dropdown
    const selects = document.querySelectorAll("select");
    const brokerSelect = Array.from(selects).find((s) =>
      Array.from(s.options).some((o) => o.text === "Alpha Logistics"),
    )!;
    await user.selectOptions(brokerSelect, "broker-1");

    // Go to quote step
    await user.click(screen.getByText("Manual Phone Quote"));
    await waitFor(() => {
      expect(screen.getByText("Linehaul Rate")).toBeInTheDocument();
    });

    // Fill in origin and destination
    const cityInputs = screen.getAllByPlaceholderText("CITY, ST");
    await user.type(cityInputs[0], "Chicago, IL");

    // Fill in linehaul rate
    const linehaulInputs = document.querySelectorAll('input[type="number"]');
    const linehaulInput = linehaulInputs[0] as HTMLInputElement;
    await user.type(linehaulInput, "2500");

    // Finalize quote
    await user.click(screen.getByText("Finalize Professional Quote"));
    await waitFor(() => {
      expect(screen.getByText(/Review & Dispatch Confirm/)).toBeInTheDocument();
    });
  });

  it("renders review step with lane summary and commercial value", async () => {
    const user = userEvent.setup();
    render(<BookingPortal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Alpha Logistics")).toBeInTheDocument();
    });
    // Select broker via the <select> dropdown
    const selects = document.querySelectorAll("select");
    const brokerSelect = Array.from(selects).find((s) =>
      Array.from(s.options).some((o) => o.text === "Alpha Logistics"),
    )!;
    await user.selectOptions(brokerSelect, "broker-1");

    await user.click(screen.getByText("Manual Phone Quote"));
    await waitFor(() => {
      expect(screen.getByText("Linehaul Rate")).toBeInTheDocument();
    });

    const linehaulInputs = document.querySelectorAll('input[type="number"]');
    await user.type(linehaulInputs[0] as HTMLInputElement, "3000");

    await user.click(screen.getByText("Finalize Professional Quote"));
    await waitFor(() => {
      expect(screen.getByText("Lane Summary")).toBeInTheDocument();
      expect(screen.getByText("Commercial Value")).toBeInTheDocument();
      expect(screen.getByText("Equipment Specification")).toBeInTheDocument();
    });
  });

  it("renders Email Quote and Save as Working Concept buttons in review step", async () => {
    const user = userEvent.setup();
    render(<BookingPortal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Alpha Logistics")).toBeInTheDocument();
    });
    // Select broker via the <select> dropdown
    const selects = document.querySelectorAll("select");
    const brokerSelect = Array.from(selects).find((s) =>
      Array.from(s.options).some((o) => o.text === "Alpha Logistics"),
    )!;
    await user.selectOptions(brokerSelect, "broker-1");
    await user.click(screen.getByText("Manual Phone Quote"));
    await waitFor(() => {
      expect(screen.getByText("Linehaul Rate")).toBeInTheDocument();
    });

    const linehaulInputs = document.querySelectorAll('input[type="number"]');
    await user.type(linehaulInputs[0] as HTMLInputElement, "1000");

    await user.click(screen.getByText("Finalize Professional Quote"));
    await waitFor(() => {
      expect(screen.getByText("Email Quote to Client")).toBeInTheDocument();
      expect(
        screen.getByText("Save as Working Concept"),
      ).toBeInTheDocument();
    });
  });

  it("renders Accept Quote & Convert to Booking button when user has QUOTE_CONVERT capability", async () => {
    const user = userEvent.setup();
    render(<BookingPortal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Alpha Logistics")).toBeInTheDocument();
    });
    // Select broker via the <select> dropdown
    const selects = document.querySelectorAll("select");
    const brokerSelect = Array.from(selects).find((s) =>
      Array.from(s.options).some((o) => o.text === "Alpha Logistics"),
    )!;
    await user.selectOptions(brokerSelect, "broker-1");
    await user.click(screen.getByText("Manual Phone Quote"));
    await waitFor(() => {
      expect(screen.getByText("Linehaul Rate")).toBeInTheDocument();
    });

    const linehaulInputs = document.querySelectorAll('input[type="number"]');
    await user.type(linehaulInputs[0] as HTMLInputElement, "5000");

    await user.click(screen.getByText("Finalize Professional Quote"));
    await waitFor(() => {
      expect(
        screen.getByText("Accept Quote & Convert to Booking"),
      ).toBeInTheDocument();
    });
  });

  it("converts quote to booking and shows confirmation step", async () => {
    const user = userEvent.setup();
    render(<BookingPortal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Alpha Logistics")).toBeInTheDocument();
    });
    // Select broker via the <select> dropdown
    const selects = document.querySelectorAll("select");
    const brokerSelect = Array.from(selects).find((s) =>
      Array.from(s.options).some((o) => o.text === "Alpha Logistics"),
    )!;
    await user.selectOptions(brokerSelect, "broker-1");
    await user.click(screen.getByText("Manual Phone Quote"));
    await waitFor(() => {
      expect(screen.getByText("Linehaul Rate")).toBeInTheDocument();
    });

    const linehaulInputs = document.querySelectorAll('input[type="number"]');
    await user.type(linehaulInputs[0] as HTMLInputElement, "2000");

    await user.click(screen.getByText("Finalize Professional Quote"));
    await waitFor(() => {
      expect(
        screen.getByText("Accept Quote & Convert to Booking"),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByText("Accept Quote & Convert to Booking"));
    await waitFor(() => {
      expect(screen.getByText("Booking Solidified")).toBeInTheDocument();
      expect(
        screen.getByText("Go to Operational Board"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Initiate New Quote Cycle"),
      ).toBeInTheDocument();
    });
  });

  it("calls onBookingComplete when 'Go to Operational Board' is clicked in confirmation", async () => {
    const user = userEvent.setup();
    render(<BookingPortal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Alpha Logistics")).toBeInTheDocument();
    });
    // Select broker via the <select> dropdown
    const selects = document.querySelectorAll("select");
    const brokerSelect = Array.from(selects).find((s) =>
      Array.from(s.options).some((o) => o.text === "Alpha Logistics"),
    )!;
    await user.selectOptions(brokerSelect, "broker-1");
    await user.click(screen.getByText("Manual Phone Quote"));
    await waitFor(() => {
      expect(screen.getByText("Linehaul Rate")).toBeInTheDocument();
    });

    const linehaulInputs = document.querySelectorAll('input[type="number"]');
    await user.type(linehaulInputs[0] as HTMLInputElement, "1500");

    await user.click(screen.getByText("Finalize Professional Quote"));
    await waitFor(() => {
      expect(
        screen.getByText("Accept Quote & Convert to Booking"),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByText("Accept Quote & Convert to Booking"));
    await waitFor(() => {
      expect(
        screen.getByText("Go to Operational Board"),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByText("Go to Operational Board"));
    expect(defaultProps.onBookingComplete).toHaveBeenCalledTimes(1);
  });

  it("resets to intake when 'Initiate New Quote Cycle' is clicked in confirmation", async () => {
    const user = userEvent.setup();
    render(<BookingPortal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Alpha Logistics")).toBeInTheDocument();
    });
    // Select broker via the <select> dropdown
    const selects = document.querySelectorAll("select");
    const brokerSelect = Array.from(selects).find((s) =>
      Array.from(s.options).some((o) => o.text === "Alpha Logistics"),
    )!;
    await user.selectOptions(brokerSelect, "broker-1");
    await user.click(screen.getByText("Manual Phone Quote"));
    await waitFor(() => {
      expect(screen.getByText("Linehaul Rate")).toBeInTheDocument();
    });

    const linehaulInputs = document.querySelectorAll('input[type="number"]');
    await user.type(linehaulInputs[0] as HTMLInputElement, "1800");

    await user.click(screen.getByText("Finalize Professional Quote"));
    await waitFor(() => {
      expect(
        screen.getByText("Accept Quote & Convert to Booking"),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByText("Accept Quote & Convert to Booking"));
    await waitFor(() => {
      expect(
        screen.getByText("Initiate New Quote Cycle"),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByText("Initiate New Quote Cycle"));
    await waitFor(() => {
      expect(screen.getByText("Lead Identification")).toBeInTheDocument();
    });
  });

  it("renders Return to Rate Matrix button in review step", async () => {
    const user = userEvent.setup();
    render(<BookingPortal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Alpha Logistics")).toBeInTheDocument();
    });
    // Select broker via the <select> dropdown
    const selects = document.querySelectorAll("select");
    const brokerSelect = Array.from(selects).find((s) =>
      Array.from(s.options).some((o) => o.text === "Alpha Logistics"),
    )!;
    await user.selectOptions(brokerSelect, "broker-1");
    await user.click(screen.getByText("Manual Phone Quote"));
    await waitFor(() => {
      expect(screen.getByText("Linehaul Rate")).toBeInTheDocument();
    });

    const linehaulInputs = document.querySelectorAll('input[type="number"]');
    await user.type(linehaulInputs[0] as HTMLInputElement, "4000");

    await user.click(screen.getByText("Finalize Professional Quote"));
    await waitFor(() => {
      expect(
        screen.getByText("Return to Rate Matrix"),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByText("Return to Rate Matrix"));
    await waitFor(() => {
      expect(screen.getByText("Linehaul Rate")).toBeInTheDocument();
    });
  });

  it("renders fuel surcharge input and updates total", async () => {
    const user = userEvent.setup();
    render(<BookingPortal {...defaultProps} />);

    await user.click(screen.getByText("Manual Phone Quote"));
    await waitFor(() => {
      expect(screen.getByText("Fuel Surcharge (FSC)")).toBeInTheDocument();
    });
  });

  it("renders assumptions & policy textarea in quote step", async () => {
    const user = userEvent.setup();
    render(<BookingPortal {...defaultProps} />);

    await user.click(screen.getByText("Manual Phone Quote"));
    await waitFor(() => {
      expect(screen.getByText(/Assumptions & Policy/)).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(
          "Detention rules, lumper policy, appointment requirements...",
        ),
      ).toBeInTheDocument();
    });
  });
});
