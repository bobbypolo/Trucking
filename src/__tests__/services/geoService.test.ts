import { describe, it, expect, vi } from "vitest";

import {
  detectState,
  calculateDistance,
  decodePolyline,
} from "../../../services/geoService";

describe("geoService", () => {
  // --- detectState (point-in-polygon) ---
  describe("detectState", () => {
    it("detects Texas for a point inside Texas (Dallas area)", () => {
      // Dallas ~32.78, -96.80
      expect(detectState(32.78, -96.8)).toBe("TX");
    });

    it("detects Texas for Houston area coordinates", () => {
      // Houston ~29.76, -95.36
      expect(detectState(29.76, -95.36)).toBe("TX");
    });

    it("detects Oklahoma for a point inside Oklahoma", () => {
      // Oklahoma City ~35.47, -97.52
      expect(detectState(35.47, -97.52)).toBe("OK");
    });

    it("detects Kansas for a point inside Kansas", () => {
      // Wichita ~37.69, -97.34
      expect(detectState(37.69, -97.34)).toBe("KS");
    });

    it("returns null for coordinates outside all defined states", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      // New York City — not in the simplified polygon data
      expect(detectState(40.71, -74.01)).toBeNull();
      expect(console.warn).toHaveBeenCalled();
    });

    it("returns null for ocean coordinates", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      expect(detectState(0, 0)).toBeNull();
    });
  });

  // --- calculateDistance (Haversine) ---
  describe("calculateDistance", () => {
    it("returns 0 for the same point", () => {
      expect(calculateDistance(32.78, -96.8, 32.78, -96.8)).toBe(0);
    });

    it("calculates distance between Dallas and Houston (~240 miles)", () => {
      const distance = calculateDistance(32.78, -96.8, 29.76, -95.36);
      expect(distance).toBeGreaterThan(220);
      expect(distance).toBeLessThan(260);
    });

    it("calculates distance between NYC and LA (~2450 miles)", () => {
      const distance = calculateDistance(40.71, -74.01, 34.05, -118.24);
      expect(distance).toBeGreaterThan(2400);
      expect(distance).toBeLessThan(2500);
    });

    it("handles negative and positive coordinate combinations", () => {
      // London to Sydney
      const distance = calculateDistance(51.51, -0.13, -33.87, 151.21);
      expect(distance).toBeGreaterThan(10000);
      expect(distance).toBeLessThan(11000);
    });

    it("returns approximately half the Earth's circumference for antipodal points", () => {
      // North pole to South pole
      const distance = calculateDistance(90, 0, -90, 0);
      // Half Earth's circumference ~12,450 miles
      expect(distance).toBeGreaterThan(12000);
      expect(distance).toBeLessThan(13000);
    });
  });

  // --- decodePolyline ---
  describe("decodePolyline", () => {
    it("decodes a simple Google polyline string", () => {
      // "_p~iF~ps|U" encodes approximately [38.5, -120.2]
      const points = decodePolyline("_p~iF~ps|U");
      expect(points).toHaveLength(1);
      expect(points[0][0]).toBeCloseTo(38.5, 0);
      expect(points[0][1]).toBeCloseTo(-120.2, 0);
    });

    it("decodes a multi-point polyline", () => {
      // "_p~iF~ps|U_ulLnnqC_mqNvxq`@" — 3 points
      const points = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
      expect(points).toHaveLength(3);
      // First point
      expect(points[0][0]).toBeCloseTo(38.5, 0);
      expect(points[0][1]).toBeCloseTo(-120.2, 0);
      // Second point
      expect(points[1][0]).toBeCloseTo(40.7, 0);
      expect(points[1][1]).toBeCloseTo(-120.95, 0);
      // Third point
      expect(points[2][0]).toBeCloseTo(43.25, 0);
      expect(points[2][1]).toBeCloseTo(-126.45, 0);
    });

    it("returns empty array for empty string", () => {
      expect(decodePolyline("")).toEqual([]);
    });

    it("returns points as [lat, lng] tuples", () => {
      const points = decodePolyline("_p~iF~ps|U");
      expect(Array.isArray(points[0])).toBe(true);
      expect(points[0]).toHaveLength(2);
    });
  });
});
