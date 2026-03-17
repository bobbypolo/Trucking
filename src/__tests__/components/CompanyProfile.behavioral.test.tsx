import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CompanyProfile } from "../../../components/CompanyProfile";
import type { User, Company, FreightType, OperatingMode } from "../../../types";

// ---------------------------------------------------------------------------
// Mock services at network boundary
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
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
  checkCapability: (...args: unknown[]) => mockCheckCapability(...args),
  CAPABILITY_PRESETS: {
    "Small Team": {
      admin: [
        { capability: "QUOTE_CREATE", level: "Allow" },
        { capability: "LOAD_ASSIGN", level: "Allow" },
      ],
      dispatcher: [
        { capability: "QUOTE_CREATE", level: "Allow" },
        { capability: "LOAD_ASSIGN", level: "Allow" },
      ],
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

const mockLogTime = vi.fn();
const mockGetTimeLogs = vi.fn();

vi.mock("../../../services/storageService", () => ({
  logTime: (...args: unknown[]) => mockLogTime(...args),
  getTimeLogs: (...args: unknown[]) => mockGetTimeLogs(...args),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: "company-1",
    name: "Test Trucking LLC",
    accountType: "fleet",
    mcNumber: "MC-123456",
    dotNumber: "DOT-789012",
    address: "100 Fleet Ave",
    city: "Chicago",
    state: "IL",
    zip: "60601",
    taxId: "12-3456789",
    supportedFreightTypes: ["Dry Van", "Reefer"] as FreightType[],
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
    driverPermissions: {
      viewSettlements: true,
      viewSafety: false,
      showRates: false,
    } as any,
    ownerOpPermissions: {},
    dispatcherPermissions: {
      manageSafety: true,
      createLoads: true,
      viewIntelligence: false,
    } as any,
    scoringConfig: {
      enabled: true,
      minimumDispatchScore: 75,
      weights: { safety: 40, onTime: 35, paperwork: 25 },
    },
    equipmentRegistry: [],
    operatingMode: "Small Team" as OperatingMode,
    governance: {
      autoLockCompliance: false,
      requireQuizPass: false,
      requireMaintenancePass: false,
      maxLoadsPerDriverPerWeek: 5,
      preferredCurrency: "USD",
    },
    ...overrides,
  };
}

const adminUser: User = {
  id: "user-admin",
  companyId: "company-1",
  email: "admin@test.com",
  name: "Admin User",
  role: "admin",
  onboardingStatus: "Completed",
  safetyScore: 100,
};

const dispatcherUser: User = {
  id: "user-dispatcher",
  companyId: "company-1",
  email: "dispatch@test.com",
  name: "Dispatcher User",
  role: "dispatcher",
  onboardingStatus: "Completed",
  safetyScore: 90,
};

const driverUser: User = {
  id: "user-driver",
  companyId: "company-1",
  email: "driver@test.com",
  name: "Driver User",
  role: "driver",
  onboardingStatus: "Completed",
  safetyScore: 85,
};

const ownerOpUser: User = {
  id: "user-oo",
  companyId: "company-1",
  email: "oo@test.com",
  name: "Owner Op User",
  role: "owner_operator",
  onboardingStatus: "Completed",
  safetyScore: 92,
};

const companyUsers: User[] = [adminUser, dispatcherUser, driverUser];

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------
describe("CompanyProfile component", () => {
  const onUserRegistryChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCompany.mockResolvedValue(makeCompany());
    mockGetCompanyUsers.mockResolvedValue(companyUsers);
    mockUpdateCompany.mockResolvedValue(undefined);
    mockUpdateUser.mockResolvedValue(undefined);
    mockGetCurrentUser.mockReturnValue(adminUser);
    mockCheckCapability.mockReturnValue(true);
    mockLogTime.mockResolvedValue({ id: "log-1" });
    mockGetTimeLogs.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // LOADING STATE
  // =========================================================================
  describe("Loading state", () => {
    it("shows loading message while company data is being fetched", () => {
      // Company not returned yet
      mockGetCompany.mockReturnValue(new Promise(() => {}));
      render(
        <CompanyProfile
          user={adminUser}
          onUserRegistryChange={onUserRegistryChange}
        />,
      );

      expect(
        screen.getByText("Loading company settings..."),
      ).toBeInTheDocument();
    });

    it("renders company name after loading", async () => {
      render(
        <CompanyProfile
          user={adminUser}
          onUserRegistryChange={onUserRegistryChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("Test Trucking LLC")).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // ADMIN VIEW: HEADER AND TABS
  // =========================================================================
  describe("Admin view: Header and navigation", () => {
    it("renders Company Profile subtitle for admin", async () => {
      render(
        <CompanyProfile
          user={adminUser}
          onUserRegistryChange={onUserRegistryChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("Company Profile")).toBeInTheDocument();
      });
    });

    it("renders Save Changes button for admin", async () => {
      render(
        <CompanyProfile
          user={adminUser}
          onUserRegistryChange={onUserRegistryChange}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /save changes/i }),
        ).toBeInTheDocument();
      });
    });

    it("renders admin navigation tabs", async () => {
      render(
        <CompanyProfile
          user={adminUser}
          onUserRegistryChange={onUserRegistryChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("Identity")).toBeInTheDocument();
      });

      expect(screen.getByText("Operations")).toBeInTheDocument();
      expect(screen.getByText("Personnel")).toBeInTheDocument();
      expect(screen.getByText("Security")).toBeInTheDocument();
      expect(screen.getByText("Governance")).toBeInTheDocument();
    });

    it("does not render Save Changes button for driver", async () => {
      render(
        <CompanyProfile
          user={driverUser}
          onUserRegistryChange={onUserRegistryChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("Driver User")).toBeInTheDocument();
      });

      expect(
        screen.queryByRole("button", { name: /save changes/i }),
      ).not.toBeInTheDocument();
    });

    it("calls updateCompany when Save Changes clicked", async () => {
      const user = userEvent.setup();
      render(
        <CompanyProfile
          user={adminUser}
          onUserRegistryChange={onUserRegistryChange}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /save changes/i }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(mockUpdateCompany).toHaveBeenCalled();
      });
    });

    it("shows success message after saving", async () => {
      const user = userEvent.setup();
      render(
        <CompanyProfile
          user={adminUser}
          onUserRegistryChange={onUserRegistryChange}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /save changes/i }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(screen.getByText("Save Changes.")).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // IDENTITY TAB
  // =========================================================================
  describe("Identity tab", () => {
    it("shows company MC number", async () => {
      render(
        <CompanyProfile
          user={adminUser}
          onUserRegistryChange={onUserRegistryChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("MC-123456")).toBeInTheDocument();
      });
    });

    it("shows company DOT number", async () => {
      render(
        <CompanyProfile
          user={adminUser}
          onUserRegistryChange={onUserRegistryChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("DOT-789012")).toBeInTheDocument();
      });
    });

    it("shows company name in readonly input", async () => {
      render(
        <CompanyProfile
          user={adminUser}
          onUserRegistryChange={onUserRegistryChange}
        />,
      );

      await waitFor(() => {
        const nameInput = screen.getByDisplayValue("Test Trucking LLC");
        expect(nameInput).toBeInTheDocument();
        expect(nameInput).toHaveAttribute("readOnly");
      });
    });

    it("shows address fields as readonly", async () => {
      render(
        <CompanyProfile
          user={adminUser}
          onUserRegistryChange={onUserRegistryChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue("100 Fleet Ave")).toBeInTheDocument();
      });

      expect(screen.getByDisplayValue("Chicago")).toBeInTheDocument();
      expect(screen.getByDisplayValue("IL")).toBeInTheDocument();
      expect(screen.getByDisplayValue("60601")).toBeInTheDocument();
    });

    it("shows 'Not provided' when MC/DOT numbers are missing", async () => {
      mockGetCompany.mockResolvedValue(
        makeCompany({ mcNumber: undefined, dotNumber: undefined }),
      );

      render(
        <CompanyProfile
          user={adminUser}
          onUserRegistryChange={onUserRegistryChange}
        />,
      );

      await waitFor(() => {
        const notProvided = screen.getAllByText("Not provided");
        expect(notProvided.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  // =========================================================================
  // OPERATIONS TAB (company_profile)
  // =========================================================================
  describe("Operations tab", () => {
    async function switchToOperations() {
      const user = userEvent.setup();
      render(
        <CompanyProfile
          user={adminUser}
          onUserRegistryChange={onUserRegistryChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("Operations")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Operations"));
      return user;
    }

    it("renders Fleet Configuration section", async () => {
      await switchToOperations();

      await waitFor(() => {
        expect(screen.getByText("Fleet Configuration")).toBeInTheDocument();
      });
    });

    it("renders freight type options", async () => {
      await switchToOperations();

      await waitFor(() => {
        expect(screen.getByText("Dry Van")).toBeInTheDocument();
      });
      expect(screen.getByText("Reefer")).toBeInTheDocument();
      expect(screen.getByText("Flatbed")).toBeInTheDocument();
      expect(screen.getByText("Intermodal")).toBeInTheDocument();
    });

    it("toggles freight type authorization", async () => {
      const user = await switchToOperations();

      await waitFor(() => {
        expect(screen.getByText("Flatbed")).toBeInTheDocument();
      });

      // Flatbed is not currently selected, click to enable
      const flatbedBtn = screen.getByText("Flatbed").closest("button");
      expect(flatbedBtn).toBeInTheDocument();
      await user.click(flatbedBtn!);

      // Flatbed should now be in the selected state
      await waitFor(() => {
        expect(flatbedBtn).toHaveClass("bg-blue-600/10");
      });
    });

    it("renders operating mode buttons", async () => {
      await switchToOperations();

      await waitFor(() => {
        expect(screen.getByText("Small Team")).toBeInTheDocument();
      });
      expect(screen.getByText("Split Roles")).toBeInTheDocument();
      expect(screen.getByText("Enterprise")).toBeInTheDocument();
    });

    it("changes operating mode on click", async () => {
      const user = await switchToOperations();

      await waitFor(() => {
        expect(screen.getByText("Enterprise")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Enterprise").closest("button")!);

      await waitFor(() => {
        expect(
          screen.getByText(/System reconfigured to Enterprise mode/),
        ).toBeInTheDocument();
      });
    });

    it("renders load number settings with prefix and sequence", async () => {
      await switchToOperations();

      await waitFor(() => {
        expect(screen.getByText("Load Number Settings")).toBeInTheDocument();
      });

      expect(screen.getByDisplayValue("LD")).toBeInTheDocument();
      expect(screen.getByDisplayValue("100")).toBeInTheDocument();
    });

    it("allows editing load number prefix", async () => {
      const user = await switchToOperations();

      await waitFor(() => {
        expect(screen.getByDisplayValue("LD")).toBeInTheDocument();
      });

      const prefixInput = screen.getByDisplayValue("LD");
      await user.clear(prefixInput);
      await user.type(prefixInput, "FLT");

      expect(prefixInput).toHaveValue("FLT");
    });

    it("renders company structure dropdown", async () => {
      await switchToOperations();

      await waitFor(() => {
        expect(screen.getByText("Company Structure")).toBeInTheDocument();
      });

      expect(screen.getByDisplayValue("Fleet Operation")).toBeInTheDocument();
    });
  });

  // =========================================================================
  // PERSONNEL TAB (registry)
  // =========================================================================
  describe("Personnel tab", () => {
    async function switchToPersonnel() {
      const user = userEvent.setup();
      render(
        <CompanyProfile
          user={adminUser}
          onUserRegistryChange={onUserRegistryChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("Personnel")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Personnel"));
      return user;
    }

    it("renders Team Members heading", async () => {
      await switchToPersonnel();

      await waitFor(() => {
        expect(screen.getByText("Team Members")).toBeInTheDocument();
      });
    });

    it("renders all company users", async () => {
      await switchToPersonnel();

      await waitFor(() => {
        expect(screen.getByText("Admin User")).toBeInTheDocument();
      });
      expect(screen.getByText("Dispatcher User")).toBeInTheDocument();
      expect(screen.getByText("Driver User")).toBeInTheDocument();
    });

    it("shows user roles and emails", async () => {
      await switchToPersonnel();

      await waitFor(() => {
        expect(screen.getByText(/admin.*admin@test\.com/i)).toBeInTheDocument();
      });
    });

    it("shows first initial avatar for each user", async () => {
      await switchToPersonnel();

      await waitFor(() => {
        expect(screen.getAllByText("A").length).toBeGreaterThan(0); // Admin initial
        expect(screen.getAllByText("D").length).toBeGreaterThan(0); // Driver/Dispatcher initial
      });
    });

    it("renders Export CSV button", async () => {
      await switchToPersonnel();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /export csv/i }),
        ).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // SECURITY TAB (permissions)
  // =========================================================================
  describe("Security tab", () => {
    async function switchToSecurity() {
      const user = userEvent.setup();
      render(
        <CompanyProfile
          user={adminUser}
          onUserRegistryChange={onUserRegistryChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("Security")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Security"));
      return user;
    }

    it("renders Role Permissions heading", async () => {
      await switchToSecurity();

      await waitFor(() => {
        expect(screen.getByText("Role Permissions")).toBeInTheDocument();
      });
    });

    it("renders Driver Tier permissions", async () => {
      await switchToSecurity();

      await waitFor(() => {
        expect(screen.getByText("Driver Tier")).toBeInTheDocument();
      });
      expect(screen.getByText("View Own Settlements")).toBeInTheDocument();
      expect(screen.getByText("Access Safety Training")).toBeInTheDocument();
      expect(screen.getByText("View Load Revenue")).toBeInTheDocument();
    });

    it("renders Dispatch Tier permissions", async () => {
      await switchToSecurity();

      await waitFor(() => {
        expect(screen.getByText("Dispatch Tier")).toBeInTheDocument();
      });
      expect(screen.getByText("Manage Fleet Safety")).toBeInTheDocument();
      expect(screen.getByText("Authorized Load Creation")).toBeInTheDocument();
      expect(screen.getByText("Permission Settings")).toBeInTheDocument();
    });

    it("has toggle buttons for each permission", async () => {
      await switchToSecurity();

      await waitFor(() => {
        expect(screen.getByText("Driver Tier")).toBeInTheDocument();
      });

      // Each permission row has a toggle button
      const permRows = screen.getAllByText(
        /View Own Settlements|Access Safety Training|View Load Revenue|Manage Fleet Safety|Authorized Load Creation|Permission Settings/,
      );
      expect(permRows.length).toBe(6);
    });
  });

  // =========================================================================
  // GOVERNANCE TAB (policy)
  // =========================================================================
  describe("Governance tab", () => {
    async function switchToGovernance() {
      const user = userEvent.setup();
      render(
        <CompanyProfile
          user={adminUser}
          onUserRegistryChange={onUserRegistryChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("Governance")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Governance"));
      return user;
    }

    it("renders Safety Rules heading", async () => {
      await switchToGovernance();

      await waitFor(() => {
        expect(screen.getByText("Safety Rules")).toBeInTheDocument();
      });
    });

    it("renders Auto-Lock Compliance toggle", async () => {
      await switchToGovernance();

      await waitFor(() => {
        expect(screen.getByText("Auto-Lock Compliance")).toBeInTheDocument();
      });
    });

    it("renders Billing Settings heading", async () => {
      await switchToGovernance();

      await waitFor(() => {
        expect(screen.getByText("Billing Settings")).toBeInTheDocument();
      });
    });

    it("renders preferred currency selector", async () => {
      await switchToGovernance();

      await waitFor(() => {
        expect(screen.getByDisplayValue("USD - US Dollar")).toBeInTheDocument();
      });
    });

    it("renders max loads per week input", async () => {
      await switchToGovernance();

      await waitFor(() => {
        expect(screen.getByDisplayValue("5")).toBeInTheDocument();
      });
    });

    it("renders safety score slider", async () => {
      await switchToGovernance();

      await waitFor(() => {
        expect(screen.getByText("75%")).toBeInTheDocument();
      });
    });

    it.skip("allows changing max loads per week", async () => {
      const user = await switchToGovernance();

      await waitFor(() => {
        expect(screen.getByDisplayValue("5")).toBeInTheDocument();
      });

      const input = screen.getByDisplayValue("5");
      await user.clear(input);
      await user.type(input, "10");

      // Input may be type=text or type=number; check for string or numeric value
      const val = (input as HTMLInputElement).value;
      expect(val).toBe("10");
    });
  });

  // =========================================================================
  // DRIVER VIEW: TIME CLOCK
  // =========================================================================
  describe("Driver view: Time Clock", () => {
    it("shows driver name and role in header", async () => {
      render(
        <CompanyProfile
          user={driverUser}
          onUserRegistryChange={onUserRegistryChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("Driver User")).toBeInTheDocument();
      });
      expect(screen.getByText(/driver unit/i)).toBeInTheDocument();
    });

    it("shows Time Clock tab for drivers", async () => {
      render(
        <CompanyProfile
          user={driverUser}
          onUserRegistryChange={onUserRegistryChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("Time Clock")).toBeInTheDocument();
      });
    });

    it("does not show admin tabs for drivers", async () => {
      render(
        <CompanyProfile
          user={driverUser}
          onUserRegistryChange={onUserRegistryChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("Time Clock")).toBeInTheDocument();
      });

      expect(screen.queryByText("Identity")).not.toBeInTheDocument();
      expect(screen.queryByText("Operations")).not.toBeInTheDocument();
      expect(screen.queryByText("Personnel")).not.toBeInTheDocument();
      expect(screen.queryByText("Security")).not.toBeInTheDocument();
      expect(screen.queryByText("Governance")).not.toBeInTheDocument();
    });

    it("shows Off Duty status and Clock In button initially", async () => {
      render(
        <CompanyProfile
          user={driverUser}
          onUserRegistryChange={onUserRegistryChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("Off Duty")).toBeInTheDocument();
      });
      expect(
        screen.getByRole("button", { name: /clock in/i }),
      ).toBeInTheDocument();
      expect(screen.getByText("System Standby")).toBeInTheDocument();
    });

    it("clocks in and shows Active Duty on button click", async () => {
      const user = userEvent.setup();
      render(
        <CompanyProfile
          user={driverUser}
          onUserRegistryChange={onUserRegistryChange}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /clock in/i }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /clock in/i }));

      await waitFor(() => {
        expect(mockLogTime).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: "user-driver",
            activityType: "Driving/Active Duty",
          }),
        );
      });

      await waitFor(() => {
        expect(screen.getByText("Active Duty")).toBeInTheDocument();
      });

      expect(
        screen.getByRole("button", { name: /clock out/i }),
      ).toBeInTheDocument();
    });

    it("shows clock out modal and confirms end shift", async () => {
      const user = userEvent.setup();
      render(
        <CompanyProfile
          user={driverUser}
          onUserRegistryChange={onUserRegistryChange}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /clock in/i }),
        ).toBeInTheDocument();
      });

      // Clock in first
      await user.click(screen.getByRole("button", { name: /clock in/i }));

      await waitFor(() => {
        expect(screen.getByText("Active Duty")).toBeInTheDocument();
      });

      // Click clock out
      await user.click(screen.getByRole("button", { name: /clock out/i }));

      // Modal should appear
      await waitFor(() => {
        expect(screen.getByText("End Shift")).toBeInTheDocument();
      });

      expect(
        screen.getByPlaceholderText(
          /Describe shifts, delays, or chassis observations/,
        ),
      ).toBeInTheDocument();

      // Click confirm
      await user.click(
        screen.getByRole("button", { name: /confirm end shift/i }),
      );

      await waitFor(() => {
        expect(mockLogTime).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: "user-driver",
            activityType: "Off Duty",
          }),
        );
      });
    });

    it("cancels clock out modal", async () => {
      const user = userEvent.setup();
      render(
        <CompanyProfile
          user={driverUser}
          onUserRegistryChange={onUserRegistryChange}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /clock in/i }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /clock in/i }));

      await waitFor(() => {
        expect(screen.getByText("Active Duty")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /clock out/i }));

      await waitFor(() => {
        expect(screen.getByText("End Shift")).toBeInTheDocument();
      });

      // Click cancel
      await user.click(screen.getByRole("button", { name: /^cancel$/i }));

      // Modal should close, still Active Duty
      await waitFor(() => {
        expect(screen.queryByText("End Shift")).not.toBeInTheDocument();
      });
      expect(screen.getByText("Active Duty")).toBeInTheDocument();
    });

    it("shows success message after clocking in", async () => {
      const user = userEvent.setup();
      render(
        <CompanyProfile
          user={driverUser}
          onUserRegistryChange={onUserRegistryChange}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /clock in/i }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /clock in/i }));

      await waitFor(() => {
        expect(
          screen.getByText("Clocked In Successfully."),
        ).toBeInTheDocument();
      });
    });

    it("shows Recent Transitions section", async () => {
      render(
        <CompanyProfile
          user={driverUser}
          onUserRegistryChange={onUserRegistryChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("Recent Transitions")).toBeInTheDocument();
      });
    });

    it("shows 'No time entries yet' when logs are empty", async () => {
      mockGetTimeLogs.mockResolvedValue([]);
      render(
        <CompanyProfile
          user={driverUser}
          onUserRegistryChange={onUserRegistryChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("No time entries yet")).toBeInTheDocument();
      });
    });

    it("displays time logs when available", async () => {
      mockGetTimeLogs.mockResolvedValue([
        {
          id: "log-1",
          userId: "user-driver",
          clockIn: "2026-03-17T08:00:00Z",
          clockOut: "2026-03-17T16:00:00Z",
          activityType: "Driving/Active Duty",
        },
      ]);

      render(
        <CompanyProfile
          user={driverUser}
          onUserRegistryChange={onUserRegistryChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/Duty Cycle Exit/)).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // OWNER OPERATOR VIEW
  // =========================================================================
  describe("Owner Operator view", () => {
    it("shows driver cockpit for owner_operator role", async () => {
      render(
        <CompanyProfile
          user={ownerOpUser}
          onUserRegistryChange={onUserRegistryChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("Time Clock")).toBeInTheDocument();
      });
    });

    it("shows owner_operator user name in header", async () => {
      render(
        <CompanyProfile
          user={ownerOpUser}
          onUserRegistryChange={onUserRegistryChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("Owner Op User")).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // DISPATCHER VIEW (admin-like)
  // =========================================================================
  describe("Dispatcher view", () => {
    it("shows admin tabs for dispatcher role", async () => {
      render(
        <CompanyProfile
          user={dispatcherUser}
          onUserRegistryChange={onUserRegistryChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("Identity")).toBeInTheDocument();
      });

      expect(screen.getByText("Operations")).toBeInTheDocument();
      expect(screen.getByText("Personnel")).toBeInTheDocument();
    });

    it("shows Save Changes button for dispatcher", async () => {
      render(
        <CompanyProfile
          user={dispatcherUser}
          onUserRegistryChange={onUserRegistryChange}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /save changes/i }),
        ).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // DATA FETCHING
  // =========================================================================
  describe("Data fetching on mount", () => {
    it("fetches company data using user's companyId", async () => {
      render(
        <CompanyProfile
          user={adminUser}
          onUserRegistryChange={onUserRegistryChange}
        />,
      );

      await waitFor(() => {
        expect(mockGetCompany).toHaveBeenCalledWith("company-1");
      });
    });

    it("fetches company users using user's companyId", async () => {
      render(
        <CompanyProfile
          user={adminUser}
          onUserRegistryChange={onUserRegistryChange}
        />,
      );

      await waitFor(() => {
        expect(mockGetCompanyUsers).toHaveBeenCalledWith("company-1");
      });
    });

    it("fetches time logs for driver users", async () => {
      render(
        <CompanyProfile
          user={driverUser}
          onUserRegistryChange={onUserRegistryChange}
        />,
      );

      await waitFor(() => {
        expect(mockGetTimeLogs).toHaveBeenCalledWith("user-driver");
      });
    });

    it("does not fetch time logs for admin users", async () => {
      render(
        <CompanyProfile
          user={adminUser}
          onUserRegistryChange={onUserRegistryChange}
        />,
      );

      await waitFor(() => {
        expect(mockGetCompany).toHaveBeenCalled();
      });

      expect(mockGetTimeLogs).not.toHaveBeenCalled();
    });
  });
});
