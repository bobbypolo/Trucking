/**
 * Tests for services/storage/migrationService.ts (no-op stub)
 * STORY-110: migration infrastructure removed — all domains use server API.
 */
import { describe, it, expect } from "vitest";
import {
  getLocalDataSummary,
  isMigrationComplete,
  markMigrationComplete,
  exportDomainAsJson,
  discardDomain,
  importDomain,
} from "../../../../services/storage/migrationService";

describe("migrationService.ts", () => {
  describe("getLocalDataSummary", () => {
    it("returns empty array — migration complete, no local data", () => {
      const result = getLocalDataSummary();
      expect(result).toEqual([]);
    });
  });

  describe("isMigrationComplete / markMigrationComplete", () => {
    it("always returns true — migration infrastructure removed", () => {
      expect(isMigrationComplete()).toBe(true);
    });

    it("markMigrationComplete is a no-op", () => {
      expect(() => markMigrationComplete()).not.toThrow();
    });
  });

  describe("exportDomainAsJson", () => {
    it("does nothing for unknown domain", () => {
      expect(() => exportDomainAsJson("nonexistent-domain")).not.toThrow();
    });

    it("does nothing for known domain — no-op stub", () => {
      expect(() => exportDomainAsJson("contacts")).not.toThrow();
    });
  });

  describe("discardDomain", () => {
    it("does nothing for unknown domain — no-op stub", () => {
      expect(() => discardDomain("nonexistent-domain")).not.toThrow();
    });

    it("does nothing for known domain — no-op stub", () => {
      expect(() => discardDomain("contacts")).not.toThrow();
    });
  });

  describe("importDomain", () => {
    it("returns zero report for unknown domain — no-op stub", async () => {
      const report = await importDomain("nonexistent-domain");
      expect(report.domain).toBe("nonexistent-domain");
      expect(report.found).toBe(0);
      expect(report.imported).toBe(0);
      expect(report.failed).toBe(0);
      expect(report.errors).toHaveLength(0);
    });

    it("returns zero report for known domain — no data to migrate", async () => {
      const report = await importDomain("contacts");
      expect(report.domain).toBe("contacts");
      expect(report.found).toBe(0);
      expect(report.imported).toBe(0);
    });
  });
});
