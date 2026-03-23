// Tests R-P2-05, R-P2-06, R-P2-07
/**
 * Form validation & autocomplete tests for STORY-202.
 * R-P2-05: Required fields show red asterisk or aria-required
 * R-P2-06: Email fields validate format on blur and show inline error
 * R-P2-07: All password inputs have autocomplete='current-password' or 'new-password'
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Auth } from "../../../components/Auth";

vi.mock("../../../services/authService", () => ({
  login: vi.fn(),
  registerCompany: vi.fn(),
  updateCompany: vi.fn(),
  getAuthHeaders: vi.fn().mockResolvedValue({
    "Content-Type": "application/json",
    Authorization: "",
  }),
}));

vi.mock("../../../services/config", () => ({
  API_URL: "http://localhost:5000/api",
}));

vi.mock("uuid", () => ({ v4: () => "mock-uuid" }));

// Clear sessionStorage before each test so wizard state doesn't bleed between tests
beforeEach(() => {
  sessionStorage.clear();
});

// ---------------------------------------------------------------------------
// R-P2-05: Required field indicators
// ---------------------------------------------------------------------------
describe("Auth — R-P2-05: Required field indicators (login form)", () => {
  it("login email input has aria-required=true", () => {
    render(<Auth onLogin={vi.fn()} />);
    const emailInput = screen.getByPlaceholderText("you@company.com");
    expect(emailInput).toHaveAttribute("aria-required", "true");
  });

  it("login password input has aria-required=true", () => {
    render(<Auth onLogin={vi.fn()} />);
    const passwordInput = screen.getByPlaceholderText("••••••••");
    expect(passwordInput).toHaveAttribute("aria-required", "true");
  });

  it("login email input has required attribute", () => {
    render(<Auth onLogin={vi.fn()} />);
    const emailInput = screen.getByPlaceholderText("you@company.com");
    expect(emailInput).toBeRequired();
  });

  it("login password input has required attribute", () => {
    render(<Auth onLogin={vi.fn()} />);
    const passwordInput = screen.getByPlaceholderText("••••••••");
    expect(passwordInput).toBeRequired();
  });
});

describe("Auth — R-P2-05: Required field indicators (signup form)", () => {
  async function renderAndGoToSignup() {
    sessionStorage.clear();
    const user = userEvent.setup();
    render(<Auth onLogin={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() =>
      expect(screen.getByText("Step 1: Identity")).toBeInTheDocument(),
    );
    return user;
  }

  it("Legal Name field shows required indicator (red asterisk in label)", async () => {
    await renderAndGoToSignup();
    const labels = screen.getAllByText(/legal name/i);
    expect(labels.length).toBeGreaterThan(0);
    const labelEl = labels[0].closest("label") ?? labels[0].parentElement;
    expect(labelEl?.innerHTML).toMatch(/text-red-500/);
  });

  it("Email field in signup label shows required indicator", async () => {
    await renderAndGoToSignup();
    const container = screen.getByText("Step 1: Identity").closest("form")!;
    const emailLabel = Array.from(container.querySelectorAll("label")).find(
      (el) => /email/i.test(el.textContent ?? ""),
    );
    expect(emailLabel).toBeDefined();
    expect(emailLabel?.innerHTML).toMatch(/text-red-500/);
  });

  it("Password field in signup label shows required indicator", async () => {
    await renderAndGoToSignup();
    const container = screen.getByText("Step 1: Identity").closest("form")!;
    const passwordLabel = Array.from(container.querySelectorAll("label")).find(
      (el) => /password/i.test(el.textContent ?? ""),
    );
    expect(passwordLabel).toBeDefined();
    expect(passwordLabel?.innerHTML).toMatch(/text-red-500/);
  });
});

// ---------------------------------------------------------------------------
// R-P2-06: Email format validation on blur
// ---------------------------------------------------------------------------
describe("Auth — R-P2-06: Email format validation on blur", () => {
  it("shows inline error when invalid email is entered and field loses focus", async () => {
    const user = userEvent.setup();
    render(<Auth onLogin={vi.fn()} />);
    const emailInput = screen.getByPlaceholderText("you@company.com");

    await user.type(emailInput, "not-an-email");
    await user.tab();

    await waitFor(() => {
      expect(
        screen.getByText("Enter a valid email address."),
      ).toBeInTheDocument();
    });
  });

  it("clears error when valid email is entered", async () => {
    const user = userEvent.setup();
    render(<Auth onLogin={vi.fn()} />);
    const emailInput = screen.getByPlaceholderText("you@company.com");

    await user.type(emailInput, "bad");
    await user.tab();

    await waitFor(() => {
      expect(
        screen.getByText("Enter a valid email address."),
      ).toBeInTheDocument();
    });

    await user.clear(emailInput);
    await user.type(emailInput, "valid@company.com");
    await user.tab();

    await waitFor(() => {
      expect(
        screen.queryByText("Enter a valid email address."),
      ).not.toBeInTheDocument();
    });
  });

  it("does not show error for empty email on blur", async () => {
    const user = userEvent.setup();
    render(<Auth onLogin={vi.fn()} />);
    const emailInput = screen.getByPlaceholderText("you@company.com");

    await user.click(emailInput);
    await user.tab();

    expect(
      screen.queryByText("Enter a valid email address."),
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// R-P2-07: Password autocomplete attributes
// ---------------------------------------------------------------------------
describe("Auth — R-P2-07: Password autocomplete attributes", () => {
  it("login password input has autocomplete=current-password", () => {
    render(<Auth onLogin={vi.fn()} />);
    const passwordInput = screen.getByPlaceholderText("••••••••");
    expect(passwordInput).toHaveAttribute("autocomplete", "current-password");
  });

  it("signup password input has autocomplete=new-password", async () => {
    sessionStorage.clear();
    const user = userEvent.setup();
    render(<Auth onLogin={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() =>
      expect(screen.getByText("Step 1: Identity")).toBeInTheDocument(),
    );

    const passwordInput = screen.getByPlaceholderText("Password");
    expect(passwordInput).toHaveAttribute("autocomplete", "new-password");
  });

  it("login email input has autocomplete=email", () => {
    render(<Auth onLogin={vi.fn()} />);
    const emailInput = screen.getByPlaceholderText("you@company.com");
    expect(emailInput).toHaveAttribute("autocomplete", "email");
  });
});
