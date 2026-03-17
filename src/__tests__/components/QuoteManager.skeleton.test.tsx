// Tests R-S22-03, R-S22-04
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QuoteManager } from "../../../components/QuoteManager";
import { User } from "../../../types";
import * as storageService from "../../../services/storageService";

vi.mock("../../../services/storageService", () => ({
  getQuotes: vi.fn(),
  saveQuote: vi.fn(),
  getLeads: vi.fn(),
  saveLead: vi.fn(),
  getBookings: vi.fn(),
  saveBooking: vi.fn(),
  getWorkItems: vi.fn(),
  saveWorkItem: vi.fn(),
}));

vi.mock("../../../services/authService", () => ({
  checkCapability: vi.fn().mockReturnValue(true),
}));

const mockUser: User = {
  id: "user-1",
  companyId: "company-1",
  email: "admin@test.com",
  name: "Test Admin",
  role: "admin",
  onboardingStatus: "Completed",
  safetyScore: 100,
};

describe("QuoteManager loading/error states (R-S22-03, R-S22-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows LoadingSkeleton while fetching quotes (R-S22-03)", async () => {
    let resolveFn!: (v: unknown[]) => void;
    const pending = new Promise<unknown[]>((res) => {
      resolveFn = res;
    });
    vi.mocked(storageService.getQuotes).mockReturnValue(pending as any);
    vi.mocked(storageService.getLeads).mockReturnValue(pending as any);
    vi.mocked(storageService.getBookings).mockReturnValue(pending as any);
    vi.mocked(storageService.getWorkItems).mockReturnValue(pending as any);

    const { container } = render(
      <QuoteManager user={mockUser} company={null} />,
    );

    // While loading: skeleton should appear
    const skeleton = container.querySelector("[aria-busy='true']");
    expect(skeleton).toBeTruthy();

    // Resolve to avoid act() warnings
    resolveFn([]);
    await waitFor(() => {
      expect(container.querySelector("[aria-busy='true']")).toBeNull();
    });
  });

  it("shows ErrorState with retry button on fetch failure (R-S22-04)", async () => {
    vi.mocked(storageService.getQuotes).mockRejectedValue(
      new Error("API error"),
    );
    vi.mocked(storageService.getLeads).mockRejectedValue(
      new Error("API error"),
    );
    vi.mocked(storageService.getBookings).mockRejectedValue(
      new Error("API error"),
    );
    vi.mocked(storageService.getWorkItems).mockRejectedValue(
      new Error("API error"),
    );

    render(<QuoteManager user={mockUser} company={null} />);

    await waitFor(() => {
      const retryBtn = screen.getByRole("button", { name: /retry/i });
      expect(retryBtn).toBeTruthy();
    });

    const alert = screen.getByRole("alert");
    expect(alert).toBeTruthy();
  });

  it("hides skeleton after data loads successfully (R-S22-03)", async () => {
    vi.mocked(storageService.getQuotes).mockResolvedValue([]);
    vi.mocked(storageService.getLeads).mockResolvedValue([]);
    vi.mocked(storageService.getBookings).mockResolvedValue([]);
    vi.mocked(storageService.getWorkItems).mockResolvedValue([]);

    const { container } = render(
      <QuoteManager user={mockUser} company={null} />,
    );

    await waitFor(() => {
      expect(container.querySelector("[aria-busy='true']")).toBeNull();
    });
  });
});
