import { useEffect, useRef, useCallback } from "react";

/**
 * Selector for all natively focusable elements within a container.
 * Excludes disabled elements and elements with negative tabindex.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]:not([disabled]):not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([tabindex="-1"]):not([type="hidden"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([disabled]):not([tabindex="-1"])',
].join(", ");

/**
 * useFocusTrap -- traps keyboard focus within a container element.
 *
 * When active:
 * - Focuses the first focusable element on activation
 * - Tab wraps from last to first focusable element
 * - Shift+Tab wraps from first to last focusable element
 * - Escape key calls onClose
 * - On deactivation, restores focus to the previously focused element
 *
 * @param containerRef - React ref to the container element
 * @param isActive - Whether the focus trap is currently active
 * @param onClose - Callback invoked when Escape key is pressed
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  isActive: boolean,
  onClose: () => void,
): void {
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];
    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
  }, [containerRef]);

  // Focus first element on activation, restore on deactivation
  useEffect(() => {
    if (isActive) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement;
      // Use requestAnimationFrame to ensure DOM is painted before focusing
      const rafId = requestAnimationFrame(() => {
        const focusable = getFocusableElements();
        if (focusable.length > 0) {
          focusable[0].focus();
        }
      });
      return () => cancelAnimationFrame(rafId);
    } else if (previouslyFocusedRef.current) {
      previouslyFocusedRef.current.focus();
      previouslyFocusedRef.current = null;
    }
  }, [isActive, getFocusableElements]);

  // Keyboard trap handler
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = getFocusableElements();
      if (focusable.length === 0) return;

      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];

      if (event.shiftKey) {
        // Shift+Tab: if on first element, wrap to last
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: if on last element, wrap to first
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("keydown", handleKeyDown);
      return () => container.removeEventListener("keydown", handleKeyDown);
    }
  }, [isActive, onClose, getFocusableElements, containerRef]);
}
