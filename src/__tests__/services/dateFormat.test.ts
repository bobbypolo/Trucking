import { describe, it, expect } from "vitest";
import {
  formatDate,
  formatDateTime,
  formatRelativeDate,
} from "../../../services/dateFormat";

describe("dateFormat service", () => {
  describe("formatDate", () => {
    // Tests R-P1-01
    it("returns 'Apr 10, 2026' for ISO date '2026-04-10'", () => {
      expect(formatDate("2026-04-10")).toBe("Apr 10, 2026");
    });

    // Tests R-P1-01
    it("returns '---' for empty string input", () => {
      expect(formatDate("")).toBe("---");
    });

    // Tests R-P1-01
    it("returns '---' for null-ish / invalid input", () => {
      expect(formatDate(undefined as unknown as string)).toBe("---");
      expect(formatDate(null as unknown as string)).toBe("---");
      expect(formatDate("not-a-date")).toBe("---");
    });

    it("formats another known ISO date correctly", () => {
      expect(formatDate("2026-12-25")).toBe("Dec 25, 2026");
    });
  });

  describe("formatDateTime", () => {
    // Tests R-P1-02
    it("returns a string containing 'Apr 10, 2026' plus a time component for a valid ISO datetime", () => {
      const result = formatDateTime("2026-04-10T14:30:00Z");
      expect(result).toContain("Apr 10, 2026");
      // Must include a time component: digits separated by ':'
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });

    // Tests R-P1-02
    it("returns '---' for empty / invalid datetime input", () => {
      expect(formatDateTime("")).toBe("---");
      expect(formatDateTime("garbage")).toBe("---");
    });
  });

  describe("formatRelativeDate", () => {
    it("returns '---' for empty input", () => {
      expect(formatRelativeDate("")).toBe("---");
    });

    it("returns 'Today' for today's date (ISO)", () => {
      const today = new Date();
      const iso = today.toISOString().slice(0, 10);
      expect(formatRelativeDate(iso)).toBe("Today");
    });

    it("falls back to formatDate for far-future dates", () => {
      expect(formatRelativeDate("2030-01-15")).toBe("Jan 15, 2030");
    });
  });
});
