// Tests R-S22-03, R-S22-04
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Dashboard } from "../../../components/Dashboard";
import { LoadData, User, LOAD_STATUS } from "../../../types";
import * as exceptionService from "../../../services/exceptionService";

vi.mock("../../../services/exceptionService", () => ({
  getExceptions: vi.fn(),
  getDashboardCards: vi.fn(),
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

const mockLoads: LoadData[] = [];

describe("Dashboard loading/error states (R-S22-03, R-S22-04)", () => {
  const defaultProps = {
    user: mockUser,
    loads: mockLoads,
    onViewLoad: vi.fn(),
    onNavigate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows LoadingSkeleton while data is being fetched (R-S22-03)", async () => {
    // Keep the promise pending so loading stays true
    let resolveFn!: (v: unknown[]) => void;
    const pending = new Promise<unknown[]>((res) => {
      resolveFn = res;
    });
    vi.mocked(exceptionService.getExceptions).mockReturnValue(pending as any);
    vi.mocked(exceptionService.getDashboardCards).mockReturnValue(
      pending as any,
    );

    const { container } = render(<Dashboard {...defaultProps} />);

    // While loading: skeleton should appear
    const skeleton = container.querySelector("[aria-busy='true']");
    expect(skeleton).toBeTruthy();

    // Resolve to avoid act() warnings
    resolveFn([]);
    await waitFor(() => {
      expect(container.querySelector("[aria-busy='true']")).toBeNull();
    });
  });

  it("shows ErrorState with retry button on API failure (R-S22-04)", async () => {
    vi.mocked(exceptionService.getExceptions).mockRejectedValue(
      new Error("Network error"),
    );
    vi.mocked(exceptionService.getDashboardCards).mockRejectedValue(
      new Error("Network error"),
    );

    render(<Dashboard {...defaultProps} />);

    await waitFor(() => {
      const retryBtn = screen.getByRole("button", { name: /retry/i });
      expect(retryBtn).toBeTruthy();
    });

    // Error message visible
    const alert = screen.getByRole("alert");
    expect(alert).toBeTruthy();
  });

  it("hides loading skeleton after data loads (R-S22-03)", async () => {
    vi.mocked(exceptionService.getExceptions).mockResolvedValue([]);
    vi.mocked(exceptionService.getDashboardCards).mockResolvedValue([]);

    const { container } = render(<Dashboard {...defaultProps} />);

    await waitFor(() => {
      expect(container.querySelector("[aria-busy='true']")).toBeNull();
    });
  });
});
