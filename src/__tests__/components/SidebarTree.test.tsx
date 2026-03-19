import { describe, it, expect, vi, beforeEach, type MockedFunction } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { SidebarTree } from "../../../components/SidebarTree";

describe("SidebarTree", () => {
  let setActiveTab: MockedFunction<(tab: string) => void>;
  let user: ReturnType<typeof userEvent.setup>;

  const defaultProps = {
    activeTab: "loads",
    permissions: {},
    userRole: "admin",
  };

  beforeEach(() => {
    setActiveTab = vi.fn<(tab: string) => void>();
    user = userEvent.setup();
  });

  it("renders all three category headers", () => {
    render(<SidebarTree {...defaultProps} setActiveTab={setActiveTab} />);
    expect(screen.getByText("Operations")).toBeInTheDocument();
    expect(screen.getByText("Network")).toBeInTheDocument();
    expect(screen.getByText("Enterprise")).toBeInTheDocument();
  });

  it("renders navigation items under Operations", () => {
    render(<SidebarTree {...defaultProps} setActiveTab={setActiveTab} />);
    expect(screen.getByText("Unified Operations")).toBeInTheDocument();
    expect(screen.getByText("Request / Intake")).toBeInTheDocument();
    expect(screen.getByText("Dispatch Board")).toBeInTheDocument();
    expect(screen.getByText("Schedule")).toBeInTheDocument();
  });

  it("renders navigation items under Network", () => {
    render(<SidebarTree {...defaultProps} setActiveTab={setActiveTab} />);
    expect(screen.getByText("Safety Hub")).toBeInTheDocument();
    expect(screen.getByText("Partner Network")).toBeInTheDocument();
  });

  it("renders navigation items under Enterprise", () => {
    render(<SidebarTree {...defaultProps} setActiveTab={setActiveTab} />);
    expect(screen.getByText("Financials")).toBeInTheDocument();
    expect(screen.getByText("Company Profile")).toBeInTheDocument();
    expect(screen.getByText("User Settings")).toBeInTheDocument();
  });

  it("highlights the active tab with blue styling", () => {
    render(
      <SidebarTree
        {...defaultProps}
        activeTab="loads"
        setActiveTab={setActiveTab}
      />,
    );
    const dispatchBtn = screen.getByText("Dispatch Board").closest("button")!;
    expect(dispatchBtn.className).toContain("bg-blue-600");
    expect(dispatchBtn.className).toContain("text-white");
  });

  it("does not highlight non-active tabs with blue styling", () => {
    render(
      <SidebarTree
        {...defaultProps}
        activeTab="loads"
        setActiveTab={setActiveTab}
      />,
    );
    const calendarBtn = screen.getByText("Schedule").closest("button")!;
    expect(calendarBtn.className).not.toContain("bg-blue-600");
    expect(calendarBtn.className).toContain("text-slate-400");
  });

  it("calls setActiveTab when a nav item is clicked", async () => {
    render(<SidebarTree {...defaultProps} setActiveTab={setActiveTab} />);
    await user.click(screen.getByText("Schedule"));
    expect(setActiveTab).toHaveBeenCalledWith("calendar");
  });

  it("calls setActiveTab with correct id for each item", async () => {
    render(<SidebarTree {...defaultProps} setActiveTab={setActiveTab} />);
    await user.click(screen.getByText("Safety Hub"));
    expect(setActiveTab).toHaveBeenCalledWith("safety");

    await user.click(screen.getByText("Financials"));
    expect(setActiveTab).toHaveBeenCalledWith("finance");
  });

  it("collapses a category when its header is clicked", async () => {
    render(<SidebarTree {...defaultProps} setActiveTab={setActiveTab} />);
    // Items should be visible initially (all categories expanded)
    expect(screen.getByText("Dispatch Board")).toBeInTheDocument();

    // Click the Operations category header to collapse
    await user.click(screen.getByText("Operations"));

    // Items under Operations should no longer be visible
    expect(screen.queryByText("Dispatch Board")).not.toBeInTheDocument();
    expect(screen.queryByText("Unified Operations")).not.toBeInTheDocument();
  });

  it("expands a collapsed category when its header is clicked again", async () => {
    render(<SidebarTree {...defaultProps} setActiveTab={setActiveTab} />);
    // Collapse Operations
    await user.click(screen.getByText("Operations"));
    expect(screen.queryByText("Dispatch Board")).not.toBeInTheDocument();

    // Expand Operations
    await user.click(screen.getByText("Operations"));
    expect(screen.getByText("Dispatch Board")).toBeInTheDocument();
  });

  it("keeps other categories expanded when one is collapsed", async () => {
    render(<SidebarTree {...defaultProps} setActiveTab={setActiveTab} />);
    // Collapse Operations
    await user.click(screen.getByText("Operations"));

    // Network and Enterprise items should still be visible
    expect(screen.getByText("Safety Hub")).toBeInTheDocument();
    expect(screen.getByText("Financials")).toBeInTheDocument();
  });

  it("renders ChevronDown for expanded and ChevronRight for collapsed categories", async () => {
    const { container } = render(
      <SidebarTree {...defaultProps} setActiveTab={setActiveTab} />,
    );
    // All categories start expanded; collapse one
    await user.click(screen.getByText("Network"));
    // After collapsing Network, Safety Hub should disappear
    expect(screen.queryByText("Safety Hub")).not.toBeInTheDocument();
    // Partner Network should also disappear
    expect(screen.queryByText("Partner Network")).not.toBeInTheDocument();
  });
});
