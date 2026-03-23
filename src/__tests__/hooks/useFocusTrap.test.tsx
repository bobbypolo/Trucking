import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { useRef } from "react";
import { render, fireEvent, screen, act } from "@testing-library/react";
import { useFocusTrap } from "../../../hooks/useFocusTrap";

/**
 * Test component that renders a modal-like container with focusable elements
 * and uses the useFocusTrap hook.
 */
function TestModal({
  isActive,
  onClose,
}: {
  isActive: boolean;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, isActive, onClose);

  return (
    <div>
      <button data-testid="outside-button">Outside</button>
      <div ref={containerRef} data-testid="modal-container">
        <button data-testid="first-button">First</button>
        <input data-testid="text-input" type="text" />
        <a href="#" data-testid="link">
          Link
        </a>
        <button data-testid="last-button">Last</button>
      </div>
    </div>
  );
}

/**
 * Test component with a single focusable element.
 */
function SingleElementModal({
  isActive,
  onClose,
}: {
  isActive: boolean;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, isActive, onClose);

  return (
    <div ref={containerRef} data-testid="modal-container">
      <button data-testid="only-button">Only</button>
    </div>
  );
}

/** Flush requestAnimationFrame callbacks used by useFocusTrap */
function flushRAF() {
  act(() => {
    vi.advanceTimersByTime(16);
  });
}

describe("useFocusTrap", () => {
  let onClose: () => void;

  beforeEach(() => {
    onClose = vi.fn() as unknown as () => void;
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("focuses the first focusable element when activated", () => {
    render(<TestModal isActive={true} onClose={onClose} />);
    flushRAF();
    const firstButton = screen.getByTestId("first-button");
    expect(document.activeElement).toBe(firstButton);
  });

  it("does not focus anything when not active", () => {
    render(<TestModal isActive={false} onClose={onClose} />);
    flushRAF();
    const firstButton = screen.getByTestId("first-button");
    expect(document.activeElement).not.toBe(firstButton);
  });

  it("wraps focus forward from last to first element on Tab", () => {
    render(<TestModal isActive={true} onClose={onClose} />);
    flushRAF();

    const lastButton = screen.getByTestId("last-button");
    lastButton.focus();
    expect(document.activeElement).toBe(lastButton);

    fireEvent.keyDown(lastButton, { key: "Tab", shiftKey: false });

    const firstButton = screen.getByTestId("first-button");
    expect(document.activeElement).toBe(firstButton);
  });

  it("wraps focus backward from first to last element on Shift+Tab", () => {
    render(<TestModal isActive={true} onClose={onClose} />);
    flushRAF();

    const firstButton = screen.getByTestId("first-button");
    firstButton.focus();
    expect(document.activeElement).toBe(firstButton);

    fireEvent.keyDown(firstButton, { key: "Tab", shiftKey: true });

    const lastButton = screen.getByTestId("last-button");
    expect(document.activeElement).toBe(lastButton);
  });

  it("calls onClose when Escape key is pressed", () => {
    render(<TestModal isActive={true} onClose={onClose} />);
    flushRAF();

    const firstButton = screen.getByTestId("first-button");
    fireEvent.keyDown(firstButton, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose on Escape when not active", () => {
    render(<TestModal isActive={false} onClose={onClose} />);
    flushRAF();

    const container = screen.getByTestId("modal-container");
    fireEvent.keyDown(container, { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("handles single focusable element by keeping focus on it", () => {
    render(<SingleElementModal isActive={true} onClose={onClose} />);
    flushRAF();

    const onlyButton = screen.getByTestId("only-button");
    expect(document.activeElement).toBe(onlyButton);

    fireEvent.keyDown(onlyButton, { key: "Tab", shiftKey: false });
    expect(document.activeElement).toBe(onlyButton);

    fireEvent.keyDown(onlyButton, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(onlyButton);
  });

  it("restores focus to previously focused element on deactivation", () => {
    const outsideButton = document.createElement("button");
    outsideButton.textContent = "Trigger";
    document.body.appendChild(outsideButton);
    outsideButton.focus();
    expect(document.activeElement).toBe(outsideButton);

    const { rerender } = render(
      <TestModal isActive={true} onClose={onClose} />,
    );
    flushRAF();

    // Focus should be inside the modal now
    expect(document.activeElement).toBe(screen.getByTestId("first-button"));

    // Deactivate
    rerender(<TestModal isActive={false} onClose={onClose} />);

    expect(document.activeElement).toBe(outsideButton);

    document.body.removeChild(outsideButton);
  });

  it("does not trap Tab for non-Tab keys", () => {
    render(<TestModal isActive={true} onClose={onClose} />);
    flushRAF();

    const firstButton = screen.getByTestId("first-button");
    firstButton.focus();

    // Press a regular key -- should not change focus behavior
    fireEvent.keyDown(firstButton, { key: "a" });
    expect(document.activeElement).toBe(firstButton);
  });

  it("does not move focus on Tab when not at boundary", () => {
    render(<TestModal isActive={true} onClose={onClose} />);
    flushRAF();

    // Focus the text input (middle element)
    const textInput = screen.getByTestId("text-input");
    textInput.focus();
    expect(document.activeElement).toBe(textInput);

    // Tab on a middle element -- hook does not intercept, focus stays
    // (browser handles native tab, jsdom does not simulate it)
    fireEvent.keyDown(textInput, { key: "Tab" });
    expect(document.activeElement).toBe(textInput);
  });
});

// Vitest needs afterEach imported at top level
import { afterEach } from "vitest";
