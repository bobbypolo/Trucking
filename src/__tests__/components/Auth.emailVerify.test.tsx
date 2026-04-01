import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
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

vi.mock("../../../services/config", () => ({
  API_URL: "http://localhost:5000/api",
}));

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

const mockCompany = {
  id: "company-1",
  name: "Test Trucking LLC",
  accountType: "owner_operator",
  supportedFreightTypes: ["Dry Van"],
  defaultFreightType: "Dry Van",
  equipmentRegistry: [],
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
  },
  driverPermissions: {},
  ownerOpPermissions: {},
  dispatcherPermissions: {},
} as Company;

describe("Auth email verification notice", () => {
  const onLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  // --- R-AUTH-07: Auth component shows verification notice after signup ---
  // We drive the full signup wizard to trigger processSignup, which sets
  // verificationNotice and navigates back to login view.
  it("# Tests R-AUTH-07 — shows verification notice after signup", async () => {
    mockRegisterCompany.mockResolvedValue({
      user: mockUser,
      company: mockCompany,
    });
    mockUpdateCompany.mockResolvedValue(undefined);

    const user = userEvent.setup();
    render(<Auth onLogin={onLogin} />);

    // Navigate to signup
    await user.click(screen.getByText("Create Account"));

    // Fill signup identity form
    await user.type(screen.getByPlaceholderText("Legal Name"), "Test Admin");
    await user.type(
      screen.getByPlaceholderText("Company Name"),
      "Test Trucking LLC",
    );
    await user.type(screen.getByPlaceholderText("Email"), "admin@test.com");
    await user.type(screen.getByPlaceholderText("Password"), "Password123!");

    // Select account type (Owner Operator is default) and continue
    await user.click(screen.getByText(/Continue Registry/i));

    // Tier selection — Records Vault is pre-selected, submit with "Confirm Tier"
    await waitFor(() => {
      expect(screen.getByText("Choose Your Tier")).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Confirm Tier/i));

    // Regulatory step — fill required fields
    await waitFor(() => {
      expect(screen.getByPlaceholderText("00-0000000")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText("00-0000000"), "12-3456789");
    await user.type(
      screen.getByPlaceholderText("123 Carrier Way"),
      "123 Main St",
    );
    await user.type(screen.getByPlaceholderText("City"), "Chicago");
    await user.type(screen.getByPlaceholderText("State"), "IL");
    await user.type(screen.getByPlaceholderText("ZIP"), "60601");
    await user.click(screen.getByText(/Verify & Next/i));

    // Equipment step — Dry Van pre-selected, just continue
    await waitFor(() => {
      expect(screen.getByText("Step 3: Initial Registry")).toBeInTheDocument();
    });
    await user.click(screen.getByText(/Complete Registry/i));

    // Payment step — click "Start Free Trial" to trigger processSignup
    await waitFor(() => {
      expect(screen.getByText(/Start Free Trial/i)).toBeInTheDocument();
    });
    const trialBtn = screen.getByRole("button", { name: /Start Free Trial/i });
    await user.click(trialBtn);

    // After signup: processSignup sets verificationNotice and view="login"
    await waitFor(
      () => {
        const notice = screen.getByTestId("verification-notice");
        expect(notice).toBeInTheDocument();
        expect(notice.textContent).toBe(
          "Verification email sent. Check your inbox.",
        );
      },
      { timeout: 5000 },
    );

    // onLogin should NOT be called — user must verify email first
    expect(onLogin).not.toHaveBeenCalled();
  });

  // Login error displays verification message from authService
  it("shows verification error when login throws verify error", async () => {
    mockLogin.mockRejectedValue(
      new Error("Please verify your email before logging in."),
    );

    const user = userEvent.setup();
    render(<Auth onLogin={onLogin} />);

    // Fill login form
    await user.type(
      screen.getByPlaceholderText("you@company.com"),
      "unverified@test.com",
    );
    await user.type(
      screen.getByPlaceholderText(
        "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
      ),
      "Password123!",
    );

    // Submit login — use role to find the submit button
    const signInButton = screen.getByRole("button", { name: "Sign In" });
    await user.click(signInButton);

    // Error should contain "verify"
    await waitFor(() => {
      const errorEl = screen.getByRole("alert");
      expect(errorEl.textContent!.toLowerCase()).toContain("verify");
    });

    expect(onLogin).not.toHaveBeenCalled();
  });

  // Negative test: normal login error still shows generic message
  it("shows generic error for non-verification login failures", async () => {
    const firebaseError = new Error("auth error") as any;
    firebaseError.code = "auth/wrong-password";
    mockLogin.mockRejectedValue(firebaseError);

    const user = userEvent.setup();
    render(<Auth onLogin={onLogin} />);

    await user.type(
      screen.getByPlaceholderText("you@company.com"),
      "wrong@test.com",
    );
    await user.type(
      screen.getByPlaceholderText(
        "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
      ),
      "WrongPassword!",
    );

    const signInButton = screen.getByRole("button", { name: "Sign In" });
    await user.click(signInButton);

    await waitFor(() => {
      const errorEl = screen.getByRole("alert");
      expect(errorEl.textContent).toBe("Invalid credentials.");
    });
  });
});
