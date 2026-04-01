import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Auth } from "../../../components/Auth";
import type { User, Company } from "../../../types";

// ---------------------------------------------------------------------------
// Mock authService at the network boundary
// ---------------------------------------------------------------------------
const mockLogin = vi.fn();
const mockRegisterCompany = vi.fn();
const mockUpdateCompany = vi.fn();
const mockGetAuthHeaders = vi.fn();

vi.mock("../../../services/authService", () => ({
  login: (...args: unknown[]) => mockLogin(...args),
  registerCompany: (...args: unknown[]) => mockRegisterCompany(...args),
  updateCompany: (...args: unknown[]) => mockUpdateCompany(...args),
  getAuthHeaders: (...args: unknown[]) => mockGetAuthHeaders(...args),
}));

// Mock config
vi.mock("../../../services/config", () => ({
  API_URL: "http://localhost:5000/api",
}));

// Mock uuid
vi.mock("uuid", () => ({
  v4: () => "mock-uuid-1234",
}));

// ---------------------------------------------------------------------------
// Fixtures
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
  name: "Test Trucking LLC",
  accountType: "owner_operator",
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
  loadNumberingConfig: {
    prefix: "LD",
    nextSequence: 1,
    zeroPad: 5,
    includeDate: true,
  },
  accessorialRates: {
    detention: 75,
    layover: 250,
    TONU: 200,
    lumper: 0,
    driverAssist: 50,
    tradeShowHandling: 0,
    hazmat: 0,
    tankerEndorsement: 0,
    reefer: 0,
    residential: 0,
    liftGate: 0,
    insideDelivery: 0,
    sortAndSegregate: 0,
    markAndTag: 0,
    customsBond: 0,
  },
  driverPermissions: {},
  ownerOpPermissions: {},
  dispatcherPermissions: {},
  scoringConfig: {
    enabled: true,
    minimumDispatchScore: 75,
    weights: { safety: 40, onTime: 35, paperwork: 25 },
  },
  equipmentRegistry: [],
  operatingMode: "Small Team" as const,
  subscriptionTier: "Records Vault",
  maxUsers: 5,
};

const onLogin = vi.fn();

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mockRegisterCompany.mockResolvedValue({
    user: mockUser,
    company: mockCompany,
  });
  mockUpdateCompany.mockResolvedValue(undefined);
  mockGetAuthHeaders.mockResolvedValue({
    "Content-Type": "application/json",
    Authorization: "Bearer mock-token",
  });

  // Mock global fetch for Stripe checkout session API
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

// ---------------------------------------------------------------------------
// Helper: Navigate to payment step
// ---------------------------------------------------------------------------
async function goToPayment() {
  const user = userEvent.setup();
  render(<Auth onLogin={onLogin} />);
  await user.click(screen.getByRole("button", { name: /create account/i }));
  await user.click(screen.getByText("Fleet Carrier"));
  await user.type(screen.getByPlaceholderText("Legal Name"), "Jane");
  await user.type(screen.getByPlaceholderText("Company Name"), "Fleet Co");
  await user.type(screen.getByPlaceholderText("Email"), "jane@fleet.com");
  await user.type(screen.getByPlaceholderText("Password"), "Pass123!");
  await user.click(screen.getByRole("button", { name: /continue registry/i }));

  await waitFor(() => {
    expect(screen.getByText("Step 2: Company Details")).toBeInTheDocument();
  });

  await user.type(screen.getByPlaceholderText("00-0000000"), "12-3456789");
  await user.type(
    screen.getByPlaceholderText("123 Carrier Way"),
    "100 Fleet Ave",
  );
  await user.type(screen.getByPlaceholderText("City"), "Chicago");
  await user.type(screen.getByPlaceholderText("State"), "IL");
  await user.type(screen.getByPlaceholderText("ZIP"), "60601");
  await user.click(screen.getByRole("button", { name: /verify & next/i }));

  await waitFor(() => {
    expect(screen.getByText("Step 3: Initial Registry")).toBeInTheDocument();
  });

  await user.click(screen.getByRole("button", { name: /complete registry/i }));

  await waitFor(() => {
    expect(screen.getByText("Secure Hub")).toBeInTheDocument();
  });
  return user;
}

