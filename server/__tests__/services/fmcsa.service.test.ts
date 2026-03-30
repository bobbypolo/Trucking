import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Tests R-W8-01-AC1, R-W8-01-AC2, R-W8-01-AC3, R-W8-VPC-901

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock logger
const mockInfo = vi.fn();
const mockWarn = vi.fn();
const mockError = vi.fn();
vi.mock("../../lib/logger", () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
  createRequestLogger: () => ({
    info: mockInfo,
    warn: mockWarn,
    error: mockError,
  }),
}));

const originalEnv = { ...process.env };

describe("R-W8-01: FMCSA Safety Score Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
    // Default: API key present
    process.env.FMCSA_API_KEY = "test-fmcsa-key";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("AC-a: Real HTTP calls with configurable base URL", () => {
    it("calls FMCSA API with correct URL and returns parsed data", async () => {
      const { getSafetyScore } = await import(
        "../../services/fmcsa.service"
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: {
            carrier: {
              dotNumber: "2233541",
              legalName: "Test Carrier LLC",
              safetyRating: "Satisfactory",
              safetyRatingDate: "2024-01-15",
              totalDrivers: "25",
              totalPowerUnits: "30",
            },
            basics: [
              {
                basicsType: "Unsafe Driving",
                basicsValue: "45.2",
                basicsRunDate: "2024-02-01",
              },
              {
                basicsType: "HOS Compliance",
                basicsValue: "22.1",
                basicsRunDate: "2024-02-01",
              },
            ],
            inspections: {
              totalInspections: "150",
              totalOosInspections: "12",
              driverOosRate: "5.3",
              vehicleOosRate: "8.1",
            },
          },
        }),
      });

      const result = await getSafetyScore("2233541");

      expect(result.available).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.dotNumber).toBe("2233541");
      expect(result.data!.legalName).toBe("Test Carrier LLC");
      expect(result.data!.safetyRating).toBe("Satisfactory");
      expect(result.data!.totalDrivers).toBe(25);
      expect(result.data!.totalPowerUnits).toBe(30);
      expect(result.data!.inspections).toBeDefined();
      expect(result.data!.inspections!.totalInspections).toBe(150);
      expect(result.data!.inspections!.driverOosRate).toBe(5.3);
    });

    it("uses configurable base URL from environment variable", async () => {
      process.env.FMCSA_API_BASE_URL = "https://custom-fmcsa.example.com";
      const { getSafetyScore } = await import(
        "../../services/fmcsa.service"
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: {
            carrier: {
              dotNumber: "123456",
              legalName: "Custom URL Carrier",
              safetyRating: "Satisfactory",
            },
            inspections: {},
          },
        }),
      });

      await getSafetyScore("123456");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("https://custom-fmcsa.example.com"),
        expect.any(Object),
      );
    });
  });

  describe("AC-b: Falls back to mock data when FMCSA_API_KEY not configured", () => {
    it("returns mock data with isMock flag when no API key set", async () => {
      delete process.env.FMCSA_API_KEY;
      const { getSafetyScore } = await import(
        "../../services/fmcsa.service"
      );

      const result = await getSafetyScore("2233541");

      expect(result.available).toBe(true);
      expect(result.isMock).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.dotNumber).toBe("2233541");
      expect(result.data!.legalName).toContain("Mock");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns mock data when FMCSA_API_KEY is empty string", async () => {
      process.env.FMCSA_API_KEY = "";
      const { getSafetyScore } = await import(
        "../../services/fmcsa.service"
      );

      const result = await getSafetyScore("2233541");

      expect(result.available).toBe(true);
      expect(result.isMock).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("AC-c: Graceful degradation on API failure", () => {
    it("returns unavailable when API returns non-OK status", async () => {
      const { getSafetyScore } = await import(
        "../../services/fmcsa.service"
      );

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await getSafetyScore("2233541");

      expect(result.available).toBe(false);
      expect(result.reason).toBe("api_error");
    });

    it("returns unavailable when network error occurs", async () => {
      const { getSafetyScore } = await import(
        "../../services/fmcsa.service"
      );

      mockFetch.mockRejectedValueOnce(new Error("Network failure"));

      const result = await getSafetyScore("2233541");

      expect(result.available).toBe(false);
      expect(result.reason).toBe("api_error");
    });

    it("returns unavailable on timeout", async () => {
      const { getSafetyScore } = await import(
        "../../services/fmcsa.service"
      );

      const abortError = new DOMException("Aborted", "AbortError");
      mockFetch.mockRejectedValueOnce(abortError);

      const result = await getSafetyScore("2233541");

      expect(result.available).toBe(false);
      expect(result.reason).toBe("timeout");
    });

    it("returns unavailable when API response has no carrier data", async () => {
      const { getSafetyScore } = await import(
        "../../services/fmcsa.service"
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: {} }),
      });

      const result = await getSafetyScore("2233541");

      expect(result.available).toBe(false);
      expect(result.reason).toBe("no_data");
    });
  });

  describe("Caching", () => {
    it("returns cached result on second call within cache TTL", async () => {
      const { getSafetyScore, clearFmcsaCache } = await import(
        "../../services/fmcsa.service"
      );

      // Clear any prior cache
      clearFmcsaCache();

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: {
            carrier: {
              dotNumber: "2233541",
              legalName: "Cached Carrier",
              safetyRating: "Satisfactory",
            },
            inspections: {},
          },
        }),
      });

      // First call — hits API
      const first = await getSafetyScore("2233541");
      expect(first.available).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call — should use cache
      const second = await getSafetyScore("2233541");
      expect(second.available).toBe(true);
      expect(second.data!.legalName).toBe("Cached Carrier");
      expect(mockFetch).toHaveBeenCalledTimes(1); // still 1, no extra call
    });
  });

  describe("Input validation", () => {
    it("rejects empty DOT number", async () => {
      const { getSafetyScore } = await import(
        "../../services/fmcsa.service"
      );

      const result = await getSafetyScore("");

      expect(result.available).toBe(false);
      expect(result.reason).toBe("invalid_input");
    });

    it("rejects non-numeric DOT number", async () => {
      const { getSafetyScore } = await import(
        "../../services/fmcsa.service"
      );

      const result = await getSafetyScore("abc-not-a-number");

      expect(result.available).toBe(false);
      expect(result.reason).toBe("invalid_input");
    });
  });
});
