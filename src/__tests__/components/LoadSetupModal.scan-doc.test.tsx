/**
 * Tests R-P4-19: LoadSetupModal Scan Doc click → onContinue receives autoTrigger='upload'
 *
 * Verifies the prop-drilling path from LoadSetupModal through onContinue.
 * The actual Scanner render happens in App.tsx; this test asserts the modal
 * passes the correct autoTrigger value through its onContinue callback.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { LoadSetupModal } from "../../../components/LoadSetupModal";
import type { User } from "../../../types";

vi.mock("../../../services/brokerService", () => ({
  getBrokers: vi
    .fn()
    .mockResolvedValue([
      { id: "broker-1", name: "Test Broker", email: "b@test.com", phone: "" },
    ]),
  saveBroker: vi.fn(),
}));

vi.mock("../../../services/authService", () => ({
  getCompanyUsers: vi.fn().mockResolvedValue([]),
  getCompany: vi.fn().mockResolvedValue({ id: "co-1", name: "Test Co" }),
  updateUser: vi.fn(),
}));

vi.mock("../../../services/storageService", () => ({
  generateNextLoadNumber: vi.fn().mockReturnValue("LP-0001"),
}));

const mockUser: User = {
  id: "u-1",
  companyId: "co-1",
  email: "dispatch@test.com",
  name: "Dispatcher",
  role: "dispatcher",
  onboardingStatus: "Completed",
  safetyScore: 100,
};

describe("LoadSetupModal Scan Doc → autoTrigger='upload' (R-P4-19)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Tests R-P4-19
  it("Scan Doc click fires onContinue with autoTrigger='upload' as the 7th positional argument", async () => {
    const onContinue = vi.fn();
    render(
      <LoadSetupModal
        currentUser={mockUser}
        preSelectedBrokerId="broker-1"
        onContinue={onContinue}
        onCancel={vi.fn()}
      />,
    );

    // Wait for brokers to load
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /scan doc/i }),
      ).toBeInTheDocument();
    });

    const scanDocBtn = screen.getByRole("button", { name: /scan doc/i });
    fireEvent.click(scanDocBtn);

    await waitFor(() => expect(onContinue).toHaveBeenCalled());

    // The 7th positional arg (index 6) is autoTrigger.
    // Signature: (brokerId, driverId, loadNumber?, callNotes?, overrideFreightType?, intermodalData?, autoTrigger?, phoneOrderData?)
    const call = onContinue.mock.calls[0];
    expect(call[6]).toBe("upload");
  });
});
