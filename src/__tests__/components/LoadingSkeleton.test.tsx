// Tests R-S22-01, R-S22-03
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";

describe("LoadingSkeleton component (R-S22-01)", () => {
  it("renders card variant without crashing", () => {
    const { container } = render(<LoadingSkeleton variant="card" />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders table variant without crashing", () => {
    const { container } = render(<LoadingSkeleton variant="table" />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders list variant without crashing", () => {
    const { container } = render(<LoadingSkeleton variant="list" />);
    expect(container.firstChild).toBeTruthy();
  });

  it("card variant has animate-pulse class for shimmer effect", () => {
    const { container } = render(<LoadingSkeleton variant="card" />);
    const animated = container.querySelector(".animate-pulse");
    expect(animated).toBeTruthy();
  });

  it("table variant has animate-pulse class for shimmer effect", () => {
    const { container } = render(<LoadingSkeleton variant="table" />);
    const animated = container.querySelector(".animate-pulse");
    expect(animated).toBeTruthy();
  });

  it("list variant has animate-pulse class for shimmer effect", () => {
    const { container } = render(<LoadingSkeleton variant="list" />);
    const animated = container.querySelector(".animate-pulse");
    expect(animated).toBeTruthy();
  });

  it("renders 3 items by default for card variant", () => {
    const { container } = render(<LoadingSkeleton variant="card" />);
    // count prop defaults to 3; each card is a direct child of the wrapper
    const items = container.querySelectorAll("[data-skeleton-item]");
    expect(items.length).toBe(3);
  });

  it("respects count prop for list variant", () => {
    const { container } = render(<LoadingSkeleton variant="list" count={5} />);
    const items = container.querySelectorAll("[data-skeleton-item]");
    expect(items.length).toBe(5);
  });

  it("has accessible aria-busy attribute", () => {
    const { container } = render(<LoadingSkeleton variant="card" />);
    const wrapper = container.querySelector("[aria-busy]");
    expect(wrapper).toBeTruthy();
    expect(wrapper?.getAttribute("aria-busy")).toBe("true");
  });

  it("has aria-label describing loading state", () => {
    const { container } = render(<LoadingSkeleton variant="card" />);
    const wrapper = container.querySelector("[aria-label]");
    expect(wrapper).toBeTruthy();
  });
});
