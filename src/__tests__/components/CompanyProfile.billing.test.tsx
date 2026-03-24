// Tests R-P4-06, R-P4-07, R-P4-08, R-P4-09
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import React from "react";

// Mock all service imports before importing the component
vi.mock("../../../services/authService", () => ({
  getCompany: vi.fn(),
  updateCompany: vi.fn(),
  getCompanyUsers: vi.fn().mockResolvedValue([]),
  updateUser: vi.fn(),
  getCurrentUser: vi.fn(),
  checkCapability: vi.fn().mockReturnValue(true),
  getIdTokenAsync: vi.fn().mockResolvedValue("mock-jwt-token"),
  forceRefreshToken: vi.fn().mockResolvedValue("refreshed-jwt-token"),
  CAPABILITY_PRESETS: {
    "Small Team": {},
    "Mid Fleet": {},
    Enterprise: {},
  },
}));

vi.mock("../../../services/storageService", () => ({
  logTime: vi.fn(),
  getTimeLogs: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../hooks/useAutoFeedback", () => ({
  useAutoFeedback: () => ["", vi.fn()],
}));

vi.mock("../../../components/EditUserModal", () => ({
  EditUserModal: () => null,
}));

import { getCompany } from "../../../services/authService";
import { CompanyProfile } from "../../../components/CompanyProfile";

const mockGetCompany = getCompany as ReturnType<typeof vi.fn>;

// Minimal admin user fixture
const adminUser = {
  id: "user-1",
  name: "Test Admin",
  email: "admin@test.com",
  role: "admin" as const,
  companyId: "company-1",
  onboardingStatus: "Completed" as const,
  safetyScore: 95,
};

// Company fixture with subscription data
function makeCompany(overrides: Record<string, unknown> = {}) {
  return {
    id: "company-1",
    name: "Test Trucking Co",
    accountType: "fleet",
    subscriptionTier: "Fleet Core",
    subscriptionStatus: "active",
    subscriptionPeriodEnd: "2026-04-15T00:00:00Z",
    stripeCustomerId: "cus_test123",
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
    loadNumberingConfig: { prefix: "LD", nextNumber: 1, zeroPadding: 4 },
    accessorialRates: {},
    driverPermissions: {},
    ...overrides,
  };
}

// Helper to mock fetch for billing and quickbooks endpoints
function setupFetchMock(
  responses: Record<string, { status: number; body: unknown }>,
) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    for (const [pattern, resp] of Object.entries(responses)) {
      if (url.includes(pattern)) {
        return {
          ok: resp.status >= 200 && resp.status < 300,
          status: resp.status,
          json: async () => resp.body,
        } as Response;
      }
    }
    return { ok: true, status: 200, json: async () => ({}) } as Response;
  });
  return originalFetch;
}

