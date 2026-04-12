import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import {
  render,
  screen,
  act,
  waitFor,
  fireEvent,
} from "@testing-library/react";

/**
 * Tests R-P8-02, R-P8-03, R-P8-04
 *
 * Verifies PayScreen renders FlatList with settlement data,
 * shows empty state, and navigates to detail on press.
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
    FlatList: ({ data, renderItem, keyExtractor, ListEmptyComponent }: any) => {
      if (!data || data.length === 0) {
        return React.createElement(
          "div",
          { "data-testid": "flatlist-empty" },
          typeof ListEmptyComponent === "function"
            ? React.createElement(ListEmptyComponent)
            : ListEmptyComponent,
        );
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
    Pressable: ({ children, onPress, style, ...props }: any) =>
      React.createElement(
        "button",
        { onClick: onPress, style, ...props },
        children,
      ),
    StyleSheet: { create: (s: any) => s },
    ActivityIndicator: ({ size, ...props }: any) =>
      React.createElement(
        "div",
        { "data-testid": "activity-indicator", ...props },
        "Loading...",
      ),
  };
  return { ...RN, default: RN };
});

// Mock expo-router
const mockPush = vi.fn();
vi.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: () => {},
    back: () => {},
  }),
  Tabs: Object.assign(
    ({ children }: any) => React.createElement("div", null, children),
    {
      Screen: ({ name }: any) => React.createElement("div", null, name),
    },
  ),
}));

// Mock fetchSettlements
const mockFetchSettlements = vi.fn();
vi.mock("../../src/services/settlements", () => ({
  fetchSettlements: (...args: any[]) => mockFetchSettlements(...args),
}));

vi.mock("../../src/types/settlement", () => ({}));

const sampleSettlements = [
  {
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
    lines: [],
  },
  {
    id: "set-002",
    company_id: "co-1",
    driver_id: "drv-1",
    settlement_date: "2026-03-15",
    period_start: "2026-03-01",
    period_end: "2026-03-15",
    total_earnings: 1800.0,
    total_deductions: 200.0,
    total_reimbursements: 50.0,
    net_pay: 1650.0,
    status: "Pending",
    lines: [],
  },
];

describe("R-P8-02: PayScreen renders FlatList with settlements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // # Tests R-P8-02
  it("renders settlement rows with status, total_amount, and pay_period", async () => {
    mockFetchSettlements.mockResolvedValueOnce(sampleSettlements);

    const PayScreen = (await import("../../src/app/(tabs)/pay")).default;

    await act(async () => {
      render(React.createElement(PayScreen));
    });

    await waitFor(() => {
      expect(screen.getByText("Approved")).toBeTruthy();
    });

    // Status rendered
    expect(screen.getByText("Approved")).toBeTruthy();
    expect(screen.getByText("Pending")).toBeTruthy();

    // Net pay amounts rendered
    expect(screen.getByText("$2250.00")).toBeTruthy();
    expect(screen.getByText("$1650.00")).toBeTruthy();

    // Pay periods rendered
    expect(screen.getByText("2026-03-16 - 2026-03-31")).toBeTruthy();
    expect(screen.getByText("2026-03-01 - 2026-03-15")).toBeTruthy();

    // Correct number of items
    const items = screen.getAllByTestId(/^flatlist-item-/);
    expect(items).toHaveLength(2);
  });
});

describe("R-P8-03: PayScreen empty state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // # Tests R-P8-03
  it("shows empty state message when no settlements exist", async () => {
    mockFetchSettlements.mockResolvedValueOnce([]);

    const PayScreen = (await import("../../src/app/(tabs)/pay")).default;

    await act(async () => {
      render(React.createElement(PayScreen));
    });

    await waitFor(() => {
      expect(screen.getByText("No settlements found")).toBeTruthy();
    });
  });
});

describe("R-P8-04: PayScreen navigation to SettlementDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // # Tests R-P8-04
  it("navigates to SettlementDetail when pressing a settlement row", async () => {
    mockFetchSettlements.mockResolvedValueOnce(sampleSettlements);

    const PayScreen = (await import("../../src/app/(tabs)/pay")).default;

    await act(async () => {
      render(React.createElement(PayScreen));
    });

    await waitFor(() => {
      expect(screen.getByText("Approved")).toBeTruthy();
    });

    // Click the first settlement row (Pressable renders as button)
    const firstItem = screen.getByText("Approved").closest("button");
    expect(firstItem).toBeTruthy();

    await act(async () => {
      fireEvent.click(firstItem!);
    });

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/settlement-detail",
      params: { settlementId: "set-001" },
    });
  });
});
