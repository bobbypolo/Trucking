// Tests R-P3-13
import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CalendarView } from "../../../components/CalendarView";

describe("CalendarView: EmptyState for empty loads (R-P3-13)", () => {
  it("renders EmptyState with No loads scheduled message when given empty loads array", () => {
    render(<CalendarView loads={[]} onEdit={vi.fn()} />);

    const text = document.body.textContent || "";
    expect(text.toLowerCase()).toContain("no loads scheduled");
  });
});
