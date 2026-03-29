// Tests R-P5-01, R-P5-02, R-P5-04
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PageErrorBoundary,
  ComponentErrorBoundary,
  useApiError,
  ErrorBoundary,
} from "../../../components/ErrorBoundary";

/* ---------- helpers ---------- */

/** A component that always throws on render. */
function Thrower({ message }: { message: string }) {
  if (message) {
    throw new Error(message);
  }
  return <div>unreachable</div>;
}

/** A well-behaved child component. */
function GoodChild() {
  return <div data-testid="good-child">All is well</div>;
}

/* suppress console.error noise from React error boundaries in test output */
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

/* ---------- R-P5-01: PageErrorBoundary ---------- */

describe("PageErrorBoundary", () => {
  // Tests R-P5-01
  it("catches component tree errors and renders a branded error page", () => {
    render(
      <PageErrorBoundary>
        <Thrower message="page-level boom" />
      </PageErrorBoundary>,
    );

    const container = screen.getByTestId("page-error-boundary");
    expect(container).toBeInTheDocument();

    // Branded heading
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    // User-facing message
    expect(
      screen.getByText("An unexpected error occurred. Please reload the page."),
    ).toBeInTheDocument();
    // Reload button present
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
  });

  // Tests R-P5-01 (happy path — children render normally)
  it("renders children when no error occurs", () => {
    render(
      <PageErrorBoundary>
        <GoodChild />
      </PageErrorBoundary>,
    );

    expect(screen.getByTestId("good-child")).toBeInTheDocument();
    expect(screen.getByText("All is well")).toBeInTheDocument();
    expect(screen.queryByTestId("page-error-boundary")).not.toBeInTheDocument();
  });
});

/* ---------- R-P5-02: ComponentErrorBoundary ---------- */

describe("ComponentErrorBoundary", () => {
  // Tests R-P5-02
  it("catches widget errors and renders an inline error card", () => {
    render(
      <ComponentErrorBoundary>
        <Thrower message="widget boom" />
      </ComponentErrorBoundary>,
    );

    const card = screen.getByTestId("component-error-boundary");
    expect(card).toBeInTheDocument();

    // Inline error card text
    expect(screen.getByText("Widget error")).toBeInTheDocument();
    expect(
      screen.getByText(
        "This component encountered an error and could not render.",
      ),
    ).toBeInTheDocument();
    // Has alert role for accessibility
    expect(card).toHaveAttribute("role", "alert");
  });

  // Tests R-P5-02 (happy path — widget renders normally)
  it("renders children when no error occurs", () => {
    render(
      <ComponentErrorBoundary>
        <GoodChild />
      </ComponentErrorBoundary>,
    );

    expect(screen.getByTestId("good-child")).toBeInTheDocument();
    expect(
      screen.queryByTestId("component-error-boundary"),
    ).not.toBeInTheDocument();
  });

  // Tests R-P5-02 (inline card does NOT show a Reload button)
  it("does not show a full-page Reload button in inline error card", () => {
    render(
      <ComponentErrorBoundary>
        <Thrower message="widget boom" />
      </ComponentErrorBoundary>,
    );

    expect(
      screen.queryByRole("button", { name: "Reload" }),
    ).not.toBeInTheDocument();
  });
});

/* ---------- R-P5-04: All 3 exported from ErrorBoundary.tsx ---------- */

describe("ErrorBoundary exports (R-P5-04)", () => {
  // Tests R-P5-04
  it("exports PageErrorBoundary as a named export", () => {
    expect(typeof PageErrorBoundary).toBe("function");
  });

  // Tests R-P5-04
  it("exports ComponentErrorBoundary as a named export", () => {
    expect(typeof ComponentErrorBoundary).toBe("function");
  });

  // Tests R-P5-04
  it("exports useApiError as a named export", () => {
    expect(typeof useApiError).toBe("function");
  });

  // Tests R-P5-04 (default export preserved)
  it("preserves the default ErrorBoundary export for backwards compat", () => {
    expect(typeof ErrorBoundary).toBe("function");
  });
});
