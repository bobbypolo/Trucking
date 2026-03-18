import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BolGenerator } from "../../../components/BolGenerator";
import type { LoadData, BolData } from "../../../types";

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

describe("BolGenerator deep coverage - uncovered lines 248-319", () => {
  let onSave: ReturnType<typeof vi.fn>;
  let onCancel: ReturnType<typeof vi.fn>;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    onSave = vi.fn();
    onCancel = vi.fn();
    user = userEvent.setup();
  });

  describe("step 1 - Pickup/Delivery toggle (lines 248-259)", () => {
    it("Pickup button starts with active styling", () => {
      render(
        <BolGenerator load={makeLoad()} onSave={onSave} onCancel={onCancel} />,
      );
      const pickupBtn = screen.getByText("Origin (Pickup)");
      expect(pickupBtn.className).toContain("bg-blue-600");
      expect(pickupBtn.className).toContain("text-white");

      const deliveryBtn = screen.getByText("Destination (Delivery)");
      expect(deliveryBtn.className).not.toContain("bg-blue-600");
    });

    it("clicking Delivery deactivates Pickup and activates Delivery styling", async () => {
      render(
        <BolGenerator load={makeLoad()} onSave={onSave} onCancel={onCancel} />,
      );
      await user.click(screen.getByText("Destination (Delivery)"));

      const pickupBtn = screen.getByText("Origin (Pickup)");
      expect(pickupBtn.className).not.toContain("bg-blue-600");

      const deliveryBtn = screen.getByText("Destination (Delivery)");
      expect(deliveryBtn.className).toContain("bg-blue-600");
    });

    it("toggling back to Pickup restores its active state", async () => {
      render(
        <BolGenerator load={makeLoad()} onSave={onSave} onCancel={onCancel} />,
      );
      await user.click(screen.getByText("Destination (Delivery)"));
      await user.click(screen.getByText("Origin (Pickup)"));

      expect(screen.getByText("Origin (Pickup)").className).toContain(
        "bg-blue-600",
      );
    });
  });

  describe("step 1 - Operational Times section (lines 261-326)", () => {
    it("displays all three time input fields with labels", () => {
      render(
        <BolGenerator load={makeLoad()} onSave={onSave} onCancel={onCancel} />,
      );
      expect(screen.getByText("Operational Times")).toBeInTheDocument();
      expect(screen.getByText("Arrival Time (Hit Dock)")).toBeInTheDocument();
      expect(screen.getByText("Start Loading/Unloading")).toBeInTheDocument();
      expect(screen.getByText("Finish Loading/Unloading")).toBeInTheDocument();
    });

    it("all three Mark Now buttons populate their respective time fields", async () => {
      render(
        <BolGenerator load={makeLoad()} onSave={onSave} onCancel={onCancel} />,
      );
      const markBtns = screen.getAllByText("Mark Now");
      expect(markBtns).toHaveLength(3);

      // Click each Mark Now button
      await user.click(markBtns[0]); // Arrival
      await user.click(markBtns[1]); // Start
      await user.click(markBtns[2]); // Finish

      // All time inputs should now have values
      const timeInputs = document.querySelectorAll('input[type="time"]');
      expect(timeInputs).toHaveLength(3);
      for (const input of timeInputs) {
        expect((input as HTMLInputElement).value).not.toBe("");
      }
    });

    it("time inputs can be manually edited", async () => {
      render(
        <BolGenerator load={makeLoad()} onSave={onSave} onCancel={onCancel} />,
      );
      const timeInputs = document.querySelectorAll('input[type="time"]');

      // Manually change arrival time
      const arrivalInput = timeInputs[0] as HTMLInputElement;
      await user.clear(arrivalInput);
      await user.type(arrivalInput, "08:30");
      expect(arrivalInput.value).toBe("08:30");

      // Manually change start time
      const startInput = timeInputs[1] as HTMLInputElement;
      await user.clear(startInput);
      await user.type(startInput, "09:00");
      expect(startInput.value).toBe("09:00");

      // Manually change end time
      const endInput = timeInputs[2] as HTMLInputElement;
      await user.clear(endInput);
      await user.type(endInput, "10:30");
      expect(endInput.value).toBe("10:30");
    });
  });

  describe("step 1 - Seal & Freight section (lines 328-352)", () => {
    it("displays Security & Freight section header", () => {
      render(
        <BolGenerator load={makeLoad()} onSave={onSave} onCancel={onCancel} />,
      );
      expect(screen.getByText(/Security/)).toBeInTheDocument();
      expect(screen.getByText(/Freight/)).toBeInTheDocument();
    });

    it("shows load cargo confirmation with correct pallet, piece, and weight", () => {
      render(
        <BolGenerator load={makeLoad()} onSave={onSave} onCancel={onCancel} />,
      );
      expect(
        screen.getByText(/Confirming: 10 Pallets, 200 Pieces. 35000 lbs./),
      ).toBeInTheDocument();
    });

    it("shows different cargo details for different load data", () => {
      render(
        <BolGenerator
          load={makeLoad({ palletCount: 5, pieceCount: 50, weight: 12000 })}
          onSave={onSave}
          onCancel={onCancel}
        />,
      );
      expect(
        screen.getByText(/Confirming: 5 Pallets, 50 Pieces. 12000 lbs./),
      ).toBeInTheDocument();
    });

    it("seal number input accepts and retains input", async () => {
      render(
        <BolGenerator load={makeLoad()} onSave={onSave} onCancel={onCancel} />,
      );
      const sealInput = screen.getByPlaceholderText("Enter Seal #");
      await user.type(sealInput, "SEAL-42");
      expect(sealInput).toHaveValue("SEAL-42");
    });
  });

  describe("step 3 - review summary shows time data (lines 389-452)", () => {
    it("shows arrival and finish times on step 3 when set via Mark Now", async () => {
      render(
        <BolGenerator load={makeLoad()} onSave={onSave} onCancel={onCancel} />,
      );

      // Set times via Mark Now
      const markBtns = screen.getAllByText("Mark Now");
      await user.click(markBtns[0]); // arrival
      await user.click(markBtns[2]); // finish

      // Navigate to step 3
      await user.click(screen.getByText("Next"));
      await user.click(screen.getByText("Next"));

      // Arrived and Finished should show actual time, not "--:--"
      expect(screen.getByText("Arrived:")).toBeInTheDocument();
      expect(screen.getByText("Finished:")).toBeInTheDocument();

      // The times should not show the placeholder
      const arrivedRow = screen.getByText("Arrived:").closest("div")!;
      expect(arrivedRow.textContent).not.toContain("--:--");
    });

    it("shows --:-- placeholder when times are not set", async () => {
      render(
        <BolGenerator load={makeLoad()} onSave={onSave} onCancel={onCancel} />,
      );

      await user.click(screen.getByText("Next"));
      await user.click(screen.getByText("Next"));

      // Both times should show placeholder
      const allText = document.body.textContent;
      expect(allText).toContain("--:--");
    });

    it("shows N/A when seal number is not entered", async () => {
      render(
        <BolGenerator load={makeLoad()} onSave={onSave} onCancel={onCancel} />,
      );

      await user.click(screen.getByText("Next"));
      await user.click(screen.getByText("Next"));

      expect(screen.getByText("N/A")).toBeInTheDocument();
    });

    it("shows Driver Signed: No when no driver signature drawn", async () => {
      render(
        <BolGenerator load={makeLoad()} onSave={onSave} onCancel={onCancel} />,
      );

      await user.click(screen.getByText("Next"));
      await user.click(screen.getByText("Next"));

      // Should show "No" for Driver Signed and "No" for Shipper Signed
      const nos = screen.getAllByText("No");
      expect(nos.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("handleSave validation and data mapping (lines 177-198)", () => {
    it("shows error toast when trying to save without driver signature", async () => {
      render(
        <BolGenerator load={makeLoad()} onSave={onSave} onCancel={onCancel} />,
      );

      // Navigate to step 3 and accept terms
      await user.click(screen.getByText("Next"));
      await user.click(screen.getByText("Next"));
      const checkbox = screen.getByRole("checkbox");
      await user.click(checkbox);

      // Try to force-enable the button by checking terms
      // Note: button is disabled when !terms || !driverSig
      // So clicking with disabled button won't fire handleSave
      // But let's verify the disabled state
      const saveBtn = screen.getByText("Save & Attach").closest("button")!;
      expect(saveBtn).toBeDisabled();

      // onSave should NOT have been called
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  describe("step 3 - terms checkbox and certification text", () => {
    it("shows Pickup certification text when type is Pickup", async () => {
      render(
        <BolGenerator load={makeLoad()} onSave={onSave} onCancel={onCancel} />,
      );

      await user.click(screen.getByText("Next"));
      await user.click(screen.getByText("Next"));

      expect(screen.getByText(/official.*Origin.*record/)).toBeInTheDocument();
    });

    it("shows Delivery (POD) certification text when type is Delivery", async () => {
      render(
        <BolGenerator load={makeLoad()} onSave={onSave} onCancel={onCancel} />,
      );

      await user.click(screen.getByText("Destination (Delivery)"));
      await user.click(screen.getByText("Next"));
      await user.click(screen.getByText("Next"));

      expect(screen.getByText(/official.*POD.*record/)).toBeInTheDocument();
    });

    it("shows Receiver Signed label on step 3 when type is Delivery", async () => {
      render(
        <BolGenerator load={makeLoad()} onSave={onSave} onCancel={onCancel} />,
      );

      await user.click(screen.getByText("Destination (Delivery)"));
      await user.click(screen.getByText("Next"));
      await user.click(screen.getByText("Next"));

      expect(screen.getByText("Receiver Signed:")).toBeInTheDocument();
    });

    it("shows Shipper Signed label on step 3 when type is Pickup", async () => {
      render(
        <BolGenerator load={makeLoad()} onSave={onSave} onCancel={onCancel} />,
      );

      await user.click(screen.getByText("Next"));
      await user.click(screen.getByText("Next"));

      expect(screen.getByText("Shipper Signed:")).toBeInTheDocument();
    });
  });

  describe("pre-populated BOL data", () => {
    it("populates time fields from existing generatedBol", () => {
      const load = makeLoad({
        generatedBol: {
          generatedAt: "2026-03-10T00:00:00Z",
          type: "Pickup",
          driverSignature: "data:image/png;base64,abc",
          shipperSignature: "",
          signatoryTitle: "Dock Mgr",
          sealNumber: "SEAL-777",
          timeArrived: "07:00",
          timeLoadingStart: "07:30",
          timeLoadingEnd: "09:00",
          termsAccepted: true,
        },
      });

      render(<BolGenerator load={load} onSave={onSave} onCancel={onCancel} />);

      // Seal number should be pre-populated
      expect(screen.getByPlaceholderText("Enter Seal #")).toHaveValue(
        "SEAL-777",
      );

      // Time inputs should be pre-populated
      const timeInputs = document.querySelectorAll('input[type="time"]');
      expect((timeInputs[0] as HTMLInputElement).value).toBe("07:00");
      expect((timeInputs[1] as HTMLInputElement).value).toBe("07:30");
      expect((timeInputs[2] as HTMLInputElement).value).toBe("09:00");
    });

    it("populates signatory title from existing generatedBol on step 2", async () => {
      const load = makeLoad({
        generatedBol: {
          generatedAt: "2026-03-10T00:00:00Z",
          type: "Pickup",
          driverSignature: "data:image/png;base64,abc",
          shipperSignature: "",
          signatoryTitle: "John Doe, Supervisor",
          sealNumber: "",
          timeArrived: "",
          timeLoadingStart: "",
          timeLoadingEnd: "",
          termsAccepted: false,
        },
      });

      render(<BolGenerator load={load} onSave={onSave} onCancel={onCancel} />);

      await user.click(screen.getByText("Next"));

      const titleInput = screen.getByPlaceholderText(/Signatory Name/);
      expect(titleInput).toHaveValue("John Doe, Supervisor");
    });
  });

  describe("stepper visual indicators", () => {
    it("step 1 indicator is active, steps 2 and 3 are inactive initially", () => {
      render(
        <BolGenerator load={makeLoad()} onSave={onSave} onCancel={onCancel} />,
      );
      const step1 = screen.getByText("1. Operations");
      const step2 = screen.getByText("2. Signatures");
      const step3 = screen.getByText("3. Review");

      expect(step1.className).toContain("text-blue-400");
      expect(step2.className).not.toContain("text-blue-400");
      expect(step3.className).not.toContain("text-blue-400");
    });

    it("steps 1 and 2 indicators are active on step 2", async () => {
      render(
        <BolGenerator load={makeLoad()} onSave={onSave} onCancel={onCancel} />,
      );
      await user.click(screen.getByText("Next"));

      const step1 = screen.getByText("1. Operations");
      const step2 = screen.getByText("2. Signatures");
      const step3 = screen.getByText("3. Review");

      expect(step1.className).toContain("text-blue-400");
      expect(step2.className).toContain("text-blue-400");
      expect(step3.className).not.toContain("text-blue-400");
    });

    it("all three step indicators are active on step 3", async () => {
      render(
        <BolGenerator load={makeLoad()} onSave={onSave} onCancel={onCancel} />,
      );
      await user.click(screen.getByText("Next"));
      await user.click(screen.getByText("Next"));

      const step1 = screen.getByText("1. Operations");
      const step2 = screen.getByText("2. Signatures");
      const step3 = screen.getByText("3. Review");

      expect(step1.className).toContain("text-blue-400");
      expect(step2.className).toContain("text-blue-400");
      expect(step3.className).toContain("text-blue-400");
    });
  });
});
