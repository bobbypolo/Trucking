import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Source-grep tests for LoadList.tsx date formatting and button sizing.
 * LoadList is a ~200 line component with heavy service mocks; for pure source
 * assertions (is formatDate imported? is the raw {load.pickupDate} gone? are
 * buttons at text-[11px]?) reading the file is far more stable than rendering
 * and interacting with the real component.
 */

const LOADLIST_PATH = resolve(__dirname, "../../../components/LoadList.tsx");

function readLoadList(): string {
  return readFileSync(LOADLIST_PATH, "utf-8");
}

describe("LoadList date format and button sizing", () => {
  // Tests R-P1-05
  it("imports formatDate from services/dateFormat", () => {
    const src = readLoadList();
    // Must import formatDate (any import specifier style).
    const importRegex =
      /import\s*\{[^}]*\bformatDate\b[^}]*\}\s*from\s*['"][^'"]*services\/dateFormat['"]/;
    expect(src).toMatch(importRegex);
  });

  // Tests R-P1-05
  it("renders dates via formatDate() — 0 instances of raw {load.pickupDate} remain in JSX", () => {
    const src = readLoadList();
    // The raw JSX expression {load.pickupDate} must not appear in rendered
    // output. (The sort comparator still uses load.pickupDate outside JSX,
    // which is allowed — we only ban the curly-brace JSX form.)
    const rawJsxMatches = src.match(/\{\s*load\.pickupDate\s*\}/g) ?? [];
    expect(rawJsxMatches.length).toBe(0);
  });

  // Tests R-P1-05
  it("references formatDate(load.pickupDate) somewhere in the JSX", () => {
    const src = readLoadList();
    // Must use formatDate(load.pickupDate) for rendering.
    expect(src).toMatch(/formatDate\(\s*load\.pickupDate\s*\)/);
  });

  // Tests R-P1-06
  it("contains 0 instances of text-[10px] on interactive buttons (Call / Modify)", () => {
    const src = readLoadList();
    // The Call and Modify buttons must not use text-[10px]; they must be
    // upgraded to text-[11px].
    // We look for "<button" blocks that reference text-[10px] for button sizing.
    // A conservative grep: no button opening tag whose attached className
    // contains "text-[10px]" in the same className string.
    const buttonBlocks =
      src.match(/<button[^>]*className=\{?[^}]*text-\[10px\][^}]*\}?[^>]*>/g) ??
      [];
    expect(buttonBlocks.length).toBe(0);
  });

  // Tests R-P1-06
  it("uses text-[11px] on the Call and Modify action buttons", () => {
    const src = readLoadList();
    // The Call button className is a distinctive string: it is the only
    // className combining bg-blue-600/10 with text-blue-400.
    const callClassRegex =
      /className="[^"]*bg-blue-600\/10[^"]*text-blue-400[^"]*"/;
    const callMatch = src.match(callClassRegex);
    expect(callMatch).not.toBeNull();
    if (callMatch) {
      expect(callMatch[0]).toContain("text-[11px]");
      expect(callMatch[0]).not.toContain("text-[10px]");
    }

    // The Modify button className is the only className combining bg-slate-800
    // with hover:bg-blue-600 and text-slate-500.
    const modifyClassRegex =
      /className="[^"]*bg-slate-800 hover:bg-blue-600 text-slate-500[^"]*"/;
    const modifyMatch = src.match(modifyClassRegex);
    expect(modifyMatch).not.toBeNull();
    if (modifyMatch) {
      expect(modifyMatch[0]).toContain("text-[11px]");
      expect(modifyMatch[0]).not.toContain("text-[10px]");
    }
  });
});
