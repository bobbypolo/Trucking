import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

/**
 * Tests R-P8-05, R-P8-06
 *
 * Verifies SettlementDetail renders line items with load reference,
 * description, and amount. Shows deductions, reimbursements, and net pay.
 */

// Mock react-native components
vi.mock("react-native", () => {
  const RN = {
    View: ({ children, style, testID, ...props }: any) =>
      React.createElement(
        "div",
        { "data-testid": testID, style, ...props },
        children,
      ),
    Text: ({ children, style, ...props }: any) =>
      React.createElement("span", { style, ...props }, children),
    FlatList: ({ data, renderItem, keyExtractor, scrollEnabled }: any) => {
      if (!data || data.length === 0) {
        return React.createElement("div", { "data-testid": "flatlist-empty" });
      }
      return React.createElement(
        "div",
        { "data-testid": "flatlist" },
        data.map((item: any, index: number) =>
          React.createElement(
            "div",
            {
              key: keyExtractor ? keyExtractor(item, index) : index,
              "data-testid": `flatlist-item-${index}`,
            },
            renderItem({ item, index }),
          ),
        ),
      );
    },
    StyleSheet: { create: (s: any) => s },
  };
  return { ...RN, default: RN };
});

const sampleSettlement = {
  id: "set-001",
  company_id: "co-1",
  driver_id: "drv-1",
  settlement_date: "2026-04-01",
  period_start: "2026-03-16",
  period_end: "2026-03-31",
  total_earnings: 2500.0,
  total_deductions: 350.0,
  total_reimbursements: 100.0,
  net_pay: 2250.0,
  status: "Approved",
  lines: [
    {
      id: "line-1",
      settlement_id: "set-001",
      description: "Linehaul Chicago to Dallas",
      amount: 1800.0,
      load_id: "LD-1234",
      type: "earning",
    },
    {
      id: "line-2",
      settlement_id: "set-001",
      description: "Detention pay",
      amount: 700.0,
      load_id: "LD-5678",
      type: "earning",
    },
    {
      id: "line-3",
      settlement_id: "set-001",
      description: "Insurance premium",
      amount: 200.0,
      load_id: null,
      type: "deduction",
    },
    {
      id: "line-4",
      settlement_id: "set-001",
      description: "ELD lease",
      amount: 150.0,
      load_id: null,
      type: "deduction",
    },
    {
      id: "line-5",
      settlement_id: "set-001",
      description: "Fuel advance reimbursement",
      amount: 100.0,
      load_id: "LD-1234",
      type: "reimbursement",
    },
  ],
};

describe("R-P8-05: SettlementDetail renders line items", () => {
  // # Tests R-P8-05
  it("renders line items with load reference, description, and amount", async () => {
    const SettlementDetail = (
      await import("../../src/components/SettlementDetail")
    ).default;

    render(
      React.createElement(SettlementDetail, { settlement: sampleSettlement }),
    );

    // Load references displayed (LD-1234 appears in earning + reimbursement)
    const ld1234Refs = screen.getAllByText("Load #LD-1234");
    expect(ld1234Refs).toHaveLength(2);
    expect(screen.getByText("Load #LD-5678")).toBeTruthy();

    // Descriptions displayed
    expect(screen.getByText("Linehaul Chicago to Dallas")).toBeTruthy();
    expect(screen.getByText("Detention pay")).toBeTruthy();
    expect(screen.getByText("Insurance premium")).toBeTruthy();
    expect(screen.getByText("ELD lease")).toBeTruthy();
    expect(screen.getByText("Fuel advance reimbursement")).toBeTruthy();

    // Amounts displayed (formatCurrency uses Math.abs + toFixed(2))
    expect(screen.getByText("$1800.00")).toBeTruthy();
    expect(screen.getByText("$700.00")).toBeTruthy();
    expect(screen.getByText("$200.00")).toBeTruthy();
    expect(screen.getByText("$150.00")).toBeTruthy();
    // $100.00 appears as line amount AND as Total Reimbursements subtotal
    const hundredAmounts = screen.getAllByText("$100.00");
    expect(hundredAmounts).toHaveLength(2);
  });

  // # Tests R-P8-05
  it("renders section titles for earnings, deductions, and reimbursements", async () => {
    const SettlementDetail = (
      await import("../../src/components/SettlementDetail")
    ).default;

    render(
      React.createElement(SettlementDetail, { settlement: sampleSettlement }),
    );

    expect(screen.getByText("Earnings")).toBeTruthy();
    expect(screen.getByText("Deductions")).toBeTruthy();
    expect(screen.getByText("Reimbursements")).toBeTruthy();
  });
});

describe("R-P8-06: SettlementDetail shows deductions, reimbursements, net pay", () => {
  // # Tests R-P8-06
  it("shows total deductions, total reimbursements, and net pay", async () => {
    const SettlementDetail = (
      await import("../../src/components/SettlementDetail")
    ).default;

    render(
      React.createElement(SettlementDetail, { settlement: sampleSettlement }),
    );

    // Total Earnings subtotal
    expect(screen.getByText("Total Earnings")).toBeTruthy();
    expect(screen.getByText("$2500.00")).toBeTruthy();

    // Total Deductions subtotal
    expect(screen.getByText("Total Deductions")).toBeTruthy();
    expect(screen.getByText("$350.00")).toBeTruthy();

    // Total Reimbursements subtotal
    expect(screen.getByText("Total Reimbursements")).toBeTruthy();

    // Net Pay
    expect(screen.getByText("Net Pay")).toBeTruthy();
    expect(screen.getByText("$2250.00")).toBeTruthy();
  });

  // # Tests R-P8-06
  it("renders settlement status and period", async () => {
    const SettlementDetail = (
      await import("../../src/components/SettlementDetail")
    ).default;

    render(
      React.createElement(SettlementDetail, { settlement: sampleSettlement }),
    );

    expect(screen.getByText("Approved")).toBeTruthy();
    expect(screen.getByText("2026-03-16 - 2026-03-31")).toBeTruthy();
  });
});
