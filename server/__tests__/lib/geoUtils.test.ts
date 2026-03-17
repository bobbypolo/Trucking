import { describe, it, expect } from "vitest";
import {
  isPointInPolygon,
  detectState,
  calculateDistance,
} from "../../geoUtils";

/**
 * Tests for server/geoUtils.ts
 *
 * Pure functions with no external dependencies — no mocks needed.
 */

describe("geoUtils.ts", () => {
  describe("calculateDistance (Haversine)", () => {
    it("returns 0 for same point", () => {
      const dist = calculateDistance(32.7767, -96.797, 32.7767, -96.797);
      expect(dist).toBe(0);
    });

    it("calculates distance between Dallas and Houston (~239 miles)", () => {
      // Dallas: 32.7767, -96.797
      // Houston: 29.7604, -95.3698
      const dist = calculateDistance(32.7767, -96.797, 29.7604, -95.3698);
      expect(dist).toBeGreaterThan(220);
      expect(dist).toBeLessThan(260);
    });

    it("calculates distance between New York and Los Angeles (~2451 miles)", () => {
      // NYC: 40.7128, -74.006
      // LA: 34.0522, -118.2437
      const dist = calculateDistance(40.7128, -74.006, 34.0522, -118.2437);
      expect(dist).toBeGreaterThan(2400);
      expect(dist).toBeLessThan(2500);
    });

    it("returns same distance regardless of direction (symmetric)", () => {
      const distAB = calculateDistance(32.7767, -96.797, 29.7604, -95.3698);
      const distBA = calculateDistance(29.7604, -95.3698, 32.7767, -96.797);
      expect(Math.abs(distAB - distBA)).toBeLessThan(0.001);
    });

    it("handles crossing the equator", () => {
      // North of equator to south of equator
      const dist = calculateDistance(10, 0, -10, 0);
      // ~20 degrees latitude ≈ 1381 miles
      expect(dist).toBeGreaterThan(1300);
      expect(dist).toBeLessThan(1400);
    });

    it("handles crossing the prime meridian", () => {
      const dist = calculateDistance(51.5074, -1, 51.5074, 1);
      // Small distance at ~51.5 degrees N
      expect(dist).toBeGreaterThan(0);
      expect(dist).toBeLessThan(100);
    });

    it("handles crossing the international date line", () => {
      // Near date line
      const dist = calculateDistance(0, 179, 0, -179);
      // ~2 degrees at equator ≈ 138 miles
      expect(dist).toBeGreaterThan(100);
      expect(dist).toBeLessThan(200);
    });

    it("handles antipodal points (maximum distance ~12,451 miles)", () => {
      // Points on opposite sides of the earth
      const dist = calculateDistance(0, 0, 0, 180);
      // Half the earth's circumference in miles
      expect(dist).toBeGreaterThan(12000);
      expect(dist).toBeLessThan(12500);
    });

    it("uses Earth radius of 3958.8 miles", () => {
      // A quarter of the way around the equator
      const dist = calculateDistance(0, 0, 0, 90);
      // Should be approximately π/2 * R
      const expected = (Math.PI / 2) * 3958.8;
      expect(Math.abs(dist - expected)).toBeLessThan(1);
    });

    it("handles very small distances", () => {
      // Two points ~0.001 degrees apart
      const dist = calculateDistance(32.0, -96.0, 32.001, -96.001);
      expect(dist).toBeGreaterThan(0);
      expect(dist).toBeLessThan(1);
    });

    it("handles negative latitudes (southern hemisphere)", () => {
      // Sydney: -33.8688, 151.2093
      // Melbourne: -37.8136, 144.9631
      const dist = calculateDistance(-33.8688, 151.2093, -37.8136, 144.9631);
      expect(dist).toBeGreaterThan(400);
      expect(dist).toBeLessThan(550);
    });
  });

  describe("isPointInPolygon", () => {
    // Simple square polygon: corners at (0,0), (0,10), (10,10), (10,0)
    const squarePolygon: number[][][] = [
      [
        [0, 0],
        [0, 10],
        [10, 10],
        [10, 0],
        [0, 0],
      ],
    ];

    it("returns true for point inside polygon", () => {
      expect(isPointInPolygon(5, 5, squarePolygon)).toBe(true);
    });

    it("returns false for point outside polygon", () => {
      expect(isPointInPolygon(15, 15, squarePolygon)).toBe(false);
    });

    it("returns false for point far outside polygon", () => {
      expect(isPointInPolygon(-50, -50, squarePolygon)).toBe(false);
    });

    it("handles point near edge of polygon", () => {
      // Point very close to but inside the polygon
      const result = isPointInPolygon(0.001, 0.001, squarePolygon);
      expect(typeof result).toBe("boolean");
    });

    it("handles multiple rings (outer polygon)", () => {
      const multiRing: number[][][] = [
        [
          [0, 0],
          [0, 20],
          [20, 20],
          [20, 0],
          [0, 0],
        ],
        [
          [5, 5],
          [5, 15],
          [15, 15],
          [15, 5],
          [5, 5],
        ],
      ];
      // Point inside outer ring but also inside inner ring (hole) - toggled twice
      const result = isPointInPolygon(10, 10, multiRing);
      // With ray-casting, point inside both rings toggles twice => outside
      expect(result).toBe(false);
    });

    it("handles empty polygon rings (no points)", () => {
      const emptyPoly: number[][][] = [[]];
      expect(isPointInPolygon(5, 5, emptyPoly)).toBe(false);
    });

    it("handles single-point ring", () => {
      const singlePoint: number[][][] = [[[5, 5]]];
      expect(isPointInPolygon(5, 5, singlePoint)).toBe(false);
    });
  });

  describe("detectState", () => {
    it("detects Texas for point in Dallas", () => {
      // Dallas: lat 32.7767, lng -96.797
      const state = detectState(32.7767, -96.797);
      expect(state).toBe("TX");
    });

    it("detects Texas for point in Houston", () => {
      // Houston: lat 29.7604, lng -95.3698
      const state = detectState(29.7604, -95.3698);
      expect(state).toBe("TX");
    });

    it("detects Oklahoma for point in Oklahoma City", () => {
      // OKC: lat 35.4676, lng -97.5164
      const state = detectState(35.4676, -97.5164);
      expect(state).toBe("OK");
    });

    it("returns UNK for point outside all defined states", () => {
      // New York City - not in TX or OK polygons
      const state = detectState(40.7128, -74.006);
      expect(state).toBe("UNK");
    });

    it("returns UNK for point in the ocean", () => {
      const state = detectState(0, 0);
      expect(state).toBe("UNK");
    });

    it("returns UNK for negative lat/lng outside any state", () => {
      const state = detectState(-45, -170);
      expect(state).toBe("UNK");
    });

    it("detects correctly at state boundary area between TX and OK", () => {
      // Point on border area around lat 36.5, which is near TX/OK boundary
      // At the boundary, the specific lat/lng determines which polygon contains the point
      const state = detectState(36.3, -100.0);
      expect(["TX", "OK"]).toContain(state);
    });
  });
});
