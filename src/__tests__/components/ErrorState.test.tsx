// Tests R-S22-02, R-S22-04
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ErrorState } from "../../../components/ui/ErrorState";

describe("ErrorState component (R-S22-02)", () => {
  it("renders error message", () => {
    render(<ErrorState message="Failed to load data" onRetry={vi.fn()} />);
    expect(screen.getByText("Failed to load data")).toBeTruthy();
  });

  it("renders retry button", () => {
    render(<ErrorState message="Something went wrong" onRetry={vi.fn()} />);
    const retryBtn = screen.getByRole("button", { name: /retry/i });
    expect(retryBtn).toBeTruthy();
  });

  it("calls onRetry when retry button is clicked", () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Error occurred" onRetry={onRetry} />);
    const retryBtn = screen.getByRole("button", { name: /retry/i });
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("does not render details when details prop is absent", () => {
    const { container } = render(
      <ErrorState message="Error" onRetry={vi.fn()} />,
    );
    const details = container.querySelector("[data-details]");
    expect(details).toBeNull();
  });

  it("renders optional details when provided", () => {
    render(
      <ErrorState
        message="Network error"
        onRetry={vi.fn()}
        details="Connection refused on port 3000"
      />,
    );
    expect(screen.getByText(/Connection refused on port 3000/i)).toBeTruthy();
  });

  it("has role=alert for screen reader accessibility", () => {
    render(<ErrorState message="Load failed" onRetry={vi.fn()} />);
    const alert = screen.getByRole("alert");
    expect(alert).toBeTruthy();
  });

  it("renders an error icon", () => {
    const { container } = render(
      <ErrorState message="Error" onRetry={vi.fn()} />,
    );
    const icon = container.querySelector("[data-error-icon]");
    expect(icon).toBeTruthy();
  });
});
