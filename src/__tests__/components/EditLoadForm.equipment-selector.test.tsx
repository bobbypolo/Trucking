/**
 * Tests R-P4-09, R-P4-10, R-P4-11: EditLoadForm equipment selector
 *
 * Verifies:
 *  - The equipment selector renders when /api/equipment returns a non-empty list
 *  - onSave payload includes equipment_id when the user picks one
 *  - Equipment-required warning surfaces when saving with status='Planned' and no equipment
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { EditLoadForm } from "../../../components/EditLoadForm";
import { LOAD_STATUS, type LoadData, type User } from "../../../types";

vi.mock("../../../services/brokerService", () => ({
  getBrokers: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../services/authService", () => ({
  getCompany: vi.fn().mockResolvedValue({ id: "co-1", name: "Test Co" }),
  getCompanyUsers: vi.fn().mockResolvedValue([]),
  updateUser: vi.fn(),
}));

vi.mock("../../../services/storageService", () => ({
  generateBolPDF: vi.fn(),
  generateNextLoadNumber: vi.fn().mockReturnValue("LP-0001"),
}));

vi.mock("../../../services/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockEquipment = [
  { id: "EQ-001", unit_number: "TRK-101" },
  { id: "EQ-002", unit_number: "TRK-202" },
];

function mockEquipmentFetch(items = mockEquipment) {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (typeof url === "string" && url.includes("/api/equipment")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(items),
      } as any);
    }
    return Promise.resolve({
      ok: false,
      json: () => Promise.resolve({}),
    } as any);
  }) as any;
}

const mockUser: User = {
  id: "u-1",
  companyId: "co-1",
  email: "dispatch@test.com",
  name: "Dispatcher",
  role: "dispatcher",
  onboardingStatus: "Completed",
  safetyScore: 100,
};

const baseLoad: Partial<LoadData> = {
  id: "load-1",
  loadNumber: "LP-0001",
  brokerId: "b-1",
  driverId: "d-1",
  status: LOAD_STATUS.Planned,
  carrierRate: 1500,
  driverPay: 800,
  freightType: "Dry Van" as any,
  legs: [
    {
      id: "leg-pickup",
      type: "Pickup",
      location: { city: "Chicago", state: "IL", facilityName: "" } as any,
      date: "2026-04-10",
      completed: false,
    } as any,
    {
      id: "leg-dropoff",
      type: "Dropoff",
      location: { city: "Detroit", state: "MI", facilityName: "" } as any,
      date: "2026-04-12",
      completed: false,
    } as any,
  ],
  pickup: { city: "Chicago", state: "IL", facilityName: "" } as any,
  dropoff: { city: "Detroit", state: "MI", facilityName: "" } as any,
};

describe("EditLoadForm equipment selector (R-P4-09..R-P4-11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEquipmentFetch();
  });

  // Tests R-P4-09
  it("renders an equipment selector when /api/equipment returns a non-empty list", async () => {
    render(
      <EditLoadForm
        initialData={baseLoad as any}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        currentUser={mockUser}
        users={[]}
      />,
    );
    await waitFor(() =>
      expect(screen.getByLabelText(/equipment unit/i)).toBeInTheDocument(),
    );
    // Equipment options (TRK-101, TRK-202) must be present in the rendered options
    const select = screen.getByLabelText(
      /equipment unit/i,
    ) as HTMLSelectElement;
    await waitFor(() => {
      expect(select.querySelectorAll("option").length).toBeGreaterThanOrEqual(
        3,
      );
    });
  });

  // Tests R-P4-10
  it("onSave payload includes equipment_id when user picks one from the selector", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <EditLoadForm
        initialData={baseLoad as any}
        onSave={onSave}
        onCancel={vi.fn()}
        currentUser={mockUser}
        users={[]}
      />,
    );

    // Wait for equipment list to load
    await waitFor(() => {
      const sel = screen.getByLabelText(/equipment unit/i) as HTMLSelectElement;
      expect(sel.querySelectorAll("option").length).toBeGreaterThanOrEqual(3);
    });

    // Pick EQ-001
    const select = screen.getByLabelText(
      /equipment unit/i,
    ) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "EQ-001" } });
    expect(select.value).toBe("EQ-001");

    // Click save (find Save button by role)
    const saveBtn = screen.getAllByRole("button", { name: /save|update/i })[0];
    fireEvent.click(saveBtn);

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const payload = onSave.mock.calls[0][0];
    expect(payload.equipment_id).toBe("EQ-001");
  });

  // Tests R-P4-11
  it("displays equipment-required warning when saving with status='Planned' and no equipment", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <EditLoadForm
        initialData={{ ...baseLoad, status: LOAD_STATUS.Planned } as any}
        onSave={onSave}
        onCancel={vi.fn()}
        currentUser={mockUser}
        users={[]}
      />,
    );

    await waitFor(() =>
      expect(screen.getByLabelText(/equipment unit/i)).toBeInTheDocument(),
    );

    // No equipment selected — click Save and expect the warning to appear
    const saveBtn = screen.getAllByRole("button", { name: /save|update/i })[0];
    fireEvent.click(saveBtn);

    await waitFor(() =>
      expect(screen.getByText(/equipment required/i)).toBeInTheDocument(),
    );
  });
});
