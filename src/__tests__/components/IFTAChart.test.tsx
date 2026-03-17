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
  BarChart: ({ children, data }: any) => (
    <div data-testid="bar-chart" data-item-count={data?.length ?? 0}>
      {children}
    </div>
  ),
  Bar: ({ dataKey }: any) => <div data-testid="bar" data-key={dataKey} />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: ({ dataKey }: any) => <div data-testid="y-axis" data-key={dataKey} />,
  Tooltip: () => <div data-testid="tooltip" />,
  Cell: () => <div data-testid="cell" />,
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
    expect(container).toBeInTheDocument();
  });

  it("renders the chart title", () => {
    render(<IFTAChart data={mockData} />);
    expect(screen.getByText("Estimated Mileage per Jurisdiction")).toBeInTheDocument();
  });

  it("renders empty state when data is empty", () => {
    render(<IFTAChart data={[]} />);
    expect(screen.getByText("No IFTA data available.")).toBeInTheDocument();
  });

  it("renders empty state when data is null/undefined", () => {
    render(<IFTAChart data={null as any} />);
    expect(screen.getByText("No IFTA data available.")).toBeInTheDocument();
  });

  it("renders chart container with data", () => {
    render(<IFTAChart data={mockData} />);
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
  });

  it("renders with a single data point", () => {
    render(<IFTAChart data={[{ state: "TX", estimatedMiles: 1000 }]} />);
    expect(screen.getByText("Estimated Mileage per Jurisdiction")).toBeInTheDocument();
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
  });

  it("does not render chart container for empty data", () => {
    render(<IFTAChart data={[]} />);
    expect(screen.queryByTestId("responsive-container")).not.toBeInTheDocument();
  });

  it("passes data to BarChart with correct item count", () => {
    render(<IFTAChart data={mockData} />);
    const barChart = screen.getByTestId("bar-chart");
    expect(barChart).toBeInTheDocument();
    expect(barChart.getAttribute("data-item-count")).toBe("4");
  });

  it("uses estimatedMiles as the bar dataKey", () => {
    render(<IFTAChart data={mockData} />);
    const bar = screen.getByTestId("bar");
    expect(bar.getAttribute("data-key")).toBe("estimatedMiles");
  });

  it("uses state as the Y-axis category", () => {
    render(<IFTAChart data={mockData} />);
    const yAxis = screen.getByTestId("y-axis");
    expect(yAxis.getAttribute("data-key")).toBe("state");
  });

  it("renders with multiple jurisdictions and passes correct item count", () => {
    render(<IFTAChart data={mockData} />);
    const barChart = screen.getByTestId("bar-chart");
    expect(barChart).toBeInTheDocument();
    expect(barChart.getAttribute("data-item-count")).toBe(String(mockData.length));
  });

  it("renders with large mileage values without error", () => {
    const largeData: IFTAStateEntry[] = [
      { state: "CA", estimatedMiles: 999999 },
      { state: "TX", estimatedMiles: 888888 },
    ];
    render(<IFTAChart data={largeData} />);
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
    expect(screen.getByTestId("bar-chart").getAttribute("data-item-count")).toBe("2");
  });
});
