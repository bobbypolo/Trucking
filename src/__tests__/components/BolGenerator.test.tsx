import { describe, it, expect, vi, beforeEach, type MockedFunction } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { BolGenerator } from "../../../components/BolGenerator";
import { LoadData, BolData } from "../../../types";

function makeLoad(overrides: Partial<LoadData> = {}): LoadData {
  return {
    id: "load-1",
    companyId: "co-1",
    driverId: "drv-1",
    loadNumber: "LD-100",
    status: "in_transit",
    carrierRate: 2500,
    driverPay: 1200,
    pickupDate: "2026-03-10",
    pickup: { city: "Dallas", state: "TX", facilityName: "Acme Warehouse" },
    dropoff: { city: "Houston", state: "TX", facilityName: "Beta Dock" },
    palletCount: 10,
    pieceCount: 200,
    weight: 35000,
    onboardingStatus: "Completed",
    safetyScore: 95,
    ...overrides,
  } as LoadData;
}

describe("BolGenerator", () => {
  let onSave: MockedFunction<(bolData: BolData) => void>;
  let onCancel: MockedFunction<() => void>;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    onSave = vi.fn<(bolData: BolData) => void>();
    onCancel = vi.fn<() => void>();
    user = userEvent.setup();
  });

  it("renders step 1 (Operations) by default with Pickup selected", () => {
    render(
      <BolGenerator load={makeLoad()} onSave={onSave} onCancel={onCancel} />,
    );
    expect(screen.getByText("1. Operations")).toBeInTheDocument();
    expect(screen.getByText("Origin (Pickup)")).toBeInTheDocument();
    expect(screen.getByText("Destination (Delivery)")).toBeInTheDocument();
    expect(
      screen.getByText(/Confirming: 10 Pallets, 200 Pieces. 35000 lbs./),
    ).toBeInTheDocument();
  });

  it("switches type from Pickup to Delivery", async () => {
    render(
      <BolGenerator load={makeLoad()} onSave={onSave} onCancel={onCancel} />,
    );
    const deliveryBtn = screen.getByText("Destination (Delivery)");
    await user.click(deliveryBtn);
    // Delivery button should now have active styling (bg-blue-600)
    expect(deliveryBtn.className).toContain("bg-blue-600");
  });

  it("navigates to step 2 when Next is clicked", async () => {
    render(
      <BolGenerator load={makeLoad()} onSave={onSave} onCancel={onCancel} />,
    );
    await user.click(screen.getByText("Next"));
    expect(
      screen.getByText("Capture signatures using touchscreen or mouse."),
    ).toBeInTheDocument();
    expect(screen.getByText("Driver Signature (Required)")).toBeInTheDocument();
  });

  it("navigates to step 3 when Next is clicked twice", async () => {
    render(
      <BolGenerator load={makeLoad()} onSave={onSave} onCancel={onCancel} />,
    );
    await user.click(screen.getByText("Next"));
    await user.click(screen.getByText("Next"));
    expect(screen.getByText("Generate Document")).toBeInTheDocument();
    expect(screen.getByText(/Creating Bill of Lading/)).toBeInTheDocument();
  });

  it("shows Proof of Delivery label on step 3 when type is Delivery", async () => {
    render(
      <BolGenerator load={makeLoad()} onSave={onSave} onCancel={onCancel} />,
    );
    await user.click(screen.getByText("Destination (Delivery)"));
    await user.click(screen.getByText("Next"));
    await user.click(screen.getByText("Next"));
    expect(screen.getByText(/Proof of Delivery/)).toBeInTheDocument();
  });

  it("navigates back from step 2 to step 1", async () => {
    render(
      <BolGenerator load={makeLoad()} onSave={onSave} onCancel={onCancel} />,
    );
    await user.click(screen.getByText("Next"));
    await user.click(screen.getByText("Back"));
    expect(screen.getByText("Origin (Pickup)")).toBeInTheDocument();
  });

  it("calls onCancel when Cancel button is clicked on step 1", async () => {
    render(
      <BolGenerator load={makeLoad()} onSave={onSave} onCancel={onCancel} />,
    );
    await user.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when the X button is clicked", async () => {
    render(
      <BolGenerator load={makeLoad()} onSave={onSave} onCancel={onCancel} />,
    );
    // The X close button is in the header area
    const header = screen.getByText("Electronic Document").closest("div")!;
    const closeBtn = within(header).getByRole("button");
    await user.click(closeBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("disables Save button when terms not accepted and no driver signature", async () => {
    render(
      <BolGenerator load={makeLoad()} onSave={onSave} onCancel={onCancel} />,
    );
    await user.click(screen.getByText("Next"));
    await user.click(screen.getByText("Next"));
    const saveBtn = screen.getByText("Save & Attach").closest("button")!;
    expect(saveBtn).toBeDisabled();
  });

  it("fills seal number input on step 1", async () => {
    render(
      <BolGenerator load={makeLoad()} onSave={onSave} onCancel={onCancel} />,
    );
    const sealInput = screen.getByPlaceholderText("Enter Seal #");
    await user.type(sealInput, "SEAL-999");
    expect(sealInput).toHaveValue("SEAL-999");
  });

  it("Mark Now buttons set time fields", async () => {
    render(
      <BolGenerator load={makeLoad()} onSave={onSave} onCancel={onCancel} />,
    );
    const markBtns = screen.getAllByText("Mark Now");
    expect(markBtns).toHaveLength(3);
    await user.click(markBtns[0]);
    // The time inputs don't have explicit for-linked labels, so check via input type
    const timeInputs = document.querySelectorAll('input[type="time"]');
    expect(timeInputs[0]).not.toHaveValue("");
  });

  it("shows step 2 shipper label for Pickup type", async () => {
    render(
      <BolGenerator load={makeLoad()} onSave={onSave} onCancel={onCancel} />,
    );
    await user.click(screen.getByText("Next"));
    expect(screen.getByText("Shipper Representative")).toBeInTheDocument();
    expect(screen.getByText("Shipper Signature")).toBeInTheDocument();
  });

  it("shows step 2 consignee label for Delivery type", async () => {
    render(
      <BolGenerator load={makeLoad()} onSave={onSave} onCancel={onCancel} />,
    );
    await user.click(screen.getByText("Destination (Delivery)"));
    await user.click(screen.getByText("Next"));
    expect(screen.getByText("Consignee Representative")).toBeInTheDocument();
    expect(screen.getByText("Receiver Signature")).toBeInTheDocument();
  });

  it("fills signatory title on step 2", async () => {
    render(
      <BolGenerator load={makeLoad()} onSave={onSave} onCancel={onCancel} />,
    );
    await user.click(screen.getByText("Next"));
    const titleInput = screen.getByPlaceholderText(/Signatory Name/);
    await user.type(titleInput, "John Doe, Supervisor");
    expect(titleInput).toHaveValue("John Doe, Supervisor");
  });

  it("pre-populates from existing generatedBol data", () => {
    const load = makeLoad({
      generatedBol: {
        generatedAt: "2026-03-10T00:00:00Z",
        type: "Pickup",
        driverSignature: "data:image/png;base64,abc",
        shipperSignature: "data:image/png;base64,def",
        signatoryTitle: "Dock Manager",
        sealNumber: "SEAL-123",
        timeArrived: "08:30",
        timeLoadingStart: "09:00",
        timeLoadingEnd: "10:30",
        termsAccepted: true,
      },
    });
    render(<BolGenerator load={load} onSave={onSave} onCancel={onCancel} />);
    const sealInput = screen.getByPlaceholderText("Enter Seal #");
    expect(sealInput).toHaveValue("SEAL-123");
  });

  it("shows review summary with correct data on step 3", async () => {
    render(
      <BolGenerator load={makeLoad()} onSave={onSave} onCancel={onCancel} />,
    );
    // Fill seal number
    await user.type(screen.getByPlaceholderText("Enter Seal #"), "SEAL-42");
    await user.click(screen.getByText("Next")); // to step 2
    await user.click(screen.getByText("Next")); // to step 3
    expect(screen.getByText("SEAL-42")).toBeInTheDocument();
    expect(screen.getByText("Seal Number:")).toBeInTheDocument();
    expect(screen.getByText("Driver Signed:")).toBeInTheDocument();
  });

  it("terms checkbox can be toggled on step 3", async () => {
    render(
      <BolGenerator load={makeLoad()} onSave={onSave} onCancel={onCancel} />,
    );
    await user.click(screen.getByText("Next"));
    await user.click(screen.getByText("Next"));
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
  });
});
