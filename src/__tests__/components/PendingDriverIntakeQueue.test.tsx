/**
 * Tests R-P5-12, R-P5-13, R-P5-14: PendingDriverIntakeQueue component
 *
 * Verifies:
 *  - Queue filters fetched loads to only status==="draft" AND intake_source==="driver"
 *  - Approve button is disabled until equipment_id is selected in the modal
 *  - Approve button click fires TWO fetches in order:
 *      1. PATCH /api/loads/:id with { equipment_id }
 *      2. PATCH /api/loads/:id/status with { status: "Planned" }
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../services/authService", () => ({
  getIdTokenAsync: vi.fn().mockResolvedValue("mock-token"),
}));

import { PendingDriverIntakeQueue } from "../../../components/PendingDriverIntakeQueue";

const MIXED_LOADS = [
  {
    id: "load-d1",
    load_number: "DRAFT-aaa",
    status: "draft",
    intake_source: "driver",
    pickup_city: "Dallas",
    dropoff_city: "Houston",
  },
  {
    id: "load-d2",
    load_number: "LP-0001",
    status: "planned",
    intake_source: "driver",
    pickup_city: "Austin",
    dropoff_city: "San Antonio",
  },
  {
    id: "load-d3",
    load_number: "LP-0002",
    status: "draft",
    intake_source: "dispatcher",
    pickup_city: "El Paso",
    dropoff_city: "Lubbock",
  },
  {
    id: "load-d4",
    load_number: "LP-0003",
    status: "draft",
    intake_source: "driver",
    pickup_city: "Fort Worth",
    dropoff_city: "Waco",
  },
];

const EQUIPMENT_LIST = [
  { id: "eq-1", unit_number: "TRUCK-001", type: "Semi" },
  { id: "eq-2", unit_number: "TRUCK-002", type: "Flatbed" },
];

function makeFetch(responses: Record<string, any>) {
  return vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
    const method = opts?.method ?? "GET";
    const key = `${method} ${url}`;
    for (const [pattern, response] of Object.entries(responses)) {
      if (key.includes(pattern) || url.toString().includes(pattern)) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(response),
        });
      }
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });
}

describe("PendingDriverIntakeQueue", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // Tests R-P5-12
  it("Tests R-P5-12 — filters loads to only status=draft AND intake_source=driver", async () => {
    global.fetch = makeFetch({
      "/api/loads": MIXED_LOADS,
    });

    render(<PendingDriverIntakeQueue />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    // load-d1 is draft+driver → shown
    expect(screen.getByTestId("intake-row-load-d1")).toBeInTheDocument();
    // load-d4 is draft+driver → shown
    expect(screen.getByTestId("intake-row-load-d4")).toBeInTheDocument();
    // load-d2 is planned+driver → NOT shown
    expect(screen.queryByTestId("intake-row-load-d2")).not.toBeInTheDocument();
    // load-d3 is draft+dispatcher → NOT shown
    expect(screen.queryByTestId("intake-row-load-d3")).not.toBeInTheDocument();
  });

  // Tests R-P5-13
  it("Tests R-P5-13 — Approve button is disabled until equipment_id is selected", async () => {
    global.fetch = makeFetch({
      "/api/loads": MIXED_LOADS,
      "/api/equipment": EQUIPMENT_LIST,
    });

    render(<PendingDriverIntakeQueue />);

    await screen.findByTestId("intake-row-load-d1");

    // Open approval modal
    fireEvent.click(screen.getByTestId("approve-btn-load-d1"));

    // Approve confirm button should appear and be disabled (no equipment selected yet)
    const approveBtn = await screen.findByTestId("approve-confirm-btn");
    expect(approveBtn).toBeDisabled();

    // Select equipment
    const select = screen.getByTestId("equipment-select");
    fireEvent.change(select, { target: { value: "eq-1" } });

    // Now the button should be enabled
    expect(approveBtn).not.toBeDisabled();
  });

  // Tests R-P5-14
  it("Tests R-P5-14 — Approve fires PATCH equipment_id first, then PATCH status=Planned", async () => {
    const fetchCalls: { url: string; method: string; body: any }[] = [];

    global.fetch = vi
      .fn()
      .mockImplementation((url: string, opts?: RequestInit) => {
        const method = opts?.method ?? "GET";
        let body: any = null;
        if (opts?.body) {
          try {
            body = JSON.parse(opts.body as string);
          } catch {
            body = opts.body;
          }
        }
        fetchCalls.push({ url: url.toString(), method, body });

        // Mock load list response
        if (method === "GET" && url.toString().includes("/api/loads")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(MIXED_LOADS),
          });
        }
        // Mock equipment list response
        if (method === "GET" && url.toString().includes("/api/equipment")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(EQUIPMENT_LIST),
          });
        }
        // All PATCH calls succeed
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: "load-d1", status: "planned" }),
        });
      });

    render(<PendingDriverIntakeQueue />);
    await screen.findByTestId("intake-row-load-d1");

    // Open approval modal
    fireEvent.click(screen.getByTestId("approve-btn-load-d1"));
    await screen.findByTestId("approve-confirm-btn");

    // Select equipment
    const select = screen.getByTestId("equipment-select");
    fireEvent.change(select, { target: { value: "eq-1" } });

    // Click approve
    fireEvent.click(screen.getByTestId("approve-confirm-btn"));

    await waitFor(() => {
      const patches = fetchCalls.filter((c) => c.method === "PATCH");
      expect(patches.length).toBeGreaterThanOrEqual(2);
    });

    const patches = fetchCalls.filter((c) => c.method === "PATCH");

    // First PATCH: equipment_id
    expect(patches[0].url).toContain("/api/loads/load-d1");
    expect(patches[0].url).not.toContain("/status");
    expect(patches[0].body).toEqual({ equipment_id: "eq-1" });

    // Second PATCH: status=Planned
    expect(patches[1].url).toContain("/api/loads/load-d1/status");
    expect(patches[1].body).toEqual({ status: "Planned" });
  });
});