describe("CompanyProfile Billing & Subscription (S-402)", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: billing portal OK, quickbooks status connected
    originalFetch = setupFetchMock({
      "/api/stripe/create-billing-portal": {
        status: 200,
        body: { url: "https://billing.stripe.com/session/test" },
      },
      "/api/quickbooks/status": {
        status: 200,
        body: { connected: true, companyName: "Test QB Co" },
      },
      "/api/quickbooks/auth-url": {
        status: 200,
        body: { url: "https://appcenter.intuit.com/connect/oauth2" },
      },
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // R-P4-06: Billing section shows current tier name and status badge
  describe("R-P4-06: Billing section with tier and status", () => {
    it("renders billing section with tier name and active status badge", async () => {
      mockGetCompany.mockResolvedValue(makeCompany());

      render(<CompanyProfile user={adminUser} />);

      await waitFor(() => {
        expect(screen.getByTestId("billing-section")).toBeTruthy();
      });

      expect(screen.getByText("Fleet Core")).toBeTruthy();
      expect(screen.getByText("active")).toBeTruthy();
    });

    it("shows subscription period end date", async () => {
      mockGetCompany.mockResolvedValue(makeCompany());

      render(<CompanyProfile user={adminUser} />);

      await waitFor(() => {
        expect(screen.getByTestId("billing-section")).toBeTruthy();
      });

      // The date should be displayed in some format
      expect(screen.getByTestId("billing-period-end")).toBeTruthy();
    });

    it("shows trial status badge when subscription is trial", async () => {
      mockGetCompany.mockResolvedValue(
        makeCompany({ subscriptionStatus: "trial" }),
      );

      render(<CompanyProfile user={adminUser} />);

      await waitFor(() => {
        expect(screen.getByTestId("billing-section")).toBeTruthy();
      });

      expect(screen.getByText("trial")).toBeTruthy();
    });
  });

  // R-P4-07: Manage Subscription button calls billing portal API and redirects
  describe("R-P4-07: Manage Subscription button", () => {
    it("calls billing portal API on click", async () => {
      mockGetCompany.mockResolvedValue(makeCompany());

      render(<CompanyProfile user={adminUser} />);

      await waitFor(() => {
        expect(screen.getByTestId("billing-section")).toBeTruthy();
      });

      const manageBtn = screen.getByTestId("manage-subscription-btn");
      fireEvent.click(manageBtn);

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/stripe/create-billing-portal"),
          expect.objectContaining({ method: "POST" }),
        );
      });
    });

    it("redirects to Stripe portal URL on success", async () => {
      mockGetCompany.mockResolvedValue(makeCompany());
      const mockAssign = vi.fn();
      Object.defineProperty(window, "location", {
        value: { ...window.location, assign: mockAssign },
        writable: true,
      });

      render(<CompanyProfile user={adminUser} />);

      await waitFor(() => {
        expect(screen.getByTestId("billing-section")).toBeTruthy();
      });

      fireEvent.click(screen.getByTestId("manage-subscription-btn"));

      await waitFor(() => {
        expect(mockAssign).toHaveBeenCalledWith(
          "https://billing.stripe.com/session/test",
        );
      });
    });
  });

  // R-P4-08: Connect QuickBooks button calls auth-url API and redirects
  describe("R-P4-08: Connect QuickBooks button", () => {
    it("calls quickbooks auth-url API on click when not connected", async () => {
      mockGetCompany.mockResolvedValue(makeCompany());
      // Override: QB not connected
      globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("/api/quickbooks/status")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ connected: false }),
          } as Response;
        }
        if (url.includes("/api/quickbooks/auth-url")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              url: "https://appcenter.intuit.com/connect/oauth2",
            }),
          } as Response;
        }
        return { ok: true, status: 200, json: async () => ({}) } as Response;
      });

      render(<CompanyProfile user={adminUser} />);

      await waitFor(() => {
        expect(screen.getByTestId("quickbooks-section")).toBeTruthy();
      });

      const connectBtn = screen.getByTestId("connect-quickbooks-btn");
      fireEvent.click(connectBtn);

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/quickbooks/auth-url"),
          expect.anything(),
        );
      });
    });

    it("shows connected state when QuickBooks tokens exist", async () => {
      mockGetCompany.mockResolvedValue(makeCompany());

      render(<CompanyProfile user={adminUser} />);

      await waitFor(() => {
        expect(screen.getByTestId("quickbooks-section")).toBeTruthy();
      });

      expect(screen.getByText(/connected/i)).toBeTruthy();
    });
  });

  // R-P4-09: Sections hidden when API returns 503 (not configured)
  describe("R-P4-09: Sections hidden when not configured", () => {
    it("hides billing section when stripe returns 503", async () => {
      mockGetCompany.mockResolvedValue(
        makeCompany({ stripeCustomerId: undefined }),
      );
      globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("/api/stripe/create-billing-portal")) {
          return {
            ok: false,
            status: 503,
            json: async () => ({ error: "Stripe not configured" }),
          } as Response;
        }
        if (url.includes("/api/quickbooks/status")) {
          return {
            ok: false,
            status: 503,
            json: async () => ({
              error: "QuickBooks integration is not configured",
            }),
          } as Response;
        }
        return { ok: true, status: 200, json: async () => ({}) } as Response;
      });

      render(<CompanyProfile user={adminUser} />);

      await waitFor(() => {
        expect(screen.getByText("Test Trucking Co")).toBeTruthy();
      });

      // Billing section should not be rendered
      expect(screen.queryByTestId("billing-section")).toBeNull();
    });

    it("hides quickbooks section when quickbooks returns 503", async () => {
      mockGetCompany.mockResolvedValue(makeCompany());
      globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("/api/quickbooks/status")) {
          return {
            ok: false,
            status: 503,
            json: async () => ({
              error: "QuickBooks integration is not configured",
            }),
          } as Response;
        }
        return { ok: true, status: 200, json: async () => ({}) } as Response;
      });

      render(<CompanyProfile user={adminUser} />);

      await waitFor(() => {
        expect(screen.getByText("Test Trucking Co")).toBeTruthy();
      });

      // QuickBooks section should not be rendered
      expect(screen.queryByTestId("quickbooks-section")).toBeNull();
    });
  });
});
