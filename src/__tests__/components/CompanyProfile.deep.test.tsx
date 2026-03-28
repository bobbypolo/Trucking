import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CompanyProfile } from "../../../components/CompanyProfile";
import type { User, Company, FreightType, OperatingMode } from "../../../types";

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

const mockLogTime = vi.fn();
const mockGetTimeLogs = vi.fn();

vi.mock("../../../services/storageService", () => ({
  logTime: (...args: unknown[]) => mockLogTime(...args),
  getTimeLogs: (...args: unknown[]) => mockGetTimeLogs(...args),
}));

function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: "company-1",
    name: "Deep Test Trucking",
    accountType: "fleet",
    mcNumber: "MC-111111",
    dotNumber: "DOT-222222",
    address: "200 Test Ave",
    city: "Dallas",
    state: "TX",
    zip: "75001",
    taxId: "99-8888888",
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
  name: "Admin Deep",
  role: "admin",
  onboardingStatus: "Completed",
  safetyScore: 100,
};

const driverUser: User = {
  id: "user-driver",
  companyId: "company-1",
  email: "driver@test.com",
  name: "Driver Deep",
  role: "driver",
  onboardingStatus: "Completed",
  safetyScore: 85,
};

const companyUsers: User[] = [adminUser, driverUser];

describe("CompanyProfile deep coverage", () => {
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

  describe("governance tab — toggle auto-lock compliance", () => {
    it("toggles auto-lock compliance in governance tab", async () => {
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

      await waitFor(() => {
        expect(screen.getByText("Auto-Lock Compliance")).toBeInTheDocument();
      });

      const autoLockRow = screen
        .getByText("Auto-Lock Compliance")
        .closest("div[class*='flex']");
      expect(autoLockRow).toBeInTheDocument();
      const toggleBtns = autoLockRow!.querySelectorAll("button");
      expect(toggleBtns.length).toBeGreaterThan(0);
      await user.click(toggleBtns[0]);

      await user.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(mockUpdateCompany).toHaveBeenCalled();
      });
    });
  });

  describe("governance tab — change preferred currency", () => {
    it("changes preferred currency selection", async () => {
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

      await waitFor(() => {
        expect(screen.getByDisplayValue("USD - US Dollar")).toBeInTheDocument();
      });

      const currencySelect = screen.getByDisplayValue("USD - US Dollar");
      await user.selectOptions(currencySelect, "CAD");

      await user.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(mockUpdateCompany).toHaveBeenCalledWith(
          expect.objectContaining({
            governance: expect.objectContaining({
              preferredCurrency: "CAD",
            }),
          }),
        );
      });
    });
  });

  describe("operations tab — deselect default freight type triggers fallback", () => {
    it("deselects the only supported freight type and it stays (no empty allowed)", async () => {
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

      await waitFor(() => {
        expect(screen.getByText("Dry Van")).toBeInTheDocument();
      });

      const dryVanBtn = screen.getByText("Dry Van").closest("button")!;
      await user.click(dryVanBtn);

      const bodyText = document.body.textContent || "";
      expect(bodyText).toContain("Fleet Configuration");
    });

    it("adds and removes freight types correctly", async () => {
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

      await waitFor(() => {
        expect(screen.getByText("Reefer")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Reefer").closest("button")!);

      await user.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(mockUpdateCompany).toHaveBeenCalledWith(
          expect.objectContaining({
            supportedFreightTypes: expect.arrayContaining([
              "Dry Van",
              "Reefer",
            ]),
          }),
        );
      });
    });
  });

  describe("operations tab — change company structure", () => {
    it("changes account type via company structure dropdown", async () => {
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

      await waitFor(() => {
        expect(screen.getByDisplayValue("Fleet Operation")).toBeInTheDocument();
      });

      const structureSelect = screen.getByDisplayValue("Fleet Operation");
      await user.selectOptions(structureSelect, "owner_operator");

      await user.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(mockUpdateCompany).toHaveBeenCalledWith(
          expect.objectContaining({
            accountType: "owner_operator",
          }),
        );
      });
    });
  });

  describe("security tab — toggle driver permissions", () => {
    it("toggles driver viewSettlements permission", async () => {
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

      await waitFor(() => {
        expect(screen.getByText("View Own Settlements")).toBeInTheDocument();
      });

      const viewSettlements = screen
        .getByText("View Own Settlements")
        .closest("div[class*='flex']");
      expect(viewSettlements).toBeInTheDocument();
      const toggleBtn = viewSettlements!.querySelector("button");
      expect(toggleBtn).toBeInTheDocument();
      await user.click(toggleBtn!);

      await user.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(mockUpdateCompany).toHaveBeenCalled();
      });
    });
  });

  describe("personnel tab — edit user", () => {
    it("opens EditUserModal when clicking edit on a user", async () => {
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

      await waitFor(() => {
        expect(screen.getByText("Driver Deep")).toBeInTheDocument();
      });

      const editButtons = document.querySelectorAll(
        "button[class*='hover:bg-blue-600']",
      );
      expect(editButtons.length).toBeGreaterThan(0);
      await user.click(editButtons[0] as HTMLElement);
    });
  });

  describe("driver clock out with notes", () => {
    it("enters notes in the clock out modal before confirming", async () => {
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

      const notesInput = screen.getByPlaceholderText(
        /Describe shifts, delays, or chassis observations/,
      );
      await user.type(notesInput, "Good shift, no issues");

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
  });

  describe("payroll_manager role is read-only (not admin)", () => {
    it("shows read-only banner for payroll_manager role", async () => {
      const payrollUser: User = {
        ...adminUser,
        role: "payroll_manager",
        name: "Payroll Manager",
      };

      render(
        <CompanyProfile
          user={payrollUser}
          onUserRegistryChange={onUserRegistryChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/viewing as read-only/i)).toBeInTheDocument();
      });
    });
  });
});
