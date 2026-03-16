// Tests R-P3-01
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { EmptyState } from "../../../components/EmptyState";
import { Package } from "lucide-react";

describe("EmptyState component", () => {
  it("renders icon, title, and description", () => {
    render(
      <EmptyState
        icon={<Package data-testid="empty-icon" />}
        title="Nothing here yet"
        description="Add some items to get started"
      />,
    );

    expect(screen.getByTestId("empty-icon")).toBeTruthy();
    expect(screen.getByText("Nothing here yet")).toBeTruthy();
    expect(screen.getByText("Add some items to get started")).toBeTruthy();
  });

  it("does not render action button when action prop is absent", () => {
    render(
      <EmptyState icon={<Package />} title="Empty" description="No items" />,
    );

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders optional action button when action prop is provided", () => {
    const handleClick = vi.fn();
    render(
      <EmptyState
        icon={<Package />}
        title="No loads"
        description="Create your first load"
        action={{ label: "Create Load", onClick: handleClick }}
      />,
    );

    const btn = screen.getByRole("button", { name: /create load/i });
    expect(btn).toBeTruthy();
  });

  it("calls action.onClick when action button is clicked", () => {
    const handleClick = vi.fn();
    render(
      <EmptyState
        icon={<Package />}
        title="No loads"
        description="Create your first load"
        action={{ label: "Create Load", onClick: handleClick }}
      />,
    );

    const btn = screen.getByRole("button", { name: /create load/i });
    fireEvent.click(btn);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
