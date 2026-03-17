import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { IFTAChart } from "../../../components/IFTAChart";
import { IFTAStateEntry } from "../../../types";

// Recharts uses SVG elements that jsdom doesn't fully support.
// Provide a thin shim for ResponsiveContainer and chart components.
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container" style={{ width: 500, height: 256 }}>
      {children}
    </div>
  ),
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  Cell: () => <div />,
}));

const mockData: IFTAStateEntry[] = [
  { state: "TX", estimatedMiles: 5000 },
  { state: "OK", estimatedMiles: 2000 },
  { state: "AR", estimatedMiles: 1500 },
  { state: "LA", estimatedMiles: 800 },
];

describe("IFTAChart component", () => {
  it("renders without crashing with data", () => {
    const { container } = render(<IFTAChart data={mockData} />);
    expect(container).toBeTruthy();
  });

  it("renders the chart title", () => {
    render(<IFTAChart data={mockData} />);
    expect(screen.getByText("Estimated Mileage per Jurisdiction")).toBeTruthy();
  });

  it("renders empty state when data is empty", () => {
    render(<IFTAChart data={[]} />);
    expect(screen.getByText("No IFTA data available.")).toBeTruthy();
  });

  it("renders empty state when data is null/undefined", () => {
    render(<IFTAChart data={null as any} />);
    expect(screen.getByText("No IFTA data available.")).toBeTruthy();
  });

  it("renders chart container with data", () => {
    render(<IFTAChart data={mockData} />);
    expect(screen.getByTestId("responsive-container")).toBeTruthy();
  });

  it("renders with a single data point", () => {
    render(<IFTAChart data={[{ state: "TX", estimatedMiles: 1000 }]} />);
    expect(screen.getByText("Estimated Mileage per Jurisdiction")).toBeTruthy();
    expect(screen.getByTestId("responsive-container")).toBeTruthy();
  });
});
