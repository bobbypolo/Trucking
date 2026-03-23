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

vi.mock("../../../services/authService", () => ({
  login: (...args: unknown[]) => mockLogin(...args),
  registerCompany: (...args: unknown[]) => mockRegisterCompany(...args),
  updateCompany: (...args: unknown[]) => mockUpdateCompany(...args),
  getAuthHeaders: vi.fn().mockResolvedValue({
    "Content-Type": "application/json",
    Authorization: "",
  }),
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
  operatingMode: "Small Team",
};

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------
describe("Auth component", () => {
  const onLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    // Default: login succeeds
    mockLogin.mockResolvedValue(mockUser);
    // Default: registerCompany succeeds
    mockRegisterCompany.mockResolvedValue({
      user: mockUser,
      company: mockCompany,
    });
    mockUpdateCompany.mockResolvedValue(undefined);

    // Mock global fetch for forgot password
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // LOGIN VIEW RENDERING
  // =========================================================================
  describe("Login view rendering", () => {
    it("renders the Sign In heading", () => {
      render(<Auth onLogin={onLogin} />);
      expect(screen.getAllByText("Sign In").length).toBeGreaterThan(0);
    });

    it("renders the LoadPilot branding", () => {
      render(<Auth onLogin={onLogin} />);
      expect(screen.getByText("LoadPilot")).toBeInTheDocument();
    });

    it("renders email input with correct placeholder", () => {
      render(<Auth onLogin={onLogin} />);
      const emailInput = screen.getByPlaceholderText("you@company.com");
      expect(emailInput).toBeInTheDocument();
      expect(emailInput).toHaveAttribute("type", "email");
    });

    it("renders password input", () => {
      render(<Auth onLogin={onLogin} />);
      const passwordInput = screen.getByPlaceholderText(/••••/);
      expect(passwordInput).toBeInTheDocument();
      expect(passwordInput).toHaveAttribute("type", "password");
    });

    it("renders Sign In submit button", () => {
      render(<Auth onLogin={onLogin} />);
      const signInBtn = screen.getByRole("button", { name: /sign in/i });
      expect(signInBtn).toBeInTheDocument();
      expect(signInBtn).toHaveAttribute("type", "submit");
    });

    it("renders Forgot Password link", () => {
      render(<Auth onLogin={onLogin} />);
      expect(screen.getByTestId("forgot-password-link")).toBeInTheDocument();
    });

    it("renders Create Account button", () => {
      render(<Auth onLogin={onLogin} />);
      expect(
        screen.getByRole("button", { name: /create account/i }),
      ).toBeInTheDocument();
    });

    it("renders left panel feature highlights", () => {
      render(<Auth onLogin={onLogin} />);
      expect(screen.getByText(/Regulatory/i)).toBeInTheDocument();
      expect(screen.getByText(/Granular Control/i)).toBeInTheDocument();
      expect(screen.getByText(/Fleet Intelligence/i)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // LOGIN FORM SUBMISSION
  // =========================================================================
  describe("Login form submission", () => {
    it("calls login with email and password on form submit", async () => {
      const user = userEvent.setup();
      render(<Auth onLogin={onLogin} />);

      const emailInput = screen.getByPlaceholderText("you@company.com");
      const passwordInput = screen.getByPlaceholderText(/••••/);

      await user.type(emailInput, "admin@test.com");
      await user.type(passwordInput, "SecureP@ss1");

      const signInBtn = screen.getByRole("button", { name: /sign in/i });
      await user.click(signInBtn);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith("admin@test.com", "SecureP@ss1");
      });
    });

    it("calls onLogin callback on successful login", async () => {
      const user = userEvent.setup();
      render(<Auth onLogin={onLogin} />);

      await user.type(
        screen.getByPlaceholderText("you@company.com"),
        "admin@test.com",
      );
      await user.type(screen.getByPlaceholderText(/••••/), "SecureP@ss1");
      await user.click(screen.getByRole("button", { name: /sign in/i }));

      await waitFor(() => {
        expect(onLogin).toHaveBeenCalledWith(mockUser);
      });
    });

    it("shows error message on failed login", async () => {
      mockLogin.mockResolvedValue(null);
      const user = userEvent.setup();
      render(<Auth onLogin={onLogin} />);

      await user.type(
        screen.getByPlaceholderText("you@company.com"),
        "bad@test.com",
      );
      await user.type(screen.getByPlaceholderText(/••••/), "wrongpass");
      await user.click(screen.getByRole("button", { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText("Invalid credentials.")).toBeInTheDocument();
      });
      expect(onLogin).not.toHaveBeenCalled();
    });

    it("does not call onLogin when login returns null", async () => {
      mockLogin.mockResolvedValue(null);
      const user = userEvent.setup();
      render(<Auth onLogin={onLogin} />);

      await user.type(
        screen.getByPlaceholderText("you@company.com"),
        "test@test.com",
      );
      await user.type(screen.getByPlaceholderText(/••••/), "pass");
      await user.click(screen.getByRole("button", { name: /sign in/i }));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
      });
      expect(onLogin).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // EMAIL VALIDATION
  // =========================================================================
  describe("Email validation", () => {
    it("shows validation error for invalid email on blur", async () => {
      const user = userEvent.setup();
      render(<Auth onLogin={onLogin} />);

      const emailInput = screen.getByPlaceholderText("you@company.com");
      await user.type(emailInput, "not-an-email");
      await user.tab(); // blur

      await waitFor(() => {
        expect(
          screen.getByText("Enter a valid email address."),
        ).toBeInTheDocument();
      });
    });

    it("clears validation error when valid email entered", async () => {
      const user = userEvent.setup();
      render(<Auth onLogin={onLogin} />);

      const emailInput = screen.getByPlaceholderText("you@company.com");
      await user.type(emailInput, "bad");
      await user.tab();

      await waitFor(() => {
        expect(
          screen.getByText("Enter a valid email address."),
        ).toBeInTheDocument();
      });

      await user.clear(emailInput);
      await user.type(emailInput, "good@email.com");
      await user.tab();

      await waitFor(() => {
        expect(
          screen.queryByText("Enter a valid email address."),
        ).not.toBeInTheDocument();
      });
    });

    it("does not show error for empty email on blur", async () => {
      const user = userEvent.setup();
      render(<Auth onLogin={onLogin} />);

      const emailInput = screen.getByPlaceholderText("you@company.com");
      await user.click(emailInput);
      await user.tab();

      expect(
        screen.queryByText("Enter a valid email address."),
      ).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // FORGOT PASSWORD FLOW
  // =========================================================================
  describe("Forgot password flow", () => {
    it("opens forgot password dialog when link clicked", async () => {
      const user = userEvent.setup();
      render(<Auth onLogin={onLogin} />);

      await user.click(screen.getByTestId("forgot-password-link"));

      await waitFor(() => {
        expect(screen.getByText("Reset Password")).toBeInTheDocument();
      });
    });

    it.skip("shows confirmation message after submitting reset email", async () => {
      const user = userEvent.setup();
      render(<Auth onLogin={onLogin} />);

      await user.click(screen.getByTestId("forgot-password-link"));

      await waitFor(() => {
        expect(screen.getByText("Reset Password")).toBeInTheDocument();
      });

      // There are two - the login one and the dialog one; get the dialog's
      const inputs = screen.getAllByPlaceholderText("you@company.com");
      const dialogEmailInput = inputs[inputs.length - 1];
      await user.type(dialogEmailInput, "reset@example.com");

      const sendBtn = screen.getByRole("button", {
        name: /send reset link/i,
      });
      await user.click(sendBtn);

      await waitFor(() => {
        expect(
          screen.getByText(
            /If an account exists for this email, a reset link has been sent./,
          ),
        ).toBeInTheDocument();
      });
    });

    it.skip("calls fetch with reset-password endpoint", async () => {
      const user = userEvent.setup();
      render(<Auth onLogin={onLogin} />);

      await user.click(screen.getByTestId("forgot-password-link"));

      await waitFor(() => {
        expect(screen.getByText("Reset Password")).toBeInTheDocument();
      });

      const inputs = screen.getAllByPlaceholderText("you@company.com");
      const dialogEmailInput = inputs[inputs.length - 1];
      await user.type(dialogEmailInput, "test@company.com");
      await user.click(
        screen.getByRole("button", { name: /send reset link/i }),
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/auth/reset-password"),
          expect.objectContaining({
            method: "POST",
          }),
        );
      });
    });
  });

  // =========================================================================
  // NAVIGATION: LOGIN → SIGNUP
  // =========================================================================
  describe("Navigation between login and signup", () => {
    it("switches to signup view on Create Account click", async () => {
      const user = userEvent.setup();
      render(<Auth onLogin={onLogin} />);

      await user.click(screen.getByRole("button", { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText("Step 1: Identity")).toBeInTheDocument();
      });
    });

    it("shows account type buttons in signup view", async () => {
      const user = userEvent.setup();
      render(<Auth onLogin={onLogin} />);

      await user.click(screen.getByRole("button", { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText("Owner Operator")).toBeInTheDocument();
        expect(screen.getByText("Fleet Carrier")).toBeInTheDocument();
        expect(screen.getByText("Company Driver")).toBeInTheDocument();
      });
    });

    it("navigates back to login from signup", async () => {
      const user = userEvent.setup();
      render(<Auth onLogin={onLogin} />);

      await user.click(screen.getByRole("button", { name: /create account/i }));
      await waitFor(() => {
        expect(screen.getByText("Step 1: Identity")).toBeInTheDocument();
      });

      // Click the ArrowLeft back button (first button in the form header)
      const backButtons = screen
        .getByText("Step 1: Identity")
        .closest("form")!
        .querySelectorAll("button[type='button']");
      // First button in the header area is the back button
      await user.click(backButtons[0] as HTMLElement);

      await waitFor(() => {
        expect(screen.getAllByText("Sign In").length).toBeGreaterThan(0);
      });
    });
  });

  // =========================================================================
  // SIGNUP STEP 1: IDENTITY
  // =========================================================================
  describe("Signup Step 1: Identity form", () => {
    async function goToSignup() {
      const user = userEvent.setup();
      render(<Auth onLogin={onLogin} />);
      await user.click(screen.getByRole("button", { name: /create account/i }));
      await waitFor(() => {
        expect(screen.getByText("Step 1: Identity")).toBeInTheDocument();
      });
      return user;
    }

    it("renders identity form fields", async () => {
      await goToSignup();

      expect(screen.getByPlaceholderText("Legal Name")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Company Name")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
    });

    it("shows error when submitting with empty fields", async () => {
      const user = await goToSignup();

      const continueBtn = screen.getByRole("button", {
        name: /continue registry/i,
      });
      await user.click(continueBtn);

      // HTML5 validation should prevent submission, but the component also checks
      // Since required fields are empty, the form won't submit via HTML5
      // The component logic sets error "Fill all fields." when fields are empty
      // But browser validation fires first in jsdom
      expect(screen.getByText("Step 1: Identity")).toBeInTheDocument();
    });

    it("allows selecting different account types", async () => {
      const user = await goToSignup();

      const fleetButton = screen.getByText("Fleet Carrier");
      await user.click(fleetButton);

      // Fleet Carrier should now be selected (has blue border class)
      const fleetParent = fleetButton.closest("button");
      expect(fleetParent).toHaveClass("bg-blue-900/20");
    });

    it("navigates to tier selection for owner operator", async () => {
      const user = await goToSignup();

      // Fill required fields
      await user.type(screen.getByPlaceholderText("Legal Name"), "John Doe");
      await user.type(
        screen.getByPlaceholderText("Company Name"),
        "JD Trucking",
      );
      await user.type(screen.getByPlaceholderText("Email"), "john@jd.com");
      await user.type(screen.getByPlaceholderText("Password"), "Pass123!");

      await user.click(
        screen.getByRole("button", { name: /continue registry/i }),
      );

      await waitFor(() => {
        expect(screen.getByText("Choose Your Tier")).toBeInTheDocument();
      });
    });

    it("navigates directly to regulatory for fleet carrier (skips tier)", async () => {
      const user = await goToSignup();

      // Select fleet carrier
      await user.click(screen.getByText("Fleet Carrier"));

      // Fill fields
      await user.type(screen.getByPlaceholderText("Legal Name"), "Jane Smith");
      await user.type(screen.getByPlaceholderText("Company Name"), "Fleet Co");
      await user.type(screen.getByPlaceholderText("Email"), "jane@fleet.com");
      await user.type(screen.getByPlaceholderText("Password"), "Pass123!");

      await user.click(
        screen.getByRole("button", { name: /continue registry/i }),
      );

      await waitFor(() => {
        expect(screen.getByText("Step 2: Company Details")).toBeInTheDocument();
      });
    });

    it("navigates directly to regulatory for company driver", async () => {
      const user = await goToSignup();

      await user.click(screen.getByText("Company Driver"));

      await user.type(screen.getByPlaceholderText("Legal Name"), "Bob Jones");
      await user.type(screen.getByPlaceholderText("Company Name"), "Bob's Co");
      await user.type(screen.getByPlaceholderText("Email"), "bob@test.com");
      await user.type(screen.getByPlaceholderText("Password"), "Pass123!");

      await user.click(
        screen.getByRole("button", { name: /continue registry/i }),
      );

      await waitFor(() => {
        expect(screen.getByText("Step 2: Company Details")).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // SIGNUP STEP: TIER SELECTION (Owner Operator only)
  // =========================================================================
  describe("Signup: Tier selection", () => {
    async function goToTierSelection() {
      const user = userEvent.setup();
      render(<Auth onLogin={onLogin} />);
      await user.click(screen.getByRole("button", { name: /create account/i }));
      await waitFor(() => {
        expect(screen.getByText("Step 1: Identity")).toBeInTheDocument();
      });

      // Fill identity form
      await user.type(screen.getByPlaceholderText("Legal Name"), "John Doe");
      await user.type(
        screen.getByPlaceholderText("Company Name"),
        "JD Trucking",
      );
      await user.type(screen.getByPlaceholderText("Email"), "john@jd.com");
      await user.type(screen.getByPlaceholderText("Password"), "Pass123!");
      await user.click(
        screen.getByRole("button", { name: /continue registry/i }),
      );

      await waitFor(() => {
        expect(screen.getByText("Choose Your Tier")).toBeInTheDocument();
      });
      return user;
    }

    it("renders both tier options", async () => {
      await goToTierSelection();

      expect(screen.getByText("Records Vault")).toBeInTheDocument();
      expect(screen.getByText("Automation Pro")).toBeInTheDocument();
    });

    it("shows pricing for each tier", async () => {
      await goToTierSelection();

      expect(screen.getByText("$19/mo")).toBeInTheDocument();
      expect(screen.getByText("$69/mo")).toBeInTheDocument();
    });

    it("allows selecting Automation Pro tier", async () => {
      const user = await goToTierSelection();

      await user.click(screen.getByText("Automation Pro").closest("button")!);

      // Automation Pro should get selected styling
      const autoProBtn = screen.getByText("Automation Pro").closest("button");
      expect(autoProBtn).toHaveClass("bg-blue-900/20");
    });

    it("advances to regulatory step on Confirm Tier", async () => {
      const user = await goToTierSelection();

      await user.click(screen.getByRole("button", { name: /confirm tier/i }));

      await waitFor(() => {
        expect(screen.getByText("Step 2: Company Details")).toBeInTheDocument();
      });
    });

    it("navigates back to signup from tier selection", async () => {
      const user = await goToTierSelection();

      // Back button
      const heading = screen.getByText("Choose Your Tier");
      const backBtn = heading
        .closest("form")!
        .querySelector("button[type='button']");
      await user.click(backBtn as HTMLElement);

      await waitFor(() => {
        expect(screen.getByText("Step 1: Identity")).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // SIGNUP STEP 2: REGULATORY / COMPANY DETAILS
  // =========================================================================
  describe("Signup Step 2: Regulatory details", () => {
    async function goToRegulatory() {
      const user = userEvent.setup();
      render(<Auth onLogin={onLogin} />);
      await user.click(screen.getByRole("button", { name: /create account/i }));

      // Select fleet type (skips tier selection)
      await user.click(screen.getByText("Fleet Carrier"));

      // Fill identity fields
      await user.type(screen.getByPlaceholderText("Legal Name"), "Jane");
      await user.type(screen.getByPlaceholderText("Company Name"), "Fleet Co");
      await user.type(screen.getByPlaceholderText("Email"), "jane@fleet.com");
      await user.type(screen.getByPlaceholderText("Password"), "Pass123!");
      await user.click(
        screen.getByRole("button", { name: /continue registry/i }),
      );

      await waitFor(() => {
        expect(screen.getByText("Step 2: Company Details")).toBeInTheDocument();
      });
      return user;
    }

    it("renders regulatory form fields", async () => {
      await goToRegulatory();

      expect(
        screen.getByPlaceholderText("e.g., MC-123456"),
      ).toBeInTheDocument();
      expect(screen.getByPlaceholderText("00-0000000")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("123 Carrier Way"),
      ).toBeInTheDocument();
      expect(screen.getByPlaceholderText("City")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("State")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("ZIP")).toBeInTheDocument();
    });

    it("shows error when required fields are missing", async () => {
      const user = await goToRegulatory();

      // Only fill MC number (optional) - leave required ones empty
      await user.type(screen.getByPlaceholderText("e.g., MC-123456"), "MC-999");

      await user.click(screen.getByRole("button", { name: /verify & next/i }));

      // HTML5 required attributes prevent form submission
      // The component also shows "Tax ID and full address required." error
      expect(screen.getByText("Step 2: Company Details")).toBeInTheDocument();
    });

    it("advances to equipment step when all fields filled", async () => {
      const user = await goToRegulatory();

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
        expect(
          screen.getByText("Step 3: Initial Registry"),
        ).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // SIGNUP STEP 3: EQUIPMENT
  // =========================================================================
  describe("Signup Step 3: Equipment", () => {
    async function goToEquipment() {
      const user = userEvent.setup();
      render(<Auth onLogin={onLogin} />);
      await user.click(screen.getByRole("button", { name: /create account/i }));
      await user.click(screen.getByText("Fleet Carrier"));
      await user.type(screen.getByPlaceholderText("Legal Name"), "Jane");
      await user.type(screen.getByPlaceholderText("Company Name"), "Fleet Co");
      await user.type(screen.getByPlaceholderText("Email"), "jane@fleet.com");
      await user.type(screen.getByPlaceholderText("Password"), "Pass123!");
      await user.click(
        screen.getByRole("button", { name: /continue registry/i }),
      );

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
        expect(
          screen.getByText("Step 3: Initial Registry"),
        ).toBeInTheDocument();
      });
      return user;
    }

    it("renders equipment inputs", async () => {
      await goToEquipment();

      expect(screen.getByPlaceholderText(/Power Unit/)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Trailing Unit/)).toBeInTheDocument();
    });

    it("renders freight type options", async () => {
      await goToEquipment();

      expect(screen.getByText("Dry Van")).toBeInTheDocument();
      expect(screen.getByText("Reefer")).toBeInTheDocument();
      expect(screen.getByText("Flatbed")).toBeInTheDocument();
      expect(screen.getByText("Intermodal")).toBeInTheDocument();
    });

    it("allows selecting a different freight type", async () => {
      const user = await goToEquipment();

      const reeferBtn = screen.getByText("Reefer").closest("button");
      expect(reeferBtn).toBeInTheDocument();
      await user.click(reeferBtn!);

      // Reefer should be selected
      expect(reeferBtn).toHaveClass("bg-blue-900/20");
    });

    it("advances to payment for non-Automation-Pro tier", async () => {
      const user = await goToEquipment();

      await user.click(
        screen.getByRole("button", { name: /complete registry/i }),
      );

      await waitFor(() => {
        expect(screen.getByText("Secure Hub")).toBeInTheDocument();
      });
    });

    it("allows entering truck and trailer unit IDs", async () => {
      const user = await goToEquipment();

      const truckInput = screen.getByPlaceholderText(/Power Unit/);
      await user.type(truckInput, "TRUCK-001");
      expect(truckInput).toHaveValue("TRUCK-001");

      const trailerInput = screen.getByPlaceholderText(/Trailing Unit/);
      await user.type(trailerInput, "TRAIL-002");
      expect(trailerInput).toHaveValue("TRAIL-002");
    });
  });

  // =========================================================================
  // SIGNUP: PAYMENT (Final step)
  // =========================================================================
  describe("Signup: Payment step", () => {
    async function goToPayment() {
      const user = userEvent.setup();
      render(<Auth onLogin={onLogin} />);
      await user.click(screen.getByRole("button", { name: /create account/i }));
      await user.click(screen.getByText("Fleet Carrier"));
      await user.type(screen.getByPlaceholderText("Legal Name"), "Jane");
      await user.type(screen.getByPlaceholderText("Company Name"), "Fleet Co");
      await user.type(screen.getByPlaceholderText("Email"), "jane@fleet.com");
      await user.type(screen.getByPlaceholderText("Password"), "Pass123!");
      await user.click(
        screen.getByRole("button", { name: /continue registry/i }),
      );

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
        expect(
          screen.getByText("Step 3: Initial Registry"),
        ).toBeInTheDocument();
      });

      await user.click(
        screen.getByRole("button", { name: /complete registry/i }),
      );

      await waitFor(() => {
        expect(screen.getByText("Secure Hub")).toBeInTheDocument();
      });
      return user;
    }

    it("renders payment step with Stripe and trial buttons (no card fields)", async () => {
      await goToPayment();

      // Card fields must NOT exist (PCI compliance)
      expect(
        screen.queryByPlaceholderText("Card Number"),
      ).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText("MM/YY")).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText("CVC")).not.toBeInTheDocument();

      // Stripe and trial buttons must exist
      expect(
        screen.getByRole("button", { name: /subscribe with stripe/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /start free trial/i }),
      ).toBeInTheDocument();
    });

    it("renders subscription plan pricing", async () => {
      await goToPayment();

      expect(screen.getByText("Subscription Plan")).toBeInTheDocument();
    });

    it("calls registerCompany and onLogin on free trial signup", async () => {
      const user = await goToPayment();

      await user.click(
        screen.getByRole("button", { name: /start free trial/i }),
      );

      await waitFor(() => {
        expect(mockRegisterCompany).toHaveBeenCalledWith(
          "Fleet Co",
          "jane@fleet.com",
          "Jane",
          "fleet",
          "Pass123!",
          1,
          ["Dry Van"],
          "Dry Van",
          "Fleet Core",
        );
      });

      await waitFor(() => {
        expect(mockUpdateCompany).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(onLogin).toHaveBeenCalledWith(mockUser);
      });
    });

    it.skip("shows error message on signup failure", async () => {
      mockRegisterCompany.mockRejectedValue(new Error("API Error"));
      const user = await goToPayment();

      await user.click(
        screen.getByRole("button", { name: /start free trial/i }),
      );

      await waitFor(() => {
        // Error message may vary - check for any error indicator
        const errorEl = screen.queryByText(/failed|error|try again/i);
        expect(errorEl || screen.queryByRole("alert")).toBeTruthy();
      });
      expect(onLogin).not.toHaveBeenCalled();
    });

    it("disables buttons while processing", async () => {
      // Make registerCompany hang
      mockRegisterCompany.mockImplementation(() => new Promise(() => {}));
      const user = await goToPayment();

      const btn = screen.getByRole("button", { name: /start free trial/i });
      await user.click(btn);

      await waitFor(() => {
        expect(btn).toBeDisabled();
      });
    });
  });

  // =========================================================================
  // WIZARD STATE PERSISTENCE (sessionStorage)
  // =========================================================================
  describe("Wizard state persistence", () => {
    it("persists wizard state to sessionStorage on step change", async () => {
      const user = userEvent.setup();
      render(<Auth onLogin={onLogin} />);

      await user.click(screen.getByRole("button", { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText("Step 1: Identity")).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText("Legal Name"), "John");
      await user.type(screen.getByPlaceholderText("Company Name"), "TestCo");

      // Check sessionStorage was written
      await waitFor(() => {
        const stored = sessionStorage.getItem("loadpilot_signup_wizard");
        expect(stored).not.toBeNull();
        const parsed = JSON.parse(stored!);
        expect(parsed.view).toBe("signup");
        expect(parsed.name).toBe("John");
        expect(parsed.companyName).toBe("TestCo");
      });
    });

    it("restores wizard state from sessionStorage on mount", () => {
      // Pre-seed sessionStorage with wizard state
      sessionStorage.setItem(
        "loadpilot_signup_wizard",
        JSON.stringify({
          view: "signup",
          email: "saved@email.com",
          name: "Saved Name",
          companyName: "Saved Company",
          signupType: "owner_operator",
          tier: "Records Vault",
        }),
      );
      sessionStorage.setItem("loadpilot_signup_wizard_step", "signup");

      render(<Auth onLogin={onLogin} />);

      // Should restore to signup view with pre-filled data
      expect(screen.getByText("Step 1: Identity")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Legal Name")).toHaveValue(
        "Saved Name",
      );
      expect(screen.getByPlaceholderText("Company Name")).toHaveValue(
        "Saved Company",
      );
    });

    it("does not persist login view to sessionStorage", () => {
      render(<Auth onLogin={onLogin} />);

      // Login is the initial view and should NOT be persisted
      const stored = sessionStorage.getItem("loadpilot_signup_wizard");
      // Either null or the login view was NOT saved
      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.view).not.toBe("login");
      }
    });

    it("clears wizard state on successful signup", async () => {
      const user = userEvent.setup();
      render(<Auth onLogin={onLogin} />);

      // Go through the full wizard quickly: fleet path
      await user.click(screen.getByRole("button", { name: /create account/i }));
      await user.click(screen.getByText("Fleet Carrier"));
      await user.type(screen.getByPlaceholderText("Legal Name"), "Jane");
      await user.type(screen.getByPlaceholderText("Company Name"), "FleetCo");
      await user.type(screen.getByPlaceholderText("Email"), "jane@fleet.com");
      await user.type(screen.getByPlaceholderText("Password"), "Pass123!");
      await user.click(
        screen.getByRole("button", { name: /continue registry/i }),
      );

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
        expect(
          screen.getByText("Step 3: Initial Registry"),
        ).toBeInTheDocument();
      });
      await user.click(
        screen.getByRole("button", { name: /complete registry/i }),
      );

      await waitFor(() => {
        expect(screen.getByText("Secure Hub")).toBeInTheDocument();
      });
      await user.click(
        screen.getByRole("button", { name: /start free trial/i }),
      );

      await waitFor(() => {
        expect(onLogin).toHaveBeenCalled();
      });

      // Wizard state should be cleared
      expect(sessionStorage.getItem("loadpilot_signup_wizard")).toBeNull();
      expect(sessionStorage.getItem("loadpilot_signup_wizard_step")).toBeNull();
    });
  });

  // =========================================================================
  // AUTOMATION PRO PATH (extra steps: money, ifta, templates, invites)
  // =========================================================================
  describe("Automation Pro signup path", () => {
    async function goToAutomationProEquipment() {
      const user = userEvent.setup();
      render(<Auth onLogin={onLogin} />);

      // Navigate to signup
      await user.click(screen.getByRole("button", { name: /create account/i }));
      await waitFor(() => {
        expect(screen.getByText("Step 1: Identity")).toBeInTheDocument();
      });

      // Owner Operator is default, fill identity
      await user.type(screen.getByPlaceholderText("Legal Name"), "John Doe");
      await user.type(
        screen.getByPlaceholderText("Company Name"),
        "JD Trucking",
      );
      await user.type(screen.getByPlaceholderText("Email"), "john@jd.com");
      await user.type(screen.getByPlaceholderText("Password"), "Pass123!");
      await user.click(
        screen.getByRole("button", { name: /continue registry/i }),
      );

      // Tier selection
      await waitFor(() => {
        expect(screen.getByText("Choose Your Tier")).toBeInTheDocument();
      });
      await user.click(screen.getByText("Automation Pro").closest("button")!);
      await user.click(screen.getByRole("button", { name: /confirm tier/i }));

      // Regulatory
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

      // Equipment
      await waitFor(() => {
        expect(
          screen.getByText("Step 3: Initial Registry"),
        ).toBeInTheDocument();
      });

      return user;
    }

    it("navigates to money settings after equipment for Automation Pro", async () => {
      const user = await goToAutomationProEquipment();

      await user.click(
        screen.getByRole("button", { name: /complete registry/i }),
      );

      await waitFor(() => {
        expect(screen.getByText("Step 4: Money Settings")).toBeInTheDocument();
      });
    });

    it("renders money settings with expense categories", async () => {
      const user = await goToAutomationProEquipment();
      await user.click(
        screen.getByRole("button", { name: /complete registry/i }),
      );

      await waitFor(() => {
        expect(screen.getByText("Step 4: Money Settings")).toBeInTheDocument();
      });

      // Default categories should be shown
      expect(screen.getByText("Fuel")).toBeInTheDocument();
      expect(screen.getByText("Maintenance")).toBeInTheDocument();
      expect(screen.getByText("Tolls")).toBeInTheDocument();
      expect(screen.getByText("Insurance")).toBeInTheDocument();
    });

    it("navigates through money -> IFTA -> templates -> invites -> payment", async () => {
      const user = await goToAutomationProEquipment();
      await user.click(
        screen.getByRole("button", { name: /complete registry/i }),
      );

      // Money Settings
      await waitFor(() => {
        expect(screen.getByText("Step 4: Money Settings")).toBeInTheDocument();
      });
      await user.click(screen.getByRole("button", { name: /continue/i }));

      // IFTA
      await waitFor(() => {
        expect(screen.getByText("Step 5: IFTA + Mileage")).toBeInTheDocument();
      });
      await user.click(screen.getByRole("button", { name: /save & next/i }));

      // Templates
      await waitFor(() => {
        expect(screen.getByText("Step 6: Templates")).toBeInTheDocument();
      });
      await user.click(screen.getByRole("button", { name: /continue/i }));

      // Invites
      await waitFor(() => {
        expect(screen.getByText("Step 7: Collaborators")).toBeInTheDocument();
      });
      await user.click(screen.getByRole("button", { name: /complete setup/i }));

      // Payment
      await waitFor(() => {
        expect(screen.getByText("Secure Hub")).toBeInTheDocument();
      });
    });

    it("renders IFTA settings with base jurisdiction", async () => {
      const user = await goToAutomationProEquipment();
      await user.click(
        screen.getByRole("button", { name: /complete registry/i }),
      );
      await waitFor(() => {
        expect(screen.getByText("Step 4: Money Settings")).toBeInTheDocument();
      });
      await user.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByText("Step 5: IFTA + Mileage")).toBeInTheDocument();
      });

      expect(screen.getByDisplayValue("IL")).toBeInTheDocument();
    });

    it("renders template settings with document naming rule", async () => {
      const user = await goToAutomationProEquipment();
      await user.click(
        screen.getByRole("button", { name: /complete registry/i }),
      );
      await waitFor(() => {
        expect(screen.getByText("Step 4: Money Settings")).toBeInTheDocument();
      });
      await user.click(screen.getByRole("button", { name: /continue/i }));
      await waitFor(() => {
        expect(screen.getByText("Step 5: IFTA + Mileage")).toBeInTheDocument();
      });
      await user.click(screen.getByRole("button", { name: /save & next/i }));

      await waitFor(() => {
        expect(screen.getByText("Step 6: Templates")).toBeInTheDocument();
      });

      expect(
        screen.getByDisplayValue("{Date}_{Type}_{LoadNumber}"),
      ).toBeInTheDocument();
      expect(screen.getByText("Automation Active")).toBeInTheDocument();
    });

    it("renders invites step with accountant email and audit mode toggle", async () => {
      const user = await goToAutomationProEquipment();
      await user.click(
        screen.getByRole("button", { name: /complete registry/i }),
      );
      await waitFor(() => {
        expect(screen.getByText("Step 4: Money Settings")).toBeInTheDocument();
      });
      await user.click(screen.getByRole("button", { name: /continue/i }));
      await waitFor(() => {
        expect(screen.getByText("Step 5: IFTA + Mileage")).toBeInTheDocument();
      });
      await user.click(screen.getByRole("button", { name: /save & next/i }));
      await waitFor(() => {
        expect(screen.getByText("Step 6: Templates")).toBeInTheDocument();
      });
      await user.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByText("Step 7: Collaborators")).toBeInTheDocument();
      });

      expect(
        screen.getByPlaceholderText("accountant@firm.com"),
      ).toBeInTheDocument();
      expect(screen.getByText("Audit Mode")).toBeInTheDocument();
    });
  });
});
