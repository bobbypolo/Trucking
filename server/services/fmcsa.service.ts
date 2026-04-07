/**
 * FMCSA Safety Score Service for LoadPilot
 *
 * Fetches carrier safety data from the FMCSA SAFER Web Services API
 * by USDOT number. Returns safety ratings, inspection data, and
 * out-of-service rates.
 *
 * Features:
 * - 5-second timeout on all API requests
 * - Configurable base URL via FMCSA_API_BASE_URL env var
 * - 24-hour in-memory cache (FMCSA data changes infrequently)
 * - Graceful fallback to mock data when FMCSA_API_KEY not configured
 * - Graceful degradation: failures return { available: false } not 500
 *
 * @see .claude/docs/PLAN.md R-W8-01
 */

import { createChildLogger } from "../lib/logger";

const log = createChildLogger({ service: "fmcsa" });

const FMCSA_TIMEOUT_MS = 5000;
const FMCSA_DEFAULT_BASE_URL = "https://mobile.fmcsa.dot.gov/qc/services";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── Types ────────────────────────────────────────────────────────────────────

export interface FmcsaInspectionData {
  totalInspections: number;
  totalOosInspections: number;
  driverOosRate: number;
  vehicleOosRate: number;
}

export interface FmcsaBasicsScore {
  type: string;
  value: number;
  runDate: string;
}

export interface FmcsaSafetyData {
  dotNumber: string;
  legalName: string;
  safetyRating: string | null;
  safetyRatingDate: string | null;
  totalDrivers: number;
  totalPowerUnits: number;
  inspections: FmcsaInspectionData | null;
  basicsScores: FmcsaBasicsScore[];
}

export interface FmcsaResponse {
  available: boolean;
  isMock?: boolean;
  reason?:
    | "timeout"
    | "api_error"
    | "no_data"
    | "no_api_key"
    | "invalid_input"
    | "fmcsa_unavailable";
  data?: FmcsaSafetyData;
}

// ── Cache ────────────────────────────────────────────────────────────────────

interface CacheEntry {
  response: FmcsaResponse;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * Clear the entire FMCSA cache. Useful for testing.
 */
export function clearFmcsaCache(): void {
  cache.clear();
}

function getCached(dotNumber: string): FmcsaResponse | null {
  const entry = cache.get(dotNumber);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(dotNumber);
    return null;
  }
  return entry.response;
}

