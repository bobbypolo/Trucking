/**
 * Tests R-P4-16, R-P4-17, R-P4-18: LoadSetupModal Phone Order 8-field form
 *
 * Verifies:
 *  - All 8 required inputs render in Phone Order mode
 *  - Submit is disabled until ALL 8 fields are filled
 *  - Save payload's legs array has exactly one Pickup + one Dropoff stop
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

async function renderAndOpenPhoneOrder() {
  const onContinue = vi.fn();
  render(
    <LoadSetupModal
      currentUser={mockUser}
      preSelectedBrokerId="broker-1"
      onContinue={onContinue}
      onCancel={vi.fn()}
    />,
  );

  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: /phone order/i }),
    ).toBeInTheDocument(),
  );

  // First click toggles isPhoneOrder ON (reveals the 8-field form)
  const phoneBtn = screen.getByRole("button", { name: /phone order/i });
  fireEvent.click(phoneBtn);

  // Wait for the Phone Order form to render
  await waitFor(() =>
    expect(screen.getByLabelText(/pickup city/i)).toBeInTheDocument(),
  );

  return { onContinue };
}

function fillAllPhoneFields() {
  fireEvent.change(screen.getByLabelText(/pickup city/i), {
    target: { value: "Chicago" },
  });
  fireEvent.change(screen.getByLabelText(/pickup state/i), {
    target: { value: "IL" },
  });
  fireEvent.change(screen.getByLabelText(/pickup date/i), {
    target: { value: "2026-04-10" },
  });
  fireEvent.change(screen.getByLabelText(/dropoff city/i), {
    target: { value: "Detroit" },
  });
  fireEvent.change(screen.getByLabelText(/dropoff state/i), {
    target: { value: "MI" },
  });
  fireEvent.change(screen.getByLabelText(/dropoff date/i), {
    target: { value: "2026-04-12" },
  });
  fireEvent.change(screen.getByLabelText(/^rate$/i), {
    target: { value: "1500" },
  });
  fireEvent.change(screen.getByLabelText(/equipment id/i), {
    target: { value: "EQ-001" },
  });
}

describe("LoadSetupModal Phone Order 8-field form (R-P4-16..R-P4-18)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Tests R-P4-16
  it("renders all 8 required input controls when Phone Order mode is active", async () => {
    await renderAndOpenPhoneOrder();
    expect(screen.getByLabelText(/pickup city/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/pickup state/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/pickup date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/dropoff city/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/dropoff state/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/dropoff date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^rate$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/equipment id/i)).toBeInTheDocument();
  });

  // Tests R-P4-17
  it("Submit button is disabled when any of the 8 required fields is empty", async () => {
    await renderAndOpenPhoneOrder();
    const submitBtn = screen.getByRole("button", {
      name: /create order|phone order/i,
    });
    expect(submitBtn).toBeDisabled();

    // Fill 7 of 8 fields, leave equipmentId empty
    fireEvent.change(screen.getByLabelText(/pickup city/i), {
      target: { value: "Chicago" },
    });
    fireEvent.change(screen.getByLabelText(/pickup state/i), {
      target: { value: "IL" },
    });
    fireEvent.change(screen.getByLabelText(/pickup date/i), {
      target: { value: "2026-04-10" },
    });
    fireEvent.change(screen.getByLabelText(/dropoff city/i), {
      target: { value: "Detroit" },
    });
    fireEvent.change(screen.getByLabelText(/dropoff state/i), {
      target: { value: "MI" },
    });
    fireEvent.change(screen.getByLabelText(/dropoff date/i), {
      target: { value: "2026-04-12" },
    });
    fireEvent.change(screen.getByLabelText(/^rate$/i), {
      target: { value: "1500" },
    });
    expect(submitBtn).toBeDisabled();

    // Fill the 8th field — now enabled
    fireEvent.change(screen.getByLabelText(/equipment id/i), {
      target: { value: "EQ-001" },
    });
    expect(submitBtn).not.toBeDisabled();
  });

  // Tests R-P4-18
  it("save payload legs array has exactly one Pickup + one Dropoff stop with field values", async () => {
    const { onContinue } = await renderAndOpenPhoneOrder();
    fillAllPhoneFields();

    const submitBtn = screen.getByRole("button", {
      name: /create order|phone order/i,
    });
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    await waitFor(() => expect(onContinue).toHaveBeenCalled());

    // 8th positional arg (index 7) is the phoneOrderData payload
    const phonePayload = onContinue.mock.calls[0][7];
    expect(phonePayload).toBeDefined();
    expect(Array.isArray(phonePayload.legs)).toBe(true);
    expect(phonePayload.legs).toHaveLength(2);

    const pickup = phonePayload.legs.find(
      (l: { type: string }) => l.type === "Pickup",
    );
    const dropoff = phonePayload.legs.find(
      (l: { type: string }) => l.type === "Dropoff",
    );

    expect(pickup).toEqual({
      type: "Pickup",
      city: "Chicago",
      state: "IL",
      date: "2026-04-10",
    });
    expect(dropoff).toEqual({
      type: "Dropoff",
      city: "Detroit",
      state: "MI",
      date: "2026-04-12",
    });
    expect(phonePayload.equipmentId).toBe("EQ-001");
    expect(phonePayload.rate).toBe("1500");
  });
});
