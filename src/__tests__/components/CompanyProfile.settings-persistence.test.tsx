import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CompanyProfile } from "../../../components/CompanyProfile";
import type { User, Company } from "../../../types";

// ---------------------------------------------------------------------------
// Mock services at network boundary (not the function under test)
// ---------------------------------------------------------------------------
const mockGetCompany = vi.fn();
const mockUpdateCompany = vi.fn();
const mockGetCompanyUsers = vi.fn();
const mockUpdateUser = vi.fn();
const mockGetCurrentUser = vi.fn();
const mockCheckCapability = vi.fn();

vi.mock("../../../services/authService", () => ({
  getCompany: (...args: unknown[]) => mockGetCompany(...args),
  updateCompany: (...args: unknown[]) => mockUpdateCompany(...args),
  getCompanyUsers: (...args: unknown[]) => mockGetCompanyUsers(...args),
  updateUser: (...args: unknown[]) => mockUpdateUser(...args),
  getCurrentUser: () => mockGetCurrentUser(),
  checkCapability: (...args: unknown[]) => mockCheckCapability(...args),
  CAPABILITY_PRESETS: {
    "Small Team": {},
    "Split Roles": {},
    Enterprise: {},
  },
}));

vi.mock("../../../services/storageService", () => ({
  logTime: vi.fn().mockResolvedValue({}),
  getTimeLogs: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../services/api", () => ({
  api: {
    get: vi.fn().mockRejectedValue(new Error("not available")),
    post: vi.fn().mockRejectedValue(new Error("not available")),
  },
  ForbiddenError: class ForbiddenError extends Error {
    constructor(msg = "Forbidden") {
      super(msg);
      this.name = "ForbiddenError";
    }
  },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const baseCompany: Company = {
  id: "company-1",
  name: "Test Trucking Co",
  accountType: "fleet",
  email: "admin@test.com",
  supportedFreightTypes: ["Dry Van"],
  defaultFreightType: "Dry Van",
  driverVisibilitySettings: {
    hideRates: false,
    hideBrokerContacts: false,
    maskCustomerName: false,
    showDriverPay: true,
    allowRateCon: true,
    enableDriverSafePack: true,
    autoRedactDocs: true,
  },
  loadNumberingConfig: {
    prefix: "LD",
    nextSequence: 1,
    separator: "-",
    enabled: true,
  },
  accessorialRates: {} as any,
  driverPermissions: {
    viewSettlements: true,
    viewSafety: true,
    showRates: false,
  },
  operatingMode: "Small Team",
  governance: {
    autoLockCompliance: false,
    requireQuizPass: false,
    requireMaintenancePass: false,
    maxLoadsPerDriverPerWeek: 5,
    preferredCurrency: "USD",
  },
};

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    companyId: "company-1",
    email: "admin@test.com",
    name: "Admin User",
    role: "admin",
    onboardingStatus: "Completed",
    safetyScore: 100,
    ...overrides,
  } as User;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
describe("CompanyProfile — settings persistence and role enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCompany.mockResolvedValue(baseCompany);
    mockGetCompanyUsers.mockResolvedValue([]);
    mockUpdateCompany.mockResolvedValue(undefined);
    mockUpdateUser.mockResolvedValue(undefined);
  });

  // =========================================================================
  // Admin role — save button enabled
  // =========================================================================
  describe("admin user", () => {
    it("shows Save Changes button as enabled for admin role", async () => {
      render(<CompanyProfile user={makeUser({ role: "admin" })} />);

      await waitFor(() => {
        const btn = screen.getByRole("button", { name: /save changes/i });
        expect(btn).not.toBeDisabled();
      });
    });

    it("shows Save Changes button as enabled for OWNER_ADMIN role", async () => {
      render(<CompanyProfile user={makeUser({ role: "OWNER_ADMIN" })} />);

      await waitFor(() => {
        const btn = screen.getByRole("button", { name: /save changes/i });
        expect(btn).not.toBeDisabled();
      });
    });

    it("shows Save Changes button as enabled for ORG_OWNER_SUPER_ADMIN role", async () => {
      render(
        <CompanyProfile user={makeUser({ role: "ORG_OWNER_SUPER_ADMIN" })} />,
      );

      await waitFor(() => {
        const btn = screen.getByRole("button", { name: /save changes/i });
        expect(btn).not.toBeDisabled();
      });
    });

    it("calls updateCompany with full company object on save", async () => {
      const user = userEvent.setup();

      render(<CompanyProfile user={makeUser({ role: "admin" })} />);

      // Wait for render
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /save changes/i }),
        ).toBeInTheDocument();
      });

      // Modify phone to trigger dirty state
      const phoneInput = screen.getByPlaceholderText("Enter phone number");
      await user.clear(phoneInput);
      await user.type(phoneInput, "555-1234");

      // Click save
      await user.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(mockUpdateCompany).toHaveBeenCalledTimes(1);
        const savedCompany = mockUpdateCompany.mock.calls[0][0];
        expect(savedCompany.phone).toBe("555-1234");
        expect(savedCompany.id).toBe("company-1");
        expect(savedCompany.name).toBe("Test Trucking Co");
      });
    });

    it("shows error feedback when save fails", async () => {
      mockUpdateCompany.mockRejectedValue(new Error("API Request failed: 500"));
      const user = userEvent.setup();

      render(<CompanyProfile user={makeUser({ role: "admin" })} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /save changes/i }),
        ).toBeInTheDocument();
      });

      // Modify to trigger dirty state
      const phoneInput = screen.getByPlaceholderText("Enter phone number");
      await user.clear(phoneInput);
      await user.type(phoneInput, "555-0000");

      await user.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(screen.getByText(/failed to save/i)).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // Non-admin roles — read-only
  // =========================================================================
  describe("non-admin user restrictions", () => {
    it("shows read-only banner for dispatcher role", async () => {
      render(<CompanyProfile user={makeUser({ role: "dispatcher" })} />);

      await waitFor(() => {
        expect(screen.getByText(/viewing as read-only/i)).toBeInTheDocument();
      });
    });

    it("shows disabled Save Changes button for dispatcher", async () => {
      render(<CompanyProfile user={makeUser({ role: "dispatcher" })} />);

      await waitFor(() => {
        const btn = screen.getByRole("button", { name: /save changes/i });
        expect(btn).toBeDisabled();
      });
    });

    it("shows read-only banner for payroll_manager role", async () => {
      render(<CompanyProfile user={makeUser({ role: "payroll_manager" })} />);

      await waitFor(() => {
        expect(screen.getByText(/viewing as read-only/i)).toBeInTheDocument();
      });
    });

    it("shows disabled Save Changes button for safety_manager", async () => {
      render(<CompanyProfile user={makeUser({ role: "safety_manager" })} />);

      await waitFor(() => {
        const btn = screen.getByRole("button", { name: /save changes/i });
        expect(btn).toBeDisabled();
      });
    });

    it("does not show admin tabs for non-admin roles", async () => {
      render(<CompanyProfile user={makeUser({ role: "dispatcher" })} />);

      await waitFor(() => {
        expect(screen.getByText(/viewing as read-only/i)).toBeInTheDocument();
      });

      // Admin tabs should not appear
      expect(screen.queryByText("Operations")).not.toBeInTheDocument();
      expect(screen.queryByText("Personnel")).not.toBeInTheDocument();
      expect(screen.queryByText("Security")).not.toBeInTheDocument();
      expect(screen.queryByText("Governance")).not.toBeInTheDocument();
    });

    it("shows driver cockpit tab for driver role", async () => {
      render(<CompanyProfile user={makeUser({ role: "driver" })} />);

      await waitFor(() => {
        expect(screen.getByText(/time clock/i)).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // Data loading from backend
  // =========================================================================
  describe("data loading", () => {
    it("calls getCompany with the user companyId on mount", async () => {
      render(<CompanyProfile user={makeUser({ companyId: "my-co-123" })} />);

      await waitFor(() => {
        expect(mockGetCompany).toHaveBeenCalledWith("my-co-123");
      });
    });

    it("shows loading skeleton before data arrives", () => {
      // Make getCompany hang
      mockGetCompany.mockReturnValue(new Promise(() => {}));

      render(<CompanyProfile user={makeUser()} />);

      expect(screen.getByTestId("settings-loading")).toBeInTheDocument();
    });

    it("shows error state when data fetch fails", async () => {
      mockGetCompany.mockRejectedValue(new Error("Network error"));

      render(<CompanyProfile user={makeUser()} />);

      await waitFor(() => {
        expect(screen.getByTestId("settings-error")).toBeInTheDocument();
      });
    });
  });
});