function setCache(dotNumber: string, response: FmcsaResponse): void {
  cache.set(dotNumber, {
    response,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

// ── Mock Data ────────────────────────────────────────────────────────────────

function getMockSafetyData(dotNumber: string): FmcsaResponse {
  return {
    available: true,
    isMock: true,
    data: {
      dotNumber,
      legalName: "Mock Carrier LLC",
      safetyRating: "Satisfactory",
      safetyRatingDate: "2024-01-01",
      totalDrivers: 10,
      totalPowerUnits: 15,
      inspections: {
        totalInspections: 50,
        totalOosInspections: 3,
        driverOosRate: 4.0,
        vehicleOosRate: 6.0,
      },
      basicsScores: [
        { type: "Unsafe Driving", value: 30.0, runDate: "2024-01-01" },
        { type: "HOS Compliance", value: 20.0, runDate: "2024-01-01" },
      ],
    },
  };
}

// ── API Parsing ──────────────────────────────────────────────────────────────

function parseCarrierResponse(responseData: unknown): FmcsaSafetyData | null {
  const content = (responseData as { content?: Record<string, unknown> })?.content;
  if (!content) return null;

  const carrier = content.carrier as Record<string, unknown> | undefined;
  if (!carrier) return null;

  const inspectionsRaw = content.inspections as Record<string, unknown> | undefined;
  let inspections: FmcsaInspectionData | null = null;
  if (inspectionsRaw) {
    inspections = {
      totalInspections: parseInt(String(inspectionsRaw.totalInspections), 10) || 0,
      totalOosInspections:
        parseInt(String(inspectionsRaw.totalOosInspections), 10) || 0,
      driverOosRate: parseFloat(String(inspectionsRaw.driverOosRate)) || 0,
      vehicleOosRate: parseFloat(String(inspectionsRaw.vehicleOosRate)) || 0,
    };
  }

  const basicsRaw = content.basics;
  const basicsScores: FmcsaBasicsScore[] = Array.isArray(basicsRaw)
    ? basicsRaw.map((b: Record<string, unknown>) => ({
        type: (b.basicsType as string) || "Unknown",
        value: parseFloat(String(b.basicsValue)) || 0,
        runDate: (b.basicsRunDate as string) || "",
      }))
    : [];

  return {
    dotNumber: (carrier.dotNumber as string) || "",
    legalName: (carrier.legalName as string) || "",
    safetyRating: (carrier.safetyRating as string | null) || null,
    safetyRatingDate: (carrier.safetyRatingDate as string | null) || null,
    totalDrivers: parseInt(String(carrier.totalDrivers), 10) || 0,
    totalPowerUnits: parseInt(String(carrier.totalPowerUnits), 10) || 0,
    inspections,
    basicsScores,
  };
}

// ── Main Function ────────────────────────────────────────────────────────────

/**
 * Fetch FMCSA safety score for a given USDOT number.
 *
 * Never throws — always returns an FmcsaResponse.
 * On any failure (timeout, network, missing key),
 * returns { available: false, reason: "..." }.
 *
 * When FMCSA_API_KEY is not configured, returns mock data with isMock: true.
 */
export async function getSafetyScore(
  dotNumber: string,
): Promise<FmcsaResponse> {
  // Input validation
  if (!dotNumber || !/^\d+$/.test(dotNumber.trim())) {
    log.warn({ dotNumber }, "FMCSA request rejected: invalid DOT number");
    return { available: false, reason: "invalid_input" };
  }

  const normalizedDot = dotNumber.trim();

  // Check cache first
  const cached = getCached(normalizedDot);
  if (cached) {
    log.info({ dotNumber: normalizedDot, cached: true }, "FMCSA cache hit");
    return cached;
  }

  // Check API key — fall back to mock data if not configured
  const apiKey = process.env.FMCSA_API_KEY;
  if (!apiKey) {
    log.info(
      { dotNumber: normalizedDot },
      "FMCSA API key not configured — returning mock data",
    );
    const mockResponse = getMockSafetyData(normalizedDot);
    setCache(normalizedDot, mockResponse);
    return mockResponse;
  }

  const startTime = Date.now();
  const baseUrl =
    process.env.FMCSA_API_BASE_URL || FMCSA_DEFAULT_BASE_URL;

  try {
    const url = `${baseUrl}/carriers/${normalizedDot}?webKey=${apiKey}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(FMCSA_TIMEOUT_MS),
      headers: {
        Accept: "application/json",
      },
    });

    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      log.error(
        {
          dotNumber: normalizedDot,
          status: response.status,
          durationMs,
        },
        "FMCSA API returned non-OK status",
      );
      return { available: false, reason: "api_error" };
    }

    const data = await response.json();
    const parsed = parseCarrierResponse(data);

    if (!parsed) {
      log.warn(
        { dotNumber: normalizedDot, durationMs },
        "FMCSA API returned no carrier data",
      );
      return { available: false, reason: "no_data" };
    }

    const result: FmcsaResponse = { available: true, data: parsed };

    log.info(
      {
        dotNumber: normalizedDot,
        durationMs,
        success: true,
        legalName: parsed.legalName,
        safetyRating: parsed.safetyRating,
      },
      "FMCSA request completed successfully",
    );

    setCache(normalizedDot, result);
    return result;
  } catch (err: unknown) {
    const durationMs = Date.now() - startTime;

    if (
      err instanceof DOMException &&
      (err.name === "AbortError" || err.name === "TimeoutError")
    ) {
      log.warn(
        {
          dotNumber: normalizedDot,
          durationMs,
          timeoutMs: FMCSA_TIMEOUT_MS,
        },
        "FMCSA request timed out",
      );
      return { available: false, reason: "timeout" };
    }

    log.error(
      {
        dotNumber: normalizedDot,
        durationMs,
        error: err instanceof Error ? err.message : String(err),
      },
      "FMCSA request failed",
    );
    return { available: false, reason: "api_error" };
  }
}
