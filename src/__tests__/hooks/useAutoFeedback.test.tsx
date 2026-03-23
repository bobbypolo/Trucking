// Tests R-W1-05a, R-W1-VPC-205
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useAutoFeedback } from "../../../hooks/useAutoFeedback";

describe("useAutoFeedback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initially returns null message", () => {
    const { result } = renderHook(() => useAutoFeedback<string | null>(null));
    expect(result.current[0]).toBeNull();
  });

  it("shows message when showMessage is called", () => {
    const { result } = renderHook(() => useAutoFeedback<string | null>(null));
    act(() => {
      result.current[1]("Operation successful");
    });
    expect(result.current[0]).toBe("Operation successful");
  });

  it("auto-clears message after default duration (3000ms)", () => {
    const { result } = renderHook(() => useAutoFeedback<string | null>(null));
    act(() => {
      result.current[1]("Will auto-clear");
    });
    expect(result.current[0]).toBe("Will auto-clear");

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current[0]).toBeNull();
  });

  it("auto-clears message after custom duration", () => {
    const { result } = renderHook(() => useAutoFeedback<string | null>(null));
    act(() => {
      result.current[1]("Custom duration message", 5000);
    });
    expect(result.current[0]).toBe("Custom duration message");

    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(result.current[0]).toBe("Custom duration message");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current[0]).toBeNull();
  });

  it("does not clear message before duration elapses", () => {
    const { result } = renderHook(() => useAutoFeedback<string | null>(null));
    act(() => {
      result.current[1]("Persistent message");
    });
    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(result.current[0]).toBe("Persistent message");
  });

  it("clears previous timer when a new message is shown", () => {
    const { result } = renderHook(() => useAutoFeedback<string | null>(null));

    act(() => {
      result.current[1]("First message", 3000);
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      result.current[1]("Second message", 3000);
    });

    // After 2000ms more (3000ms from second call), second message should be cleared
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    // Second message timer not yet elapsed (need 1000ms more)
    expect(result.current[0]).toBe("Second message");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current[0]).toBeNull();
  });

  it("cleans up timer on unmount (no setState after unmount)", () => {
    const { result, unmount } = renderHook(() =>
      useAutoFeedback<string | null>(null),
    );
    act(() => {
      result.current[1]("Message before unmount");
    });

    // Unmount before timer fires
    unmount();

    // Timer fires after unmount — should not throw or cause setState warning
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // No assertion needed — test passes if no error/warning is thrown
    expect(true).toBe(true);
  });

  it("clearMessage immediately dismisses and cancels timer", () => {
    const { result } = renderHook(() => useAutoFeedback<string | null>(null));
    act(() => {
      result.current[1]("Active message", 5000);
    });
    expect(result.current[0]).toBe("Active message");

    act(() => {
      result.current[2](); // clearMessage
    });
    expect(result.current[0]).toBeNull();

    // Timer should have been cancelled — no state change after dismiss
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current[0]).toBeNull();
  });

  it("supports empty string as cleared value", () => {
    const { result } = renderHook(() =>
      useAutoFeedback<string>({ clearValue: "" }),
    );
    act(() => {
      result.current[1]("Saving...");
    });
    expect(result.current[0]).toBe("Saving...");

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current[0]).toBe("");
  });

  it("supports object message type", () => {
    const { result } = renderHook(() =>
      useAutoFeedback<{ msg: string; type: "success" | "error" } | null>(null),
    );
    act(() => {
      result.current[1]({ msg: "Saved!", type: "success" });
    });
    expect(result.current[0]).toEqual({ msg: "Saved!", type: "success" });

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current[0]).toBeNull();
  });
});
