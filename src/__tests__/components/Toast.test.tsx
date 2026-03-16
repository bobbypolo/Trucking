// Tests R-P4-01
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import React from "react";
import { Toast } from "../../../components/Toast";

describe("Toast component (R-P4-01)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the message text", () => {
    const onDismiss = vi.fn();
    render(
      <Toast message="Hello world" type="success" onDismiss={onDismiss} />,
    );
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("applies green styling for type=success", () => {
    const onDismiss = vi.fn();
    const { container } = render(
      <Toast message="ok" type="success" onDismiss={onDismiss} />,
    );
    const toast = container.firstChild as HTMLElement;
    expect(toast.className).toMatch(/green/);
  });

  it("applies red styling for type=error", () => {
    const onDismiss = vi.fn();
    const { container } = render(
      <Toast message="fail" type="error" onDismiss={onDismiss} />,
    );
    const toast = container.firstChild as HTMLElement;
    expect(toast.className).toMatch(/red/);
  });

  it("applies blue styling for type=info", () => {
    const onDismiss = vi.fn();
    const { container } = render(
      <Toast message="note" type="info" onDismiss={onDismiss} />,
    );
    const toast = container.firstChild as HTMLElement;
    expect(toast.className).toMatch(/blue/);
  });

  it("calls onDismiss after default 3000ms", () => {
    const onDismiss = vi.fn();
    render(<Toast message="test" type="info" onDismiss={onDismiss} />);
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss after custom duration", () => {
    const onDismiss = vi.fn();
    render(
      <Toast
        message="custom"
        type="success"
        onDismiss={onDismiss}
        duration={1500}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(1499);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("does not call onDismiss before default duration elapses", () => {
    const onDismiss = vi.fn();
    render(<Toast message="test" type="info" onDismiss={onDismiss} />);
    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