// =========================================================================
// S-401: Stripe Checkout Integration Tests
// =========================================================================
describe("S-401: Auth Stripe Checkout", () => {
  // R-P4-01: PCI Compliance - No card inputs
  describe("PCI Compliance (R-P4-01)", () => {
    it("does not render card number input", async () => {
      await goToPayment();
      expect(
        screen.queryByPlaceholderText("Card Number"),
      ).not.toBeInTheDocument();
    });

    it("does not render card expiry input", async () => {
      await goToPayment();
      expect(screen.queryByPlaceholderText("MM/YY")).not.toBeInTheDocument();
    });

    it("does not render CVC input", async () => {
      await goToPayment();
      expect(screen.queryByPlaceholderText("CVC")).not.toBeInTheDocument();
    });

    it("does not render any card-related input fields", async () => {
      await goToPayment();
      const inputs = screen.queryAllByRole("textbox");
      const cardInputs = inputs.filter((input) => {
        const placeholder = input.getAttribute("placeholder") || "";
        return /card|cvc|cvv|expir/i.test(placeholder);
      });
      expect(cardInputs).toHaveLength(0);
    });
  });

  // R-P4-02: Subscribe with Stripe button
  describe("Subscribe with Stripe (R-P4-02)", () => {
    it("renders Subscribe with Stripe button on payment step", async () => {
      await goToPayment();
      expect(
        screen.getByRole("button", { name: /subscribe with stripe/i }),
      ).toBeInTheDocument();
    });

    it("creates account first, then calls checkout session API with auth token", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ url: "https://checkout.stripe.com/session123" }),
      });

      const user = await goToPayment();
      await user.click(
        screen.getByRole("button", { name: /subscribe with stripe/i }),
      );

      // Account is created before the Stripe API call
      await waitFor(() => {
        expect(mockRegisterCompany).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/stripe/create-checkout-session"),
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              Authorization: "Bearer mock-token",
            }),
            body: expect.stringContaining("successUrl"),
          }),
        );
      });

      // Also verify cancelUrl is in the request body
      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body).toHaveProperty("successUrl");
      expect(body).toHaveProperty("cancelUrl");
    });

    it("displays tier name and price on payment step", async () => {
      await goToPayment();
      expect(screen.getByText("Subscription Plan")).toBeInTheDocument();
      // Fleet Core tier should be shown (fleet account type defaults to Fleet Core)
      expect(screen.getByText(/Fleet Core/)).toBeInTheDocument();
    });
  });

  // R-P4-03: Start Free Trial
  describe("Start Free Trial (R-P4-03)", () => {
    it("renders Start Free Trial button on payment step", async () => {
      await goToPayment();
      expect(
        screen.getByRole("button", { name: /start free trial/i }),
      ).toBeInTheDocument();
    });

    it("bypasses payment and shows verification notice on trial signup", async () => {
      const user = await goToPayment();
      await user.click(
        screen.getByRole("button", { name: /start free trial/i }),
      );

      await waitFor(() => {
        expect(mockRegisterCompany).toHaveBeenCalled();
      });

      // After email verification flow, user is redirected to login with notice
      await waitFor(() => {
        expect(
          screen.getByText(/verification email sent/i),
        ).toBeInTheDocument();
      });

      // Should NOT have called the Stripe checkout API
      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining("stripe"),
        expect.anything(),
      );
    });
  });

  // R-P4-04: Stripe not configured fallback
  describe("Stripe not configured fallback (R-P4-04)", () => {
    it("falls through to verification notice when Stripe API returns error", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: () =>
          Promise.resolve({
            available: false,
            reason: "no_api_key",
          }),
      });

      const user = await goToPayment();
      await user.click(
        screen.getByRole("button", { name: /subscribe with stripe/i }),
      );

      // Should fallback to trial flow (register without payment)
      await waitFor(() => {
        expect(mockRegisterCompany).toHaveBeenCalled();
      });

      // After email verification flow, user is redirected to login with notice
      await waitFor(() => {
        expect(
          screen.getByText(/verification email sent/i),
        ).toBeInTheDocument();
      });
    });
  });
});
