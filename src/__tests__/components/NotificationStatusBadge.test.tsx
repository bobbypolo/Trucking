import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  NotificationStatusBadge,
  type NotificationStatus,
} from "../../../components/ui/NotificationStatusBadge";

describe("NotificationStatusBadge", () => {
  it("renders PENDING status with yellow styling", () => {
    render(<NotificationStatusBadge status="PENDING" />);
    const badge = screen.getByTestId("notification-badge-PENDING");
    expect(badge).toBeDefined();
    expect(badge.textContent).toContain("Pending");
    expect(badge.className).toContain("text-yellow-400");
  });

  it("renders SENT status with green styling", () => {
    render(<NotificationStatusBadge status="SENT" />);
    const badge = screen.getByTestId("notification-badge-SENT");
    expect(badge).toBeDefined();
    expect(badge.textContent).toContain("Sent");
    expect(badge.className).toContain("text-green-400");
  });

  it("renders FAILED status with red styling", () => {
    render(<NotificationStatusBadge status="FAILED" />);
    const badge = screen.getByTestId("notification-badge-FAILED");
    expect(badge).toBeDefined();
    expect(badge.textContent).toContain("Failed");
    expect(badge.className).toContain("text-red-400");
  });

  it("shows sync_error text when FAILED with syncError", () => {
    render(
      <NotificationStatusBadge status="FAILED" syncError="SMTP not configured" />,
    );
    const badge = screen.getByTestId("notification-badge-FAILED");
    expect(badge.textContent).toContain("SMTP not configured");
    expect(badge.getAttribute("title")).toContain("SMTP not configured");
  });

  it("does not show sync_error when status is not FAILED", () => {
    render(
      <NotificationStatusBadge status="SENT" syncError="some error" />,
    );
    const badge = screen.getByTestId("notification-badge-SENT");
    expect(badge.textContent).not.toContain("some error");
  });

  it("each status has correct icon and label", () => {
    const statuses: NotificationStatus[] = ["PENDING", "SENT", "FAILED"];
    const expectedLabels = ["Pending", "Sent", "Failed"];

    statuses.forEach((status, idx) => {
      const { unmount } = render(<NotificationStatusBadge status={status} />);
      const badge = screen.getByTestId(`notification-badge-${status}`);
      expect(badge.textContent).toContain(expectedLabels[idx]);
      unmount();
    });
  });
});
