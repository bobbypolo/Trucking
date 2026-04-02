import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DriverAssignmentPanel } from "../../../components/DriverAssignmentPanel";
import type { LoadData, User } from "../../../types";

const makeLoad = (overrides: Partial<LoadData> = {}): LoadData => ({
  id: "load-1",
  companyId: "company-1",
  driverId: "",
  loadNumber: "LD-001",
  status: "planned",
  carrierRate: 2500,
  driverPay: 1500,
  pickupDate: "2026-04-02",
  pickup: { city: "Dallas", state: "TX" },
  dropoff: { city: "Houston", state: "TX" },
  ...overrides,
});

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: "driver-1",
  companyId: "company-1",
  email: "driver-1@test.com",
  name: "Driver One",
  role: "driver",
  onboardingStatus: "Completed",
  safetyScore: 100,
  ...overrides,
});

describe("DriverAssignmentPanel", () => {
  it("shows only unassigned loads and available drivers", () => {
    render(
      <DriverAssignmentPanel
        loads={[
          makeLoad(),
          makeLoad({
            id: "load-2",
            loadNumber: "LD-002",
            driverId: "busy-driver",
          }),
        ]}
        users={[
          makeUser(),
          makeUser({
            id: "busy-driver",
            name: "Busy Driver",
            email: "busy@test.com",
          }),
          makeUser({
            id: "oo-1",
            name: "Owner Operator",
            role: "owner_operator",
            email: "oo@test.com",
          }),
          makeUser({
            id: "dispatcher-1",
            name: "Dispatcher",
            role: "dispatcher",
            email: "dispatch@test.com",
          }),
        ]}
        onAssignLoad={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Select load LD-001/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Select load LD-002/i }),
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /Select driver Driver One/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Select driver Owner Operator/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Select driver Busy Driver/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Select driver Dispatcher/i }),
    ).not.toBeInTheDocument();
  });

  it("assigns the selected load to the selected driver", async () => {
    const user = userEvent.setup();
    const onAssignLoad = vi.fn().mockResolvedValue(undefined);

    render(
      <DriverAssignmentPanel
        loads={[makeLoad()]}
        users={[makeUser(), makeUser({ id: "driver-2", name: "Driver Two", email: "driver-2@test.com" })]}
        onAssignLoad={onAssignLoad}
      />,
    );

    const assignButton = screen.getByRole("button", {
      name: /Assign selected load to selected driver/i,
    });
    expect(assignButton).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /Select load LD-001/i }));
    await user.click(
      screen.getByRole("button", { name: /Select driver Driver Two/i }),
    );
    expect(assignButton).not.toBeDisabled();

    await user.click(assignButton);

    expect(onAssignLoad).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "load-1",
        driverId: "driver-2",
      }),
    );
  });
});
