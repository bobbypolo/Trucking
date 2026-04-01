import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Tests R-A11Y-07 through R-A11Y-12: Modal Focus Trapping
 *
 * Verifies that useFocusTrap is imported and called in all required
 * modal components, bringing total usage to 11+ components.
 */

const COMPONENTS_DIR = path.resolve(__dirname, "../../../components");
const HOOKS_DIR = path.resolve(__dirname, "../../../hooks");

function readComponent(filename: string): string {
  return fs.readFileSync(path.join(COMPONENTS_DIR, filename), "utf-8");
}

describe("Modal Focus Trapping — useFocusTrap integration", () => {
  // Tests R-A11Y-07
  it("BrokerManager.tsx imports and calls useFocusTrap", () => {
    const source = readComponent("BrokerManager.tsx");
    expect(source).toContain('import { useFocusTrap }');
    expect(source).toMatch(/useFocusTrap\s*\(/);
  });

  // Tests R-A11Y-08
  it("CalendarView.tsx imports and calls useFocusTrap", () => {
    const source = readComponent("CalendarView.tsx");
    expect(source).toContain('import { useFocusTrap }');
    expect(source).toMatch(/useFocusTrap\s*\(/);
  });

  // Tests R-A11Y-09
  it("FileVault.tsx imports and calls useFocusTrap", () => {
    const source = readComponent("FileVault.tsx");
    expect(source).toContain('import { useFocusTrap }');
    expect(source).toMatch(/useFocusTrap\s*\(/);
  });

  // Tests R-A11Y-10
  it("ExceptionConsole.tsx imports and calls useFocusTrap", () => {
    const source = readComponent("ExceptionConsole.tsx");
    expect(source).toContain('import { useFocusTrap }');
    expect(source).toMatch(/useFocusTrap\s*\(/);
  });

  // Tests R-A11Y-11
  it("11+ components total import useFocusTrap (up from 6)", () => {
    const componentFiles = fs.readdirSync(COMPONENTS_DIR, { recursive: true });
    let count = 0;
    for (const file of componentFiles) {
      const filePath = path.join(COMPONENTS_DIR, String(file));
      if (!fs.statSync(filePath).isFile()) continue;
      if (!String(file).endsWith(".tsx") && !String(file).endsWith(".ts")) continue;
      const content = fs.readFileSync(filePath, "utf-8");
      if (content.includes("useFocusTrap")) {
        count++;
      }
    }
    expect(count).toBeGreaterThanOrEqual(11);
  });

  // Tests R-A11Y-12 (implicitly — this test file must exit 0)
  it("IFTAManager.tsx imports and calls useFocusTrap", () => {
    const source = readComponent("IFTAManager.tsx");
    expect(source).toContain('import { useFocusTrap }');
    expect(source).toMatch(/useFocusTrap\s*\(/);
  });

  it("LoadDetailView.tsx imports and calls useFocusTrap", () => {
    const source = readComponent("LoadDetailView.tsx");
    expect(source).toContain('import { useFocusTrap }');
    expect(source).toMatch(/useFocusTrap\s*\(/);
  });

  // Verify original 6 components still have useFocusTrap
  it("original 6 modals still use useFocusTrap", () => {
    const originals = [
      "EditUserModal.tsx",
      "ExportModal.tsx",
      "LoadSetupModal.tsx",
    ];
    const uiOriginals = [
      "ui/ConfirmDialog.tsx",
      "ui/InputDialog.tsx",
      "ui/SessionExpiredModal.tsx",
    ];

    for (const file of originals) {
      const source = readComponent(file);
      expect(source).toContain("useFocusTrap");
    }
    for (const file of uiOriginals) {
      const source = readComponent(file);
      expect(source).toContain("useFocusTrap");
    }
  });

  // Negative test: a component without a modal should NOT have useFocusTrap
  it("non-modal component does not import useFocusTrap", () => {
    const toastSource = readComponent("Toast.tsx");
    expect(toastSource).not.toContain("useFocusTrap");
  });

  // Verify useFocusTrap hook exists and exports correctly
  it("useFocusTrap hook exports the function", () => {
    const hookSource = fs.readFileSync(
      path.join(HOOKS_DIR, "useFocusTrap.ts"),
      "utf-8",
    );
    expect(hookSource).toContain("export function useFocusTrap");
  });
});
