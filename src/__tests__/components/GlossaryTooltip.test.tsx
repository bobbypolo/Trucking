// Tests R-P5-05
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { GlossaryTooltip } from "../../../components/GlossaryTooltip";

describe("GlossaryTooltip component (R-P5-05)", () => {
  it("renders children for a known term", () => {
    render(
      <GlossaryTooltip term="BOL">
        <span>Bill of Lading</span>
      </GlossaryTooltip>,
    );
    expect(screen.getByText("Bill of Lading")).toBeTruthy();
  });

  it("renders children for an unknown term without tooltip wrapper", () => {
    const { container } = render(
      <GlossaryTooltip term="UNKNOWN_TERM_XYZ">
        <span>Some text</span>
      </GlossaryTooltip>,
    );
    expect(screen.getByText("Some text")).toBeTruthy();
    // No tooltip trigger span should exist for unknown terms
    expect(
      container.querySelector('[data-testid="glossary-tooltip-trigger"]'),
    ).toBeNull();
  });

  it("does not show tooltip content initially for a known term", () => {
    render(
      <GlossaryTooltip term="IFTA">
        <span>IFTA</span>
      </GlossaryTooltip>,
    );
    expect(screen.queryByTestId("glossary-tooltip-content")).toBeNull();
  });

  it("shows tooltip with definition on mouseenter for known term", () => {
    render(
      <GlossaryTooltip term="BOL">
        <span>BOL</span>
      </GlossaryTooltip>,
    );

    const trigger = screen.getByTestId("glossary-tooltip-trigger");
    fireEvent.mouseEnter(trigger);

    const tooltip = screen.getByTestId("glossary-tooltip-content");
    expect(tooltip).toBeTruthy();
    // Tooltip should contain the definition text
    expect(tooltip.textContent).toContain("Bill of Lading");
  });

  it("hides tooltip on mouseleave", () => {
    render(
      <GlossaryTooltip term="BOL">
        <span>BOL</span>
      </GlossaryTooltip>,
    );

    const trigger = screen.getByTestId("glossary-tooltip-trigger");
    fireEvent.mouseEnter(trigger);
    expect(screen.getByTestId("glossary-tooltip-content")).toBeTruthy();

    fireEvent.mouseLeave(trigger);
    expect(screen.queryByTestId("glossary-tooltip-content")).toBeNull();
  });

  it("tooltip has role=tooltip for accessibility", () => {
    render(
      <GlossaryTooltip term="IFTA">
        <span>IFTA</span>
      </GlossaryTooltip>,
    );

    const trigger = screen.getByTestId("glossary-tooltip-trigger");
    fireEvent.mouseEnter(trigger);

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toBeTruthy();
  });

  it("is case-insensitive for the term prop", () => {
    render(
      <GlossaryTooltip term="bol">
        <span>bol</span>
      </GlossaryTooltip>,
    );

    const trigger = screen.getByTestId("glossary-tooltip-trigger");
    fireEvent.mouseEnter(trigger);

    const tooltip = screen.getByTestId("glossary-tooltip-content");
    expect(tooltip.textContent).toContain("Bill of Lading");
  });

  it("shows definition for DETENTION term", () => {
    render(
      <GlossaryTooltip term="DETENTION">
        <span>detention</span>
      </GlossaryTooltip>,
    );

    const trigger = screen.getByTestId("glossary-tooltip-trigger");
    fireEvent.mouseEnter(trigger);

    const tooltip = screen.getByTestId("glossary-tooltip-content");
    expect(tooltip.textContent).toContain("DETENTION");
  });
});
