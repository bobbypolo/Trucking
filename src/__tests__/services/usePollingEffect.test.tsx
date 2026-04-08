import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { usePollingEffect } from "../../../services/usePollingEffect";

describe("usePollingEffect", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Tests R-P2-01
  it("exports a function usePollingEffect", () => {
    expect(typeof usePollingEffect).toBe("function");
  });

  // Tests R-P2-02
  it("calls fn exactly once immediately on mount", () => {
    const fn = vi.fn();
    renderHook(() => usePollingEffect(fn, 1000, []));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  // Tests R-P2-03
  it("calls fn 5 times total after advancing 4500ms (1 immediate + 4 intervals)", async () => {
    const fn = vi.fn();
    renderHook(() => usePollingEffect(fn, 1000, []));
    expect(fn).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4500);
    });

    expect(fn).toHaveBeenCalledTimes(5);
  });

  // Tests R-P2-04
  it("unmount clears the interval and aborts the last signal", async () => {
    const abortSpy = vi.fn();
    const fn = vi.fn((signal: AbortSignal) => {
      signal.addEventListener("abort", abortSpy);
    });

    const { unmount } = renderHook(() => usePollingEffect(fn, 1000, []));

    // Advance to create a second signal (after 1 interval)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(fn).toHaveBeenCalledTimes(2);

    // Reset spy count to track only cleanup abort
    abortSpy.mockClear();

    unmount();

    // Cleanup should have aborted the last signal
    expect(abortSpy).toHaveBeenCalledTimes(1);

    // No further calls after unmount
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("passes an AbortSignal to fn on each call", () => {
    const signals: AbortSignal[] = [];
    const fn = vi.fn((signal: AbortSignal) => {
      signals.push(signal);
    });

    renderHook(() => usePollingEffect(fn, 500, []));
    expect(signals.length).toBe(1);
    expect(signals[0]).toBeInstanceOf(AbortSignal);
  });

  it("re-runs when deps change", async () => {
    const fn = vi.fn();
    let dep = "a";
    const { rerender } = renderHook(() => usePollingEffect(fn, 1000, [dep]));
    expect(fn).toHaveBeenCalledTimes(1);

    dep = "b";
    rerender();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
