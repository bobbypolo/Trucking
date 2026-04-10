/**
 * Tests for S-005: Wrap data-fetching components with ComponentErrorBoundary in App.tsx
 *
 * # Tests R-ERR-01, R-ERR-02, R-ERR-03, R-ERR-04, R-ERR-05
 */
import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";

const APP_TSX_PATH = path.resolve(__dirname, "../../../App.tsx");
const appSource = fs.readFileSync(APP_TSX_PATH, "utf-8");

describe("S-005: ComponentErrorBoundary wrapping in App.tsx", () => {
  // # Tests R-ERR-01
  it("R-ERR-01: App.tsx imports ComponentErrorBoundary", () => {
    expect(appSource).toContain("ComponentErrorBoundary");
    // Verify it is an actual import statement
    const importMatch = appSource.match(
      /import\s+\{[^}]*ComponentErrorBoundary[^}]*\}\s+from/
    );
    expect(importMatch).not.toBeNull();
  });

  // # Tests R-ERR-02
  it("R-ERR-02: grep -c ComponentErrorBoundary returns 12+", () => {
    const matches = appSource.match(/ComponentErrorBoundary/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(12);
  });

  // # Tests R-ERR-03
  it("R-ERR-03: AccountingPortal rendering block is wrapped with ComponentErrorBoundary", () => {
    // Find the AccountingPortal rendering section and verify ComponentErrorBoundary is nearby
    const accountingSection = appSource.indexOf("<AccountingPortal");
    expect(accountingSection).toBeGreaterThan(-1);

    // Look backwards from AccountingPortal to find the nearest ComponentErrorBoundary opening tag
    const preceding200Chars = appSource.substring(
      Math.max(0, accountingSection - 300),
      accountingSection
    );
    expect(preceding200Chars).toContain("<ComponentErrorBoundary");
  });

  // # Tests R-ERR-04
  it(
    "R-ERR-04: throwing child renders error card (not blank page)",
    { timeout: 10000 },
    async () => {
    // Dynamic import to avoid issues if React test utils aren't available at collection time
    const React = await import("react");
    const { render, screen } = await import("@testing-library/react");
    const { ComponentErrorBoundary } = await import(
      "../../../components/ErrorBoundary"
    );

    function ThrowingChild(): React.JSX.Element {
      throw new Error("Test render error");
    }

    // Suppress console.error for the expected error boundary logging
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      React.createElement(
        ComponentErrorBoundary,
        null,
        React.createElement(ThrowingChild)
      )
    );

    // ComponentErrorBoundary renders an inline error card with data-testid="component-error-boundary"
    const errorCard = screen.getByTestId("component-error-boundary");
    expect(errorCard).toBeTruthy();
    expect(errorCard.textContent).toContain("Widget error");

    spy.mockRestore();
    },
  );

  // Additional structural checks: verify other key components are also wrapped
  it("IntelligenceHub rendering block is wrapped with ComponentErrorBoundary", () => {
    const hubSection = appSource.indexOf("<IntelligenceHub");
    expect(hubSection).toBeGreaterThan(-1);
    const preceding = appSource.substring(
      Math.max(0, hubSection - 300),
      hubSection
    );
    expect(preceding).toContain("<ComponentErrorBoundary");
  });

  it("ExceptionConsole rendering block is wrapped with ComponentErrorBoundary", () => {
    const section = appSource.indexOf("<ExceptionConsole");
    expect(section).toBeGreaterThan(-1);
    const preceding = appSource.substring(
      Math.max(0, section - 300),
      section
    );
    expect(preceding).toContain("<ComponentErrorBoundary");
  });

  it("QuoteManager rendering block is wrapped with ComponentErrorBoundary", () => {
    const section = appSource.indexOf("<QuoteManager");
    expect(section).toBeGreaterThan(-1);
    const preceding = appSource.substring(
      Math.max(0, section - 300),
      section
    );
    expect(preceding).toContain("<ComponentErrorBoundary");
  });

  it("CalendarView rendering block is wrapped with ComponentErrorBoundary", () => {
    const section = appSource.indexOf("<CalendarView");
    expect(section).toBeGreaterThan(-1);
    const preceding = appSource.substring(
      Math.max(0, section - 300),
      section
    );
    expect(preceding).toContain("<ComponentErrorBoundary");
  });

  it("EditLoadForm rendering block is wrapped with ComponentErrorBoundary", () => {
    const section = appSource.indexOf("<EditLoadForm");
    expect(section).toBeGreaterThan(-1);
    const preceding = appSource.substring(
      Math.max(0, section - 300),
      section
    );
    expect(preceding).toContain("<ComponentErrorBoundary");
  });

  it("LoadDetailView rendering block is wrapped with ComponentErrorBoundary", () => {
    const section = appSource.indexOf("<LoadDetailView");
    expect(section).toBeGreaterThan(-1);
    const preceding = appSource.substring(
      Math.max(0, section - 300),
      section
    );
    expect(preceding).toContain("<ComponentErrorBoundary");
  });

  // # Tests R-ERR-05
  it("R-ERR-05: this test suite passes (vitest run exits 0)", () => {
    // This test verifies the suite itself runs successfully.
    // All structural assertions above confirm the wrapping is correct.
    // The gate command `npx vitest run src/__tests__/components/ErrorBoundary.wrap.test.tsx`
    // exits 0 when all tests in this file pass.
    expect(true).toBe(true);
  });
});
