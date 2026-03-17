import { describe, it, expect } from "vitest";
import { buildSafeUpdate } from "../../lib/safe-update";

/**
 * Tests for server/lib/safe-update.ts
 *
 * Pure function — no mocks needed.
 * Focus on uncovered branches (lines 26-35): undefined values, extraSets, empty results.
 */

describe("safe-update.ts — buildSafeUpdate", () => {
  const ALLOWED = ["name", "email", "role", "status"] as const;

  describe("basic field filtering", () => {
    it("includes only allowed columns", () => {
      const result = buildSafeUpdate(
        { name: "Alice", email: "a@b.com", hacker_field: "drop table" },
        ALLOWED,
      );

      expect(result).not.toBeNull();
      expect(result!.setClause).toBe("name = ?, email = ?");
      expect(result!.values).toEqual(["Alice", "a@b.com"]);
    });

    it("returns null when no valid fields to update", () => {
      const result = buildSafeUpdate(
        { invalid_field: "value", another_bad: 123 },
        ALLOWED,
      );

      expect(result).toBeNull();
    });

    it("returns null for empty data object", () => {
      const result = buildSafeUpdate({}, ALLOWED);
      expect(result).toBeNull();
    });

    it("silently ignores keys not in allowed set (no injection)", () => {
      const result = buildSafeUpdate(
        { name: "Alice", "'; DROP TABLE users; --": "attack" },
        ALLOWED,
      );

      expect(result).not.toBeNull();
      expect(result!.setClause).toBe("name = ?");
      expect(result!.values).toEqual(["Alice"]);
    });
  });

  describe("undefined value handling (lines 26-35)", () => {
    it("skips fields with undefined values", () => {
      const result = buildSafeUpdate(
        { name: "Alice", email: undefined, role: "admin" },
        ALLOWED,
      );

      expect(result).not.toBeNull();
      expect(result!.setClause).toBe("name = ?, role = ?");
      expect(result!.values).toEqual(["Alice", "admin"]);
    });

    it("includes fields with null values (null is valid SQL)", () => {
      const result = buildSafeUpdate(
        { name: null, email: "a@b.com" },
        ALLOWED,
      );

      expect(result).not.toBeNull();
      expect(result!.values).toContain(null);
    });

    it("includes fields with empty string values", () => {
      const result = buildSafeUpdate(
        { name: "", email: "a@b.com" },
        ALLOWED,
      );

      expect(result).not.toBeNull();
      expect(result!.values).toContain("");
    });

    it("includes fields with 0 and false values", () => {
      const result = buildSafeUpdate(
        { name: 0 as unknown, email: false as unknown },
        ALLOWED,
      );

      expect(result).not.toBeNull();
      expect(result!.values).toContain(0);
      expect(result!.values).toContain(false);
    });

    it("returns null when all allowed fields are undefined", () => {
      const result = buildSafeUpdate(
        { name: undefined, email: undefined },
        ALLOWED,
      );

      expect(result).toBeNull();
    });
  });

  describe("extraSets and extraValues", () => {
    it("appends extraSets with their values", () => {
      const result = buildSafeUpdate(
        { name: "Alice" },
        ALLOWED,
        ["updated_by = ?", "updated_at = NOW()"],
        ["user-123"],
      );

      expect(result).not.toBeNull();
      expect(result!.setClause).toBe(
        "name = ?, updated_by = ?, updated_at = NOW()",
      );
      expect(result!.values).toEqual(["Alice", "user-123"]);
    });

    it("uses extraSets even when no data fields match", () => {
      const result = buildSafeUpdate(
        { invalid: "value" },
        ALLOWED,
        ["updated_at = NOW()"],
        [],
      );

      expect(result).not.toBeNull();
      expect(result!.setClause).toBe("updated_at = NOW()");
      expect(result!.values).toEqual([]);
    });

    it("handles extraSets with more values than sets", () => {
      const result = buildSafeUpdate(
        { name: "Alice" },
        ALLOWED,
        ["updated_by = ?"],
        ["user-123", "extra-value-ignored-but-added"],
      );

      expect(result).not.toBeNull();
      // Only the first extraValue is pushed (matches i < extraValues.length)
      expect(result!.values).toContain("user-123");
    });

    it("handles extraSets with fewer values than sets", () => {
      const result = buildSafeUpdate(
        { name: "Alice" },
        ALLOWED,
        ["updated_by = ?", "updated_at = NOW()"],
        ["user-123"],
      );

      expect(result).not.toBeNull();
      // First extraSet gets its value, second has no corresponding value
      expect(result!.setClause).toContain("updated_by = ?");
      expect(result!.setClause).toContain("updated_at = NOW()");
      expect(result!.values).toEqual(["Alice", "user-123"]);
    });

    it("returns null when no fields and no extraSets", () => {
      const result = buildSafeUpdate({}, ALLOWED, [], []);
      expect(result).toBeNull();
    });

    it("defaults extraSets and extraValues to empty arrays", () => {
      const result = buildSafeUpdate({ name: "Test" }, ALLOWED);
      expect(result).not.toBeNull();
      expect(result!.setClause).toBe("name = ?");
      expect(result!.values).toEqual(["Test"]);
    });
  });

  describe("edge cases", () => {
    it("handles single allowed column", () => {
      const result = buildSafeUpdate({ name: "Test" }, ["name"]);
      expect(result).not.toBeNull();
      expect(result!.setClause).toBe("name = ?");
    });

    it("handles data with many fields but only one allowed", () => {
      const result = buildSafeUpdate(
        { a: 1, b: 2, c: 3, name: "Test", d: 4, e: 5 },
        ALLOWED,
      );

      expect(result).not.toBeNull();
      expect(result!.setClause).toBe("name = ?");
      expect(result!.values).toEqual(["Test"]);
    });

    it("preserves order of Object.entries iteration", () => {
      const result = buildSafeUpdate(
        { status: "active", name: "Test", role: "admin", email: "a@b.com" },
        ALLOWED,
      );

      expect(result).not.toBeNull();
      // Object.entries preserves insertion order
      expect(result!.setClause).toBe(
        "status = ?, name = ?, role = ?, email = ?",
      );
    });
  });
});
