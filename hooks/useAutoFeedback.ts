import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Options for useAutoFeedback when using a non-null clear value (e.g., "").
 */
interface UseAutoFeedbackOptions<T> {
  clearValue: T;
}

/**
 * useAutoFeedback — reusable hook that manages a feedback message with
 * auto-clear timer and proper cleanup on unmount.
 *
 * Two calling signatures:
 *   - useAutoFeedback(null)              → clears to null after duration
 *   - useAutoFeedback({ clearValue: "" }) → clears to "" after duration
 *
 * Returns [message, showMessage, clearMessage] where:
 *   - message: current feedback value (T)
 *   - showMessage(value, durationMs?): sets message and schedules auto-clear
 *   - clearMessage(): immediately clears message and cancels pending timer
 *
 * Usage:
 *   const [feedback, showFeedback, clearFeedback] = useAutoFeedback<string | null>(null);
 *   showFeedback("Saved successfully!", 3000);
 *   clearFeedback(); // dismiss immediately
 */
function useAutoFeedback<T>(
  clearValue: T,
): [T, (value: T, durationMs?: number) => void, () => void];
function useAutoFeedback<T>(
  options: UseAutoFeedbackOptions<T>,
): [T, (value: T, durationMs?: number) => void, () => void];
function useAutoFeedback<T>(
  clearValueOrOptions: T | UseAutoFeedbackOptions<T>,
): [T, (value: T, durationMs?: number) => void, () => void] {
  const resolvedClearValue =
    clearValueOrOptions !== null &&
    typeof clearValueOrOptions === "object" &&
    "clearValue" in (clearValueOrOptions as object)
      ? (clearValueOrOptions as UseAutoFeedbackOptions<T>).clearValue
      : (clearValueOrOptions as T);

  const [message, setMessage] = useState<T>(resolvedClearValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  // Keep a ref to the clear value so callbacks always see the latest value
  const clearValueRef = useRef<T>(resolvedClearValue);
  clearValueRef.current = resolvedClearValue;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const showMessage = useCallback((value: T, durationMs = 3000) => {
    // Cancel any pending auto-clear
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    setMessage(value);
    timerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setMessage(clearValueRef.current);
      }
      timerRef.current = null;
    }, durationMs);
  }, []);

  const clearMessage = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setMessage(clearValueRef.current);
  }, []);

  return [message, showMessage, clearMessage];
}

export { useAutoFeedback };
