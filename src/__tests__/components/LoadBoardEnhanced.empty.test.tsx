// Tests R-P3-12
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { LoadBoardEnhanced } from "../../../components/LoadBoardEnhanced";

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

    const btn = screen.getByRole("button", { name: /create load/i });
    expect(btn).toBeTruthy();
  });

  it("CTA button calls onCreateLoad when clicked", () => {
    const onCreateLoad = vi.fn();
    render(<LoadBoardEnhanced {...defaultProps} onCreateLoad={onCreateLoad} />);

    const btn = screen.getByRole("button", { name: /create load/i });
    fireEvent.click(btn);
    expect(onCreateLoad).toHaveBeenCalledTimes(1);
  });
});
