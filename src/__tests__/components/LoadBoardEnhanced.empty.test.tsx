// Tests R-P3-12
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { LoadBoardEnhanced } from "../../../components/LoadBoardEnhanced";

// Mock authService for useCurrentUser hook
vi.mock("../../../services/authService", () => ({
  getCurrentUser: vi.fn().mockReturnValue({
    id: "user-1",
    role: "admin",
    companyId: "company-1",
  }),
  getCompany: vi.fn().mockResolvedValue({ id: "company-1", name: "Test Co" }),
  getCompanyUsers: vi.fn().mockResolvedValue([]),
  onUserChange: vi.fn(() => () => {}),
}));

vi.mock("../../../services/storageService", () => ({
  generateInvoicePDF: vi.fn(),
  saveLoad: vi.fn().mockResolvedValue(undefined),
  generateNextLoadNumber: vi.fn().mockReturnValue("LP-100"),
}));

vi.mock("../../../services/brokerService", () => ({
  getBrokers: vi.fn().mockResolvedValue([]),
}));

describe("LoadBoardEnhanced: EmptyState for empty loads (R-P3-12)", () => {
  const defaultProps = {
    loads: [],
    users: [],
    brokers: [],
    onView: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    canViewRates: true,
  };

  it("renders EmptyState with No loads message when given empty loads array", () => {
    render(<LoadBoardEnhanced {...defaultProps} />);

    const text = document.body.textContent || "";
    expect(text.toLowerCase()).toContain("no loads");
  });

  it("renders CTA button when onCreateLoad is provided", () => {
    const onCreateLoad = vi.fn();
    render(<LoadBoardEnhanced {...defaultProps} onCreateLoad={onCreateLoad} />);

    const btns = screen.getAllByRole("button", { name: /create load/i });
    expect(btns.length).toBeGreaterThanOrEqual(1);
  });

  it("CTA button opens internal setup modal when clicked", async () => {
    const user = userEvent.setup();
    const onCreateLoad = vi.fn();
    render(<LoadBoardEnhanced {...defaultProps} onCreateLoad={onCreateLoad} />);

    const btns = screen.getAllByRole("button", { name: /create load/i });
    await user.click(btns[0]);
    expect(screen.getByText("Setup New Load")).toBeInTheDocument();
  });
});
