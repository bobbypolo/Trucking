/**
 * Tests R-P5-10, R-P5-11: DriverLoadIntakePanel component
 *
 * Verifies:
 *  - Panel renders Scanner with autoTrigger="camera" and mode="intake" on mount
 *  - After Scanner's onDataExtracted fires and user confirms, fetch is called
 *    with POST /api/loads/driver-intake
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Scanner so we can control it in tests
vi.mock("../../../components/Scanner", () => ({
  Scanner: vi.fn(({ autoTrigger, mode, onDataExtracted }: any) => (
    <div
      data-testid="mock-scanner"
      data-auto-trigger={autoTrigger}
      data-mode={mode}
    >
      <button
        data-testid="scanner-extract-btn"
        onClick={() =>
          onDataExtracted({
            commodity: "Steel Coils",
            pickup: { city: "Dallas", state: "TX" },
            dropoff: { city: "Houston", state: "TX" },
          })
        }
      >
        Trigger OCR
      </button>
    </div>
  )),
}));

vi.mock("../../../services/authService", () => ({
  getIdTokenAsync: vi.fn().mockResolvedValue("mock-token"),
}));

import { DriverLoadIntakePanel } from "../../../components/driver/DriverLoadIntakePanel";

describe("DriverLoadIntakePanel", () => {
  const onComplete = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          id: "load-123",
          load_number: "DRAFT-abcd1234",
          status: "Draft",
          intake_source: "driver",
        }),
    });
  });

  // Tests R-P5-10
  it("Tests R-P5-10 — renders Scanner with autoTrigger=camera and mode=intake on mount", () => {
    render(
      <DriverLoadIntakePanel onComplete={onComplete} onCancel={onCancel} />,
    );

    const scanner = screen.getByTestId("mock-scanner");
    expect(scanner).toBeInTheDocument();
    expect(scanner.getAttribute("data-auto-trigger")).toBe("camera");
    expect(scanner.getAttribute("data-mode")).toBe("intake");
  });

  // Tests R-P5-11
  it("Tests R-P5-11 — calls fetch POST /api/loads/driver-intake after OCR fires and user confirms", async () => {
    render(
      <DriverLoadIntakePanel onComplete={onComplete} onCancel={onCancel} />,
    );

    // Trigger OCR extraction
    fireEvent.click(screen.getByTestId("scanner-extract-btn"));

    // Confirm button should appear in review screen
    const confirmBtn = await screen.findByTestId("intake-confirm-btn");
    expect(confirmBtn).toBeInTheDocument();

    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/loads/driver-intake"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        }),
      );
    });
  });

  it("shows success screen after successful submission", async () => {
    render(
      <DriverLoadIntakePanel onComplete={onComplete} onCancel={onCancel} />,
    );

    fireEvent.click(screen.getByTestId("scanner-extract-btn"));
    const confirmBtn = await screen.findByTestId("intake-confirm-btn");
    fireEvent.click(confirmBtn);

    await screen.findByText(/Submitted for dispatcher review/i);
  });
});
