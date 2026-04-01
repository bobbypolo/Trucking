/**
 * Icon Button Accessibility Tests
 *
 * Validates that all icon-only buttons across 12 target components have
 * proper aria-label attributes for screen reader accessibility.
 *
 * # Tests R-A11Y-01, R-A11Y-02, R-A11Y-04, R-A11Y-05
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const COMPONENTS_DIR = path.resolve(__dirname, "../../../components");

/**
 * Target files that must have all icon-only buttons labeled.
 * These are the 12 components in scope for the accessibility story.
 */
const TARGET_FILES = [
  "LoadList.tsx",
  "LoadDetailView.tsx",
  "BookingPortal.tsx",
  "QuoteManager.tsx",
  "BrokerManager.tsx",
  "ExceptionConsole.tsx",
  "FileVault.tsx",
  "IFTAManager.tsx",
  "CommandCenterView.tsx",
  "OperationalMessaging.tsx",
  "CalendarView.tsx",
  "DataImportWizard.tsx",
];

/**
 * Icons that are commonly used as icon-only buttons (no visible text).
 * These MUST have aria-label when used inside a <button> without adjacent text.
 */
const ICON_ONLY_NAMES = [
  "X",
  "Trash2",
  "Plus",
  "Edit2",
  "MoreVertical",
  "Filter",
  "Download",
  "Upload",
  "Search",
  "Phone",
  "Send",
  "Paperclip",
  "Smile",
  "ChevronLeft",
  "ChevronRight",
  "LayoutGrid",
  "List",
  "Maximize2",
  "RefreshCw",
  "Lock",
  "Unlock",
  "Settings",
  "Eye",
  "ExternalLink",
  "Info",
  "ArrowLeft",
  "History",
];

/**
 * Reads a component file and returns its content.
 */
function readComponent(filename: string): string {
  const filePath = path.join(COMPONENTS_DIR, filename);
  return fs.readFileSync(filePath, "utf-8");
}

/**
 * Finds icon-only buttons in JSX source. An icon-only button is a <button>
 * element that contains an icon component but no visible text content
 * (only whitespace or empty between button open and close tags aside from
 * the icon component).
 *
 * Returns array of { line, icon, hasAriaLabel } objects.
 */
function findIconOnlyButtons(
  source: string,
): Array<{ line: number; icon: string; hasAriaLabel: boolean }> {
  const results: Array<{ line: number; icon: string; hasAriaLabel: boolean }> =
    [];
  const lines = source.split("\n");

  // Pattern: <button ...> <IconName ... /> </button> where there's no text
  // We look for button elements that contain only icon components and whitespace
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this line opens a button tag
    if (!line.includes("<button")) continue;

    // Collect the full button element (may span multiple lines)
    let buttonBlock = "";
    let depth = 0;
    let startLine = i;
    for (let j = i; j < Math.min(i + 15, lines.length); j++) {
      buttonBlock += lines[j] + "\n";
      // Count opening/closing button tags
      const opens = (lines[j].match(/<button/g) || []).length;
      const closes = (lines[j].match(/<\/button>/g) || []).length;
      depth += opens - closes;
      if (depth <= 0 && closes > 0) break;
    }

    // Check if this button contains ONLY an icon (no visible text)
    for (const iconName of ICON_ONLY_NAMES) {
      const iconRegex = new RegExp(`<${iconName}\\s`);
      if (!iconRegex.test(buttonBlock)) continue;

      // Remove the icon tag, button tags, className strings, onClick handlers, etc.
      // and check if there's any remaining visible text
      let stripped = buttonBlock
        .replace(/<button[^>]*>/g, "")
        .replace(/<\/button>/g, "")
        .replace(/<[A-Z][a-zA-Z0-9]*\s[^/]*\/>/g, "") // self-closing components
        .replace(/<[a-z][a-zA-Z0-9]*\s[^/]*\/>/g, "") // self-closing HTML
        .replace(/\{[^}]*\}/g, "") // JSX expressions
        .replace(/<!--[\s\S]*?-->/g, "") // comments
        .trim();

      // If stripped content has alphabetic characters, it has visible text — not icon-only
      const hasVisibleText = /[a-zA-Z]{2,}/.test(stripped);
      if (hasVisibleText) continue;

      // This is an icon-only button — check for aria-label
      const hasAriaLabel = /aria-label/.test(buttonBlock);
      results.push({
        line: startLine + 1,
        icon: iconName,
        hasAriaLabel,
      });
    }
  }

  return results;
}

describe("Icon Button Accessibility", () => {
  // R-A11Y-01: Zero icon-only buttons lacking aria-label
  describe("R-A11Y-01: All icon-only buttons have aria-label", () => {
    for (const file of TARGET_FILES) {
      it(`${file} has no icon-only buttons without aria-label`, () => {
        const source = readComponent(file);
        const iconButtons = findIconOnlyButtons(source);
        const missing = iconButtons.filter((b) => !b.hasAriaLabel);

        if (missing.length > 0) {
          const details = missing
            .map((b) => `  Line ${b.line}: <${b.icon}> icon button`)
            .join("\n");
          // Fail with details of which buttons are missing aria-labels
          expect(
            missing.length,
            `${file}: ${missing.length} icon-only button(s) without aria-label:\n${details}`,
          ).toBe(0);
        } else {
          expect(missing.length).toBe(0);
        }
      });
    }
  });

  // R-A11Y-02: All Trash2/delete buttons have aria-label containing "delete" or "remove"
  describe("R-A11Y-02: Delete buttons have appropriate aria-labels", () => {
    for (const file of TARGET_FILES) {
      it(`${file} Trash2 buttons have delete/remove aria-label`, () => {
        const source = readComponent(file);
        const lines = source.split("\n");

        for (let i = 0; i < lines.length; i++) {
          if (!lines[i].includes("<Trash2")) continue;

          // Look backwards to find the enclosing <button> tag (scan up to 10 lines back)
          let buttonOpenLine = -1;
          for (let j = i; j >= Math.max(0, i - 10); j--) {
            if (lines[j].includes("<button")) {
              buttonOpenLine = j;
              break;
            }
          }
          if (buttonOpenLine === -1) continue;

          // Collect only the button's opening tag (from <button to the next >)
          let buttonTag = "";
          for (
            let j = buttonOpenLine;
            j <= Math.min(i + 2, lines.length - 1);
            j++
          ) {
            buttonTag += lines[j] + "\n";
            // Stop once we reach a closing > for the opening tag
            if (j > buttonOpenLine && lines[j].includes(">")) break;
          }

          // Extract aria-label from this specific button tag
          const ariaMatch = buttonTag.match(/aria-label=["']([^"']*)["']/);
          if (ariaMatch) {
            const label = ariaMatch[1].toLowerCase();
            expect(label.includes("delete") || label.includes("remove")).toBe(
              true,
            );
          }
          // If no aria-label at all, R-A11Y-01 catches it
        }
      });
    }
  });

  // R-A11Y-04: 30+ new aria-label attributes across codebase
  describe("R-A11Y-04: Sufficient aria-label coverage", () => {
    it("target files collectively have 30+ aria-label attributes", () => {
      let totalAriaLabels = 0;

      for (const file of TARGET_FILES) {
        const source = readComponent(file);
        const matches = source.match(/aria-label/g);
        totalAriaLabels += matches ? matches.length : 0;
      }

      expect(totalAriaLabels).toBeGreaterThanOrEqual(30);
    });
  });
});
