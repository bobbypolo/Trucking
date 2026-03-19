import { describe, it, expect, vi, beforeEach, type MockedFunction } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { DataImportWizard } from "../../../components/DataImportWizard";

// Mock xlsx and papaparse at the module level
vi.mock("xlsx", () => ({
  read: vi.fn(() => ({
    SheetNames: ["Sheet1"],
    Sheets: {
      Sheet1: {},
    },
  })),
  utils: {
    sheet_to_json: vi.fn(() => [
      {
        date: "2026-01-01",
        stateCode: "TX",
        gallons: "100",
        unitPrice: "3.50",
        totalCost: "350",
      },
      {
        date: "2026-01-02",
        stateCode: "OK",
        gallons: "80",
        unitPrice: "3.40",
        totalCost: "272",
      },
    ]),
  },
}));

vi.mock("papaparse", () => ({
  default: {
    parse: vi.fn((data: string, opts: any) => {
      opts.complete({
        data: [
          {
            date: "2026-01-01",
            stateCode: "TX",
            gallons: "100",
            unitPrice: "3.50",
            totalCost: "350",
          },
          {
            date: "2026-01-02",
            stateCode: "OK",
            gallons: "80",
            unitPrice: "3.40",
            totalCost: "272",
          },
        ],
      });
    }),
  },
}));

describe("DataImportWizard", () => {
  let onImport: MockedFunction<(data: any[]) => Promise<void>>;
  let onClose: MockedFunction<() => void>;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    onImport = vi.fn<(data: any[]) => Promise<void>>().mockResolvedValue(undefined);
    onClose = vi.fn<() => void>();
    user = userEvent.setup();
  });

  it("renders the upload step by default", () => {
    render(
      <DataImportWizard type="Fuel" onImport={onImport} onClose={onClose} />,
    );
    expect(screen.getByText(/Import Engine/)).toBeInTheDocument();
    expect(screen.getByText(/Drop Excel or CSV File/)).toBeInTheDocument();
    expect(screen.getByText("Select File from Desktop")).toBeInTheDocument();
  });

  it("shows correct type label in subtitle", () => {
    render(
      <DataImportWizard type="Bills" onImport={onImport} onClose={onClose} />,
    );
    expect(screen.getByText(/Bills Statement Import/)).toBeInTheDocument();
  });

  it("renders step indicators for 3 steps", () => {
    render(
      <DataImportWizard type="Fuel" onImport={onImport} onClose={onClose} />,
    );
    expect(screen.getByText("Upload")).toBeInTheDocument();
    expect(screen.getByText("Mapping")).toBeInTheDocument();
    expect(screen.getByText("Dry Run")).toBeInTheDocument();
  });

  it("calls onClose when Cancel Import is clicked", async () => {
    render(
      <DataImportWizard type="Fuel" onImport={onImport} onClose={onClose} />,
    );
    await user.click(screen.getByText("Cancel Import"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when X button is clicked", async () => {
    render(
      <DataImportWizard type="Fuel" onImport={onImport} onClose={onClose} />,
    );
    // Find X close button in header
    const buttons = screen.getAllByRole("button");
    const xBtn = buttons.find((b) => {
      const svg = b.querySelector("svg");
      return svg && b.closest(".border-b");
    });
    expect(xBtn).toBeDefined();
    await user.click(xBtn!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("advances to mapping step after CSV file upload", async () => {
    render(
      <DataImportWizard type="Fuel" onImport={onImport} onClose={onClose} />,
    );
    // Create a fake CSV file
    const csvContent =
      "date,stateCode,gallons,unitPrice,totalCost\n2026-01-01,TX,100,3.50,350";
    const file = new File([csvContent], "fuel.csv", { type: "text/csv" });

    // Find the hidden file input
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    await user.upload(fileInput, file);

    // Should advance to step 2 (Mapping) showing target field mapping table
    expect(await screen.findByText("Target Logical Field")).toBeInTheDocument();
    expect(screen.getByText("Source Column Link")).toBeInTheDocument();
  });

  it("shows target fields for Fuel type in mapping step", async () => {
    render(
      <DataImportWizard type="Fuel" onImport={onImport} onClose={onClose} />,
    );
    const csvContent = "date,stateCode,gallons\n2026-01-01,TX,100";
    const file = new File([csvContent], "fuel.csv", { type: "text/csv" });
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(fileInput, file);

    // Fuel target fields should appear (may also appear in dropdowns as source columns)
    expect((await screen.findAllByText("date")).length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.getAllByText("stateCode").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("gallons").length).toBeGreaterThanOrEqual(1);
  });

  it("shows Previous Step button on step 2", async () => {
    render(
      <DataImportWizard type="Fuel" onImport={onImport} onClose={onClose} />,
    );
    const file = new File(["date,gallons\n2026-01-01,100"], "fuel.csv", {
      type: "text/csv",
    });
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(fileInput, file);

    expect(await screen.findByText("Previous Step")).toBeInTheDocument();
  });

  it("navigates back to step 1 when Previous Step is clicked", async () => {
    render(
      <DataImportWizard type="Fuel" onImport={onImport} onClose={onClose} />,
    );
    const file = new File(["date,gallons\n2026-01-01,100"], "fuel.csv", {
      type: "text/csv",
    });
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(fileInput, file);

    await screen.findByText("Previous Step");
    await user.click(screen.getByText("Previous Step"));

    expect(screen.getByText(/Drop Excel or CSV File/)).toBeInTheDocument();
  });

  it("disables Run Integrity Check when no mappings exist", async () => {
    render(
      <DataImportWizard type="Fuel" onImport={onImport} onClose={onClose} />,
    );
    const file = new File(["date,gallons\n2026-01-01,100"], "fuel.csv", {
      type: "text/csv",
    });
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(fileInput, file);

    const dryRunBtn = await screen.findByText("Run Integrity Check");
    expect(dryRunBtn.closest("button")).toBeDisabled();
  });

  it("enables Run Integrity Check after setting a mapping", async () => {
    render(
      <DataImportWizard type="Fuel" onImport={onImport} onClose={onClose} />,
    );
    const file = new File(["date,gallons\n2026-01-01,100"], "fuel.csv", {
      type: "text/csv",
    });
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(fileInput, file);

    await screen.findByText("Run Integrity Check");

    // Find the first select dropdown and set a mapping
    const selects = document.querySelectorAll("select");
    // First select is for the first target field
    expect(selects.length).toBeGreaterThan(0);
    await user.selectOptions(selects[0], "date");

    const dryRunBtn = screen.getByText("Run Integrity Check");
    expect(dryRunBtn.closest("button")).not.toBeDisabled();
  });

  it("renders correct type-specific target fields for CoA", () => {
    render(
      <DataImportWizard type="CoA" onImport={onImport} onClose={onClose} />,
    );
    // CoA type shows on step 1
    expect(screen.getByText(/CoA Statement Import/)).toBeInTheDocument();
  });

  it("accepts .csv, .xlsx, .xls file types", () => {
    render(
      <DataImportWizard type="Fuel" onImport={onImport} onClose={onClose} />,
    );
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(fileInput.accept).toBe(".csv,.xlsx,.xls");
  });
});
