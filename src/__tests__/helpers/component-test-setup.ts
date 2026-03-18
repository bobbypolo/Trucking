/**
 * Shared component test setup — centralizes mock implementations for
 * browser APIs and third-party libraries not available in jsdom.
 *
 * IMPORTANT: vi.mock() calls MUST remain in each test file due to Vitest
 * hoisting. This module provides the mock IMPLEMENTATIONS only.
 *
 * ## Usage
 *
 * ```ts
 * import { vi } from "vitest";
 * import { RECHARTS_MOCK, GOOGLE_MAPS_MOCK } from "../helpers/component-test-setup";
 *
 * // Use in vi.mock factory (must be in the test file):
 * vi.mock("recharts", () => RECHARTS_MOCK);
 * vi.mock("@react-google-maps/api", () => GOOGLE_MAPS_MOCK);
 * ```
 */

import React from "react";

// ── Recharts Mock ───────────────────────────────────────────────────────────

/**
 * Thin shim for Recharts components that require DOM measurements
 * (ResponsiveContainer needs offsetWidth/offsetHeight which jsdom lacks).
 *
 * Provides functional stubs for all commonly used Recharts components.
 */
export const RECHARTS_MOCK = {
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      "div",
      { "data-testid": "responsive-container", style: { width: 500, height: 300 } },
      children,
    ),
  BarChart: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "bar-chart" }, children),
  LineChart: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "line-chart" }, children),
  PieChart: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "pie-chart" }, children),
  AreaChart: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "area-chart" }, children),
  Bar: () => React.createElement("div", { "data-testid": "bar" }),
  Line: () => React.createElement("div", { "data-testid": "line" }),
  Area: () => React.createElement("div", { "data-testid": "area" }),
  Pie: () => React.createElement("div", { "data-testid": "pie" }),
  Cell: () => React.createElement("div"),
  XAxis: () => React.createElement("div"),
  YAxis: () => React.createElement("div"),
  Tooltip: () => React.createElement("div"),
  Legend: () => React.createElement("div"),
  CartesianGrid: () => React.createElement("div"),
};

// ── Google Maps Mock ────────────────────────────────────────────────────────

/**
 * Mock for @react-google-maps/api — avoids loading external Google Maps
 * scripts in jsdom. Components render as simple divs with test IDs.
 */
export const GOOGLE_MAPS_MOCK = {
  LoadScript: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "load-script" }, children),
  GoogleMap: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "google-map" }, children),
  Marker: () => React.createElement("div", { "data-testid": "map-marker" }),
  Polyline: () => React.createElement("div", { "data-testid": "map-polyline" }),
  InfoWindow: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "info-window" }, children),
  useJsApiLoader: () => ({ isLoaded: true, loadError: null }),
};

// ── Browser API Mocks ───────────────────────────────────────────────────────

/**
 * Sets up browser API mocks that jsdom does not provide.
 * Call this in a beforeAll or setupFiles block.
 *
 * Mocks:
 * - ResizeObserver
 * - IntersectionObserver
 * - window.matchMedia
 * - Element.scrollIntoView
 * - window.scrollTo
 */
export function setupBrowserMocks(): void {
  // ResizeObserver
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;
  }

  // IntersectionObserver
  if (typeof globalThis.IntersectionObserver === "undefined") {
    globalThis.IntersectionObserver = class IntersectionObserver {
      readonly root = null;
      readonly rootMargin = "0px";
      readonly thresholds = [0];
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    } as any;
  }

  // matchMedia
  if (typeof window !== "undefined" && !window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }

  // scrollIntoView
  if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = function () {};
  }

  // scrollTo
  if (typeof window !== "undefined" && !window.scrollTo) {
    window.scrollTo = (() => {}) as any;
  }
}

// ── Common Test Data Factories ──────────────────────────────────────────────

import type { User, LoadData } from "../../../types";

/**
 * Creates a standard mock User for component tests.
 */
export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    companyId: "company-1",
    email: "admin@test.com",
    name: "Test Admin",
    role: "admin",
    onboardingStatus: "Completed",
    safetyScore: 100,
    ...overrides,
  } as User;
}
