import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests R-P5-01, R-P5-02
 *
 * Verifies fetchStops() calls api.get('/loads/{loadId}/stops') and returns Stop[].
 * Verifies updateStopStatus() calls api.patch with status update payload.
 */

// Mock the api module
const mockGet = vi.fn();
const mockPatch = vi.fn();
vi.mock("../../src/services/api", () => ({
  default: {
    get: mockGet,
    patch: mockPatch,
  },
}));

// Mock firebase config (transitive dependency of api.ts)
vi.mock("../../src/config/firebase", () => ({
  auth: { currentUser: null },
}));

describe("R-P5-01: fetchStops service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // # Tests R-P5-01
  it("calls api.get with /loads/{loadId}/stops and returns Stop[]", async () => {
    const mockStops = [
      {
        id: "S1",
        load_id: "L1",
        type: "Pickup",
        facility_name: "Warehouse A",
        city: "Chicago",
        state: "IL",
        date: "2026-04-10",
        appointment_time: "08:00",
        completed: false,
        sequence_order: 1,
        status: "pending",
        arrived_at: null,
        departed_at: null,
      },
      {
        id: "S2",
        load_id: "L1",
        type: "Dropoff",
        facility_name: "Distribution Center B",
        city: "Dallas",
        state: "TX",
        date: "2026-04-12",
        appointment_time: "14:00",
        completed: false,
        sequence_order: 2,
        status: "pending",
        arrived_at: null,
        departed_at: null,
      },
    ];

    mockGet.mockResolvedValueOnce({ stops: mockStops });

    const { fetchStops } = await import("../../src/services/stops");

    const result = await fetchStops("L1");

    expect(mockGet).toHaveBeenCalledWith("/loads/L1/stops");
    expect(result).toEqual(mockStops);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("S1");
    expect(result[0].facility_name).toBe("Warehouse A");
    expect(result[0].sequence_order).toBe(1);
    expect(result[1].id).toBe("S2");
    expect(result[1].facility_name).toBe("Distribution Center B");
    expect(result[1].sequence_order).toBe(2);
  });

  // # Tests R-P5-01
  it("returns empty array when load has no stops", async () => {
    mockGet.mockResolvedValueOnce({ stops: [] });

    const { fetchStops } = await import("../../src/services/stops");

    const result = await fetchStops("L-EMPTY");

    expect(mockGet).toHaveBeenCalledWith("/loads/L-EMPTY/stops");
    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  // # Tests R-P5-01
  it("propagates API errors to the caller", async () => {
    mockGet.mockRejectedValueOnce(new Error("Network error"));

    const { fetchStops } = await import("../../src/services/stops");

    await expect(fetchStops("L1")).rejects.toThrow("Network error");
    expect(mockGet).toHaveBeenCalledWith("/loads/L1/stops");
  });
});

describe("R-P5-02: updateStopStatus service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // # Tests R-P5-02
  it("calls api.patch with status update payload and returns updated Stop", async () => {
    const updatedStop = {
      id: "S1",
      load_id: "L1",
      type: "Pickup",
      facility_name: "Warehouse A",
      city: "Chicago",
      state: "IL",
      date: "2026-04-10",
      appointment_time: "08:00",
      completed: false,
      sequence_order: 1,
      status: "arrived",
      arrived_at: "2026-04-10T08:15:00.000Z",
      departed_at: null,
    };

    mockPatch.mockResolvedValueOnce({ stop: updatedStop });

    const { updateStopStatus } = await import("../../src/services/stops");

    const update = {
      status: "arrived" as const,
      arrived_at: "2026-04-10T08:15:00.000Z",
    };
    const result = await updateStopStatus("L1", "S1", update);

    expect(mockPatch).toHaveBeenCalledWith("/loads/L1/stops/S1", update);
    expect(result).toEqual(updatedStop);
    expect(result.status).toBe("arrived");
    expect(result.arrived_at).toBe("2026-04-10T08:15:00.000Z");
  });

  // # Tests R-P5-02
  it("sends departed status with departed_at timestamp", async () => {
    const updatedStop = {
      id: "S1",
      load_id: "L1",
      type: "Pickup",
      facility_name: "Warehouse A",
      city: "Chicago",
      state: "IL",
      date: "2026-04-10",
      appointment_time: "08:00",
      completed: false,
      sequence_order: 1,
      status: "departed",
      arrived_at: "2026-04-10T08:15:00.000Z",
      departed_at: "2026-04-10T10:30:00.000Z",
    };

    mockPatch.mockResolvedValueOnce({ stop: updatedStop });

    const { updateStopStatus } = await import("../../src/services/stops");

    const update = {
      status: "departed" as const,
      departed_at: "2026-04-10T10:30:00.000Z",
    };
    const result = await updateStopStatus("L1", "S1", update);

    expect(mockPatch).toHaveBeenCalledWith("/loads/L1/stops/S1", update);
    expect(result.status).toBe("departed");
    expect(result.departed_at).toBe("2026-04-10T10:30:00.000Z");
  });

  // # Tests R-P5-02
  it("propagates API errors to the caller", async () => {
    mockPatch.mockRejectedValueOnce(new Error("Stop not found"));

    const { updateStopStatus } = await import("../../src/services/stops");

    await expect(
      updateStopStatus("L1", "S999", { status: "arrived" }),
    ).rejects.toThrow("Stop not found");
    expect(mockPatch).toHaveBeenCalledWith("/loads/L1/stops/S999", {
      status: "arrived",
    });
  });
});
