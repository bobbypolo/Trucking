/**
 * Tests R-P8-04, R-P8-05: Quote repository margin column support
 *
 * Validates `quote.repository.ts`:
 *  - QUOTE_UPDATABLE_COLUMNS array includes all 5 new margin column names
 *  - create() INSERT SQL string contains all 5 new column names
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REPO_FILE = path.resolve(
  __dirname,
  "../../repositories/quote.repository.ts",
);

function readRepoSource(): string {
  return fs.readFileSync(REPO_FILE, "utf-8");
}

describe("Quote repository — margin columns (R-P8-04, R-P8-05)", () => {
  // ── R-P8-04: QUOTE_UPDATABLE_COLUMNS includes all 5 new strings ─────

  it("Tests R-P8-04 — source defines QUOTE_UPDATABLE_COLUMNS array", () => {
    const source = readRepoSource();
    expect(source).toContain("QUOTE_UPDATABLE_COLUMNS");
  });

  it("Tests R-P8-04 — QUOTE_UPDATABLE_COLUMNS contains 'margin'", () => {
    const source = readRepoSource();
    // Narrow to the array literal to avoid matching incidental occurrences
    const arrStart = source.indexOf("QUOTE_UPDATABLE_COLUMNS");
    const arrEnd = source.indexOf("]", arrStart);
    expect(arrStart).toBeGreaterThan(-1);
    expect(arrEnd).toBeGreaterThan(arrStart);
    const arrLiteral = source.substring(arrStart, arrEnd + 1);
    expect(arrLiteral).toContain('"margin"');
  });

  it("Tests R-P8-04 — QUOTE_UPDATABLE_COLUMNS contains 'discount'", () => {
    const source = readRepoSource();
    const arrStart = source.indexOf("QUOTE_UPDATABLE_COLUMNS");
    const arrEnd = source.indexOf("]", arrStart);
    const arrLiteral = source.substring(arrStart, arrEnd + 1);
    expect(arrLiteral).toContain('"discount"');
  });

  it("Tests R-P8-04 — QUOTE_UPDATABLE_COLUMNS contains 'commission'", () => {
    const source = readRepoSource();
    const arrStart = source.indexOf("QUOTE_UPDATABLE_COLUMNS");
    const arrEnd = source.indexOf("]", arrStart);
    const arrLiteral = source.substring(arrStart, arrEnd + 1);
    expect(arrLiteral).toContain('"commission"');
  });

  it("Tests R-P8-04 — QUOTE_UPDATABLE_COLUMNS contains 'estimated_driver_pay'", () => {
    const source = readRepoSource();
    const arrStart = source.indexOf("QUOTE_UPDATABLE_COLUMNS");
    const arrEnd = source.indexOf("]", arrStart);
    const arrLiteral = source.substring(arrStart, arrEnd + 1);
    expect(arrLiteral).toContain('"estimated_driver_pay"');
  });

  it("Tests R-P8-04 — QUOTE_UPDATABLE_COLUMNS contains 'company_cost_factor'", () => {
    const source = readRepoSource();
    const arrStart = source.indexOf("QUOTE_UPDATABLE_COLUMNS");
    const arrEnd = source.indexOf("]", arrStart);
    const arrLiteral = source.substring(arrStart, arrEnd + 1);
    expect(arrLiteral).toContain('"company_cost_factor"');
  });

  it("Tests R-P8-04 — QUOTE_UPDATABLE_COLUMNS includes all 5 new strings (batch)", () => {
    const source = readRepoSource();
    const arrStart = source.indexOf("QUOTE_UPDATABLE_COLUMNS");
    const arrEnd = source.indexOf("]", arrStart);
    const arrLiteral = source.substring(arrStart, arrEnd + 1);
    const required = [
      '"margin"',
      '"discount"',
      '"commission"',
      '"estimated_driver_pay"',
      '"company_cost_factor"',
    ];
    const missing = required.filter((s) => !arrLiteral.includes(s));
    expect(
      missing,
      `Missing from QUOTE_UPDATABLE_COLUMNS: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  // ── R-P8-05: create() INSERT SQL contains all 5 new column names ────

  it("Tests R-P8-05 — create() INSERT SQL contains 'margin' column", () => {
    const source = readRepoSource();
    // Find INSERT INTO quotes block
    const insertIdx = source.indexOf("INSERT INTO quotes");
    expect(insertIdx).toBeGreaterThan(-1);
    // Insert statement is a template/string literal spanning to closing paren of VALUES
    const endIdx = source.indexOf(")`", insertIdx);
    const insertBlock = source.substring(
      insertIdx,
      endIdx > -1 ? endIdx : insertIdx + 2000,
    );
    expect(insertBlock).toContain("margin");
  });

  it("Tests R-P8-05 — create() INSERT SQL contains 'discount' column", () => {
    const source = readRepoSource();
    const insertIdx = source.indexOf("INSERT INTO quotes");
    const endIdx = source.indexOf(")`", insertIdx);
    const insertBlock = source.substring(
      insertIdx,
      endIdx > -1 ? endIdx : insertIdx + 2000,
    );
    expect(insertBlock).toContain("discount");
  });

  it("Tests R-P8-05 — create() INSERT SQL contains 'commission' column", () => {
    const source = readRepoSource();
    const insertIdx = source.indexOf("INSERT INTO quotes");
    const endIdx = source.indexOf(")`", insertIdx);
    const insertBlock = source.substring(
      insertIdx,
      endIdx > -1 ? endIdx : insertIdx + 2000,
    );
    expect(insertBlock).toContain("commission");
  });

  it("Tests R-P8-05 — create() INSERT SQL contains 'estimated_driver_pay' column", () => {
    const source = readRepoSource();
    const insertIdx = source.indexOf("INSERT INTO quotes");
    const endIdx = source.indexOf(")`", insertIdx);
    const insertBlock = source.substring(
      insertIdx,
      endIdx > -1 ? endIdx : insertIdx + 2000,
    );
    expect(insertBlock).toContain("estimated_driver_pay");
  });

  it("Tests R-P8-05 — create() INSERT SQL contains 'company_cost_factor' column", () => {
    const source = readRepoSource();
    const insertIdx = source.indexOf("INSERT INTO quotes");
    const endIdx = source.indexOf(")`", insertIdx);
    const insertBlock = source.substring(
      insertIdx,
      endIdx > -1 ? endIdx : insertIdx + 2000,
    );
    expect(insertBlock).toContain("company_cost_factor");
  });

  it("Tests R-P8-05 — create() INSERT SQL column list and VALUES placeholder counts match", () => {
    const source = readRepoSource();
    const insertIdx = source.indexOf("INSERT INTO quotes");
    expect(insertIdx).toBeGreaterThan(-1);
    // Columns are inside the parens immediately after 'quotes'
    const colsStart = source.indexOf("(", insertIdx);
    const colsEnd = source.indexOf(")", colsStart);
    const colsList = source.substring(colsStart + 1, colsEnd);
    const cols = colsList
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    // VALUES placeholders
    const valuesIdx = source.indexOf("VALUES", colsEnd);
    const valsStart = source.indexOf("(", valuesIdx);
    const valsEnd = source.indexOf(")", valsStart);
    const valsList = source.substring(valsStart + 1, valsEnd);
    const placeholders = valsList
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c === "?");
    expect(cols.length).toBe(placeholders.length);
    // Must be at least 22 (17 original + 5 new) — guard against regression
    expect(cols.length).toBeGreaterThanOrEqual(22);
  });
});
