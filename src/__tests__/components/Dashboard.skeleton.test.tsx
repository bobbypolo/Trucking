// Tests R-S22-03, R-S22-04
// Dashboard has been consolidated into Operations Center (IntelligenceHub).
// It no longer has loading/error states — it is now a simple redirect page.
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Dashboard } from "../../../components/Dashboard";
import { LoadData, User } from "../../../types";

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

describe("Dashboard loading/error states (R-S22-03, R-S22-04) — post-consolidation", () => {
  const defaultProps = {
    user: mockUser,
    loads: mockLoads,
    onViewLoad: vi.fn(),
    onNavigate: vi.fn(),
  };

  it("does not show LoadingSkeleton (no async data loading in redirect page)", () => {
    const { container } = render(<Dashboard {...defaultProps} />);
    expect(container.querySelector("[aria-busy='true']")).toBeNull();
  });

  it("does not show error alert (no API calls in redirect page)", () => {
    render(<Dashboard {...defaultProps} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders the redirect content immediately (no loading state)", () => {
    render(<Dashboard {...defaultProps} />);
    expect(screen.getByText("Operations Dashboard")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The operations dashboard has been consolidated into Operations Center.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Go to Operations Center/i }),
    ).toBeInTheDocument();
  });
});
