import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// Tests R-W2-02a, R-W2-02b, R-W2-02c

vi.mock("../../../../services/authService", () => ({
  logout: vi.fn().mockResolvedValue(undefined),
}));

import { SessionExpiredModal } from "../../../../components/ui/SessionExpiredModal";
import { logout } from "../../../../services/authService";

describe("SessionExpiredModal", () => {
  const mockOnNavigateToLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // R-W2-02a: renders with correct aria roles
  it("renders with role=alertdialog and aria-modal=true", () => {
    render(
      <SessionExpiredModal
        open={true}
        onNavigateToLogin={mockOnNavigateToLogin}
      />,
    );
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });

  it("renders the session expired heading", () => {
    render(
      <SessionExpiredModal
        open={true}
        onNavigateToLogin={mockOnNavigateToLogin}
      />,
    );
    expect(screen.getByText(/session has expired/i)).toBeTruthy();
  });

  it("renders Sign In button", () => {
    render(
      <SessionExpiredModal
        open={true}
        onNavigateToLogin={mockOnNavigateToLogin}
      />,
    );
    expect(screen.getByRole("button", { name: /sign in/i })).toBeTruthy();
  });

  it("does not render when open=false", () => {
    render(
      <SessionExpiredModal
        open={false}
        onNavigateToLogin={mockOnNavigateToLogin}
      />,
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  // R-W2-02b: clicking Sign In calls logout and onNavigateToLogin
  it("calls logout and onNavigateToLogin when Sign In is clicked", async () => {
    render(
      <SessionExpiredModal
        open={true}
        onNavigateToLogin={mockOnNavigateToLogin}
      />,
    );

    const signInBtn = screen.getByRole("button", { name: /sign in/i });
    fireEvent.click(signInBtn);

    // Allow async operations to complete
    await vi.waitFor(() => {
      expect(logout).toHaveBeenCalledTimes(1);
    });
    await vi.waitFor(() => {
      expect(mockOnNavigateToLogin).toHaveBeenCalledTimes(1);
    });
  });
});
