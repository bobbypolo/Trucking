import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * distanceMatrixService reads `import.meta.env.VITE_GOOGLE_MAPS_API_KEY`
 * at module top-level. We use process.env + vi.resetModules() + dynamic
 * import to get a fresh module per test suite.
 */

describe("distanceMatrixService", () => {
  let getDistanceMatrix: typeof import("../../../services/distanceMatrixService").getDistanceMatrix;

  beforeEach(async () => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockReset();
    process.env.VITE_GOOGLE_MAPS_API_KEY = "test-api-key-123";
    const mod = await import("../../../services/distanceMatrixService");
    getDistanceMatrix = mod.getDistanceMatrix;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.VITE_GOOGLE_MAPS_API_KEY;
  });

  const validApiResponse = {
    status: "OK",
    rows: [
      {
        elements: [
          {
            status: "OK",
            distance: { text: "243 mi", value: 391000 },
            duration: { text: "3 hours 30 min", value: 12600 },
          },
        ],
      },
    ],
  };

  it("constructs the correct URL with lat/lng origin and destination", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validApiResponse),
    } as Response);

    await getDistanceMatrix(
      { lat: 32.78, lng: -96.8 },
      { lat: 29.76, lng: -95.36 },
    );

    const url = (globalThis.fetch as any).mock.calls[0][0] as string;
    expect(url).toContain("maps.googleapis.com/maps/api/distancematrix/json");
    expect(url).toContain("origins=32.78,-96.8");
    expect(url).toContain("destinations=29.76,-95.36");
    expect(url).toContain("key=test-api-key-123");
  });

  it("handles string origin and destination (place names)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validApiResponse),
    } as Response);

    await getDistanceMatrix("Dallas, TX", "Houston, TX");

    const url = (globalThis.fetch as any).mock.calls[0][0] as string;
    expect(url).toContain("origins=Dallas%2C%20TX");
    expect(url).toContain("destinations=Houston%2C%20TX");
  });

  it("returns distance and duration from the API response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validApiResponse),
    } as Response);

    const result = await getDistanceMatrix(
      { lat: 32.78, lng: -96.8 },
      { lat: 29.76, lng: -95.36 },
    );

    expect(result.distance.text).toBe("243 mi");
    expect(result.distance.value).toBe(391000);
    expect(result.duration.text).toBe("3 hours 30 min");
    expect(result.duration.value).toBe(12600);
  });

  it("throws on non-OK HTTP response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      statusText: "Service Unavailable",
    } as Response);

    await expect(
      getDistanceMatrix(
        { lat: 32.78, lng: -96.8 },
        { lat: 29.76, lng: -95.36 },
      ),
    ).rejects.toThrow("Distance Matrix failed: Service Unavailable");
  });

  it("throws when API-level status is not OK", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          status: "REQUEST_DENIED",
          error_message: "API key invalid",
          rows: [],
        }),
    } as Response);

    await expect(
      getDistanceMatrix(
        { lat: 32.78, lng: -96.8 },
        { lat: 29.76, lng: -95.36 },
      ),
    ).rejects.toThrow(
      "Google Maps API error: REQUEST_DENIED - API key invalid",
    );
  });

  it("throws with 'Unknown error' when error_message is absent", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          status: "OVER_DAILY_LIMIT",
          rows: [],
        }),
    } as Response);

    await expect(
      getDistanceMatrix(
        { lat: 32.78, lng: -96.8 },
        { lat: 29.76, lng: -95.36 },
      ),
    ).rejects.toThrow(
      "Google Maps API error: OVER_DAILY_LIMIT - Unknown error",
    );
  });

  it("throws when element status is not OK (e.g., ZERO_RESULTS)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          status: "OK",
          rows: [{ elements: [{ status: "ZERO_RESULTS" }] }],
        }),
    } as Response);

    await expect(
      getDistanceMatrix(
        { lat: 32.78, lng: -96.8 },
        { lat: 29.76, lng: -95.36 },
      ),
    ).rejects.toThrow("Distance Matrix element error: ZERO_RESULTS");
  });

  it("handles mixed origin types (string and coordinate)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validApiResponse),
    } as Response);

    await getDistanceMatrix("Dallas, TX", { lat: 29.76, lng: -95.36 });

    const url = (globalThis.fetch as any).mock.calls[0][0] as string;
    expect(url).toContain("origins=Dallas%2C%20TX");
    expect(url).toContain("destinations=29.76,-95.36");
  });

  it("throws when API key is not configured", async () => {
    vi.resetModules();
    delete process.env.VITE_GOOGLE_MAPS_API_KEY;
    const mod = await import("../../../services/distanceMatrixService");
    await expect(
      mod.getDistanceMatrix(
        { lat: 32.78, lng: -96.8 },
        { lat: 29.76, lng: -95.36 },
      ),
    ).rejects.toThrow("Google Maps API key not configured");
  });
});
