/**
 * Centralized browser API mocks for jsdom.
 *
 * Provides stubs for APIs that jsdom does not implement:
 * - ResizeObserver
 * - IntersectionObserver
 * - window.matchMedia
 *
 * Usage:
 *   import { setupBrowserMocks } from "../helpers/browser-mocks";
 *   beforeAll(() => setupBrowserMocks());
 */

export function setupBrowserMocks() {
  // ResizeObserver
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;

  // IntersectionObserver
  global.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    root = null;
    rootMargin = "";
    thresholds = [0];
    takeRecords() {
      return [];
    }
  } as any;

  // matchMedia
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (q: string) => ({
      matches: false,
      media: q,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
