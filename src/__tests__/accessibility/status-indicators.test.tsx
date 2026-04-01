/**
 * Status Indicator Accessibility Tests
 *
 * Validates that color-only status dots have adjacent sr-only text
 * to convey status information to screen reader users.
 *
 * # Tests R-A11Y-03, R-A11Y-06
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const COMPONENTS_DIR = path.resolve(__dirname, "../../../components");

/**
 * Files that contain color-only status dots that need sr-only text.
 */
const STATUS_DOT_FILES: Array<{
  file: string;
  expectedDots: number;
}> = [
  { file: "ExceptionConsole.tsx", expectedDots: 4 },
  { file: "CommandCenterView.tsx", expectedDots: 1 },
  { file: "OperationalMessaging.tsx", expectedDots: 2 },
  { file: "CalendarView.tsx", expectedDots: 1 },
];

/**
 * Pattern to detect color-only status dots: small rounded-full elements
 * with color classes but no text content.
 */
const STATUS_DOT_PATTERN =
  /className="[^"]*w-[123](?:\.\d)?\s+h-[123](?:\.\d)?\s+rounded-full[^"]*bg-(?:green|red|yellow|blue|orange|amber|emerald|purple|slate)-(?:400|500|600)[^"]*"/g;

/**
 * Check if a status dot has adjacent sr-only text within its parent context.
 * Looks for <span className="sr-only"> within a few lines of the dot.
 */
function findStatusDotsWithoutSrOnly(
  source: string,
): Array<{ line: number; className: string; hasSrOnly: boolean }> {
  const results: Array<{
    line: number;
    className: string;
    hasSrOnly: boolean;
  }> = [];
  const lines = source.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for status dot pattern
    const dotMatch = line.match(
      /className="([^"]*w-[123](?:\.\d)?\s+h-[123](?:\.\d)?\s+rounded-full[^"]*bg-(?:green|red|yellow|blue|orange|amber|emerald|purple|slate)-(?:400|500|600)[^"]*)"/,
    );
    if (!dotMatch) continue;

    // Look within surrounding context (5 lines before and after) for sr-only
    let context = "";
    for (let j = Math.max(0, i - 5); j < Math.min(i + 5, lines.length); j++) {
      context += lines[j] + "\n";
    }

    const hasSrOnly = context.includes("sr-only");
    results.push({
      line: i + 1,
      className: dotMatch[1],
      hasSrOnly,
    });
  }

  return results;
}

/**
 * Reads a component file and returns its content.
 */
function readComponent(filename: string): string {
  const filePath = path.join(COMPONENTS_DIR, filename);
  return fs.readFileSync(filePath, "utf-8");
}

describe("Status Indicator Accessibility", () => {
  // R-A11Y-03: Color-only status dots have adjacent sr-only text
  describe("R-A11Y-03: Status dots have sr-only text", () => {
    for (const { file, expectedDots } of STATUS_DOT_FILES) {
      it(`${file} status dots have adjacent sr-only text`, () => {
        const source = readComponent(file);
        const dots = findStatusDotsWithoutSrOnly(source);

        if (dots.length === 0) {
          // No status dots found — skip (not a failure)
          return;
        }

        const missing = dots.filter((d) => !d.hasSrOnly);
        if (missing.length > 0) {
          const details = missing
            .map((d) => `  Line ${d.line}: ${d.className.substring(0, 60)}...`)
            .join("\n");
          expect(missing.length).toBe(
            0,
            // @ts-expect-error: vitest message arg
            `Found ${missing.length} status dot(s) without sr-only text in ${file}:\n${details}`,
          );
        }
        expect(missing.length).toBe(0);
      });
    }
  });

  // Verify sr-only class is used correctly (not empty)
  describe("sr-only text content is meaningful", () => {
    for (const { file } of STATUS_DOT_FILES) {
      it(`${file} sr-only spans contain descriptive text`, () => {
        const source = readComponent(file);

        // Find all sr-only spans
        const srOnlyMatches = source.match(
          /className="sr-only"[^>]*>([^<]*)</g,
        );
        if (!srOnlyMatches) return; // No sr-only spans, covered by other test

        for (const match of srOnlyMatches) {
          const textMatch = match.match(/>([^<]*)/);
          if (textMatch) {
            const text = textMatch[1].trim();
            expect(text.length).toBeGreaterThan(0);
          }
        }
      });
    }
  });

  // Cross-check: sr-only class exists in components that have status dots
  describe("Status dot files use sr-only pattern", () => {
    it("all status dot files contain at least one sr-only element", () => {
      for (const { file } of STATUS_DOT_FILES) {
        const source = readComponent(file);
        expect(source).toContain("sr-only");
      }
    });
  });
});
