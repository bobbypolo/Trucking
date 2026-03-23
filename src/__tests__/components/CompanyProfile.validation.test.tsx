// Tests R-P2-08
/**
 * CompanyProfile MC/DOT format hint tests for STORY-202.
 * R-P2-08: MC/DOT fields in CompanyProfile show format hint ('e.g., MC-123456')
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CompanyProfile } from "../../../components/CompanyProfile";
import type { User, Company, FreightType } from "../../../types";

const mockGetCompany = vi.fn();
const mockGetCompanyUsers = vi.fn();
const mockUpdateCompany = vi.fn();
const mockUpdateUser = vi.fn();
const mockGetCurrentUser = vi.fn();
const mockCheckCapability = vi.fn();

vi.mock("../../../services/authService", () => ({
  getCompany: (...args: unknown[]) => mockGetCompany(...args),
  updateCompany: (...args: unknown[]) => mockUpdateCompany(...args),
  getCompanyUsers: (...args: unknown[]) => mockGetCompanyUsers(...args),
  updateUser: (...args: unknown[]) => mockUpdateUser(...args),
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
  checkCapability: (...args: unknown[]) => mockCheckCapability(...args),
  CAPABILITY_PRESETS: {
    "Small Team": {
      admin: [{ capability: "QUOTE_CREATE", level: "Allow" }],
      dispatcher: [{ capability: "LOAD_ASSIGN", level: "Allow" }],
    },
    "Split Roles": {
      SALES_CUSTOMER_SERVICE: [{ capability: "QUOTE_CREATE", level: "Allow" }],
      DISPATCHER: [{ capability: "LOAD_ASSIGN", level: "Allow" }],
    },
    Enterprise: {
      SALES_CUSTOMER_SERVICE: [{ capability: "QUOTE_CREATE", level: "Allow" }],
      DISPATCHER: [{ capability: "LOAD_ASSIGN", level: "Allow" }],
    },
  },
}));

vi.mock("../../../services/storageService", () => ({
  logTime: vi.fn(),
  getTimeLogs: vi.fn().mockResolvedValue([]),
}));

const adminUser: User = {
  id: "user-1",
  companyId: "company-1",
  email: "admin@test.com",
  name: "Test Admin",
  role: "admin",
  onboardingStatus: "Completed",
  safetyScore: 100,
};

function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: "company-1",
    name: "Test Trucking LLC",
    accountType: "fleet",
    mcNumber: "",
    dotNumber: "",
    address: "100 Main St",
    city: "Chicago",
    state: "IL",
    zip: "60601",
    taxId: "12-3456789",
    supportedFreightTypes: ["Dry Van"] as FreightType[],
    defaultFreightType: "Dry Van" as FreightType,
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
      nextSequence: 100,
      zeroPad: 5,
      includeDate: true,
    },
    accessorialRates: {
      detention: 75,
      layover: 250,
      TONU: 200,
      lumper: 0,
      driverAssist: 50,
    },
    driverPermissions: {},
    dispatcherPermissions: {},
    scoringConfig: {
      minimumDispatchScore: 75,
      weights: {
        violations: 30,
        accidents: 30,
        inspections: 20,
        training: 20,
      },
    },
    subscriptionTier: "Records Vault",
    equipmentRegistry: [],
    ...overrides,
  };
}

describe("CompanyProfile — R-P2-08: MC/DOT format hints", () => {
  beforeEach(async () => {
    mockGetCompany.mockResolvedValue(makeCompany());
    mockGetCompanyUsers.mockResolvedValue([]);

    render(<CompanyProfile user={adminUser} />);

    // Wait for company to load
    await waitFor(() => {
      expect(mockGetCompany).toHaveBeenCalled();
    });
  });

  it("MC Number field or label shows format hint 'e.g., MC-123456'", async () => {
    await waitFor(() => {
      // Format hint should appear as placeholder, title attribute, or helper text
      const mcHint = screen.queryByText(/e\.g\.,?\s*MC-123456/i);
      const mcPlaceholder = document.querySelector(
        '[placeholder*="MC-123456"]',
      );
      const mcTitle = document.querySelector('[title*="MC-123456"]');
      const mcAriaDesc = document.querySelector(
        '[aria-describedby*="mc"], [data-testid*="mc-hint"]',
      );

      expect(mcHint || mcPlaceholder || mcTitle || mcAriaDesc).not.toBeNull();
    });
  });

  it("DOT Number field or label shows format hint 'e.g., DOT-123456'", async () => {
    await waitFor(() => {
      const dotHint = screen.queryByText(/e\.g\.,?\s*DOT-123456/i);
      const dotPlaceholder = document.querySelector(
        '[placeholder*="DOT-123456"]',
      );
      const dotTitle = document.querySelector('[title*="DOT-123456"]');

      expect(dotHint || dotPlaceholder || dotTitle).not.toBeNull();
    });
  });

  it("MC# section is present in the identity tab", async () => {
    await waitFor(() => {
      // The MC # label should be visible
      expect(screen.getByText(/MC\s*#/i)).toBeInTheDocument();
    });
  });

  it("DOT# section is present in the identity tab", async () => {
    await waitFor(() => {
      expect(screen.getByText(/DOT\s*#/i)).toBeInTheDocument();
    });
  });
});
