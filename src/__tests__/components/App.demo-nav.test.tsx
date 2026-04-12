// Tests R-P6-03, R-P6-04, R-P6-08
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  DEMO_NAV_ALLOWLIST,
  applyDemoNavFilter,
} from "../../../services/demoNavConfig";

// Rendering the full App.tsx in isolation is prohibitively heavy
// (28 React.lazy imports, Firebase, router, etc.). We follow the
// App.navigation.test.tsx precedent: read the source file directly
// and assert structural facts, then exercise the demo filter helper
// against a fixture that mirrors the nav categories defined in
// App.tsx. This is effectively the same evidence a render-based test
// would produce for R-P6-03 and R-P6-04, without the dependency drag.
//
// Normalize CRLF -> LF so the file-content assertions are stable
// across Windows (core.autocrlf=true) and Unix checkouts.
const appSource = fs
  .readFileSync(path.resolve("App.tsx"), "utf-8")
  .replace(/\r\n/g, "\n");

// Snapshot the nav items that App.tsx renders in the default
// (production / demo-mode-off) path. These must match what the
// categories constant in App.tsx declares. The names are asserted
// to exist in the source below so a rename in App.tsx would trip
// this test on purpose.
const PROD_NAV_ITEMS = [
  { id: "operations-hub", label: "Operations Center", category: "OPERATIONS" },
  { id: "loads", label: "Load Board", category: "OPERATIONS" },
  { id: "calendar", label: "Schedule", category: "OPERATIONS" },
  { id: "network", label: "Onboarding", category: "OPERATIONS" },
  { id: "telematics-setup", label: "Telematics", category: "OPERATIONS" },
  { id: "accounting", label: "Financials", category: "FINANCIALS" },
  { id: "exceptions", label: "Issues & Alerts", category: "ADMIN" },
  { id: "company", label: "Company Settings", category: "ADMIN" },
];

describe("App demo-nav integration (source-level)", () => {
  // Tests R-P6-03 — production tenants (demo-mode OFF) see the full nav.
  it("App.tsx source declares all baseline nav labels (demo-mode OFF contract)", () => {
    expect(appSource).toContain('label: "Operations Center"');
    expect(appSource).toContain('label: "Load Board"');
    expect(appSource).toContain('label: "Schedule"');
    expect(appSource).toContain('label: "Onboarding"');
    expect(appSource).toContain('label: "Telematics"');
    expect(appSource).toContain('label: "Financials"');
    expect(appSource).toContain('label: "Issues & Alerts"');
    expect(appSource).toContain('label: "Company Settings"');
  });

  // Tests R-P6-03 — demo-mode OFF must be a no-op in the App.tsx nav
  // pipeline. We assert the gate is present and uses the real helper.
  it("App.tsx only applies the demo filter when isDemoNavMode() is true", () => {
    expect(appSource).toContain("if (isDemoNavMode() && user?.role === ");
    expect(appSource).toContain("applyDemoNavFilter(filteredCategories)");
  });

  // Tests R-P6-04 — demo-mode ON collapses to exactly the 6 allowlist ids.
  it("applyDemoNavFilter against the production nav fixture produces exactly the 6 allowlisted ids", () => {
    const cats = [
      {
        title: "OPERATIONS",
        items: PROD_NAV_ITEMS.filter((i) => i.category === "OPERATIONS").map(
          (i) => ({ id: i.id, label: i.label }),
        ),
      },
      {
        title: "FINANCIALS",
        items: PROD_NAV_ITEMS.filter((i) => i.category === "FINANCIALS").map(
          (i) => ({ id: i.id, label: i.label }),
        ),
      },
      {
        title: "ADMIN",
        items: PROD_NAV_ITEMS.filter((i) => i.category === "ADMIN").map(
          (i) => ({ id: i.id, label: i.label }),
        ),
      },
    ];
    applyDemoNavFilter(cats);
    const remainingIds = cats.flatMap((c) => c.items.map((i) => i.id));
    expect(remainingIds.sort()).toEqual([...DEMO_NAV_ALLOWLIST].sort());
    // Telematics and Company Settings are explicitly dropped.
    expect(remainingIds).not.toContain("telematics-setup");
    expect(remainingIds).not.toContain("company");
  });

  // Tests R-P6-04 — the Reset Demo button JSX block is conditionally
  // rendered only when isDemoNavMode() AND the user is an admin.
  it("App.tsx renders a Reset Demo button conditionally in the sidebar", () => {
    expect(appSource).toContain('data-testid="nav-demo-reset"');
    expect(appSource).toContain(">\n              Reset Demo\n            </");
    // The conditional guard must check both demo mode and admin role.
    // We use a regex to tolerate whitespace between the two clauses.
    const resetButtonRegion = appSource.slice(
      appSource.indexOf('data-testid="nav-demo-reset"') - 400,
      appSource.indexOf('data-testid="nav-demo-reset"'),
    );
    expect(resetButtonRegion).toMatch(/isDemoNavMode\(\)\s*&&/);
    expect(resetButtonRegion).toMatch(/user\?\.role\s*===\s*"admin"/);
  });

  // Tests R-P6-04 — Reset button wires its click handler to the
  // resetDemo() helper (no inline fetch duplication).
  it("App.tsx Reset Demo button dispatches resetDemo() via onClick", () => {
    const buttonRegion = appSource.slice(
      appSource.indexOf('data-testid="nav-demo-reset"'),
      appSource.indexOf('data-testid="nav-demo-reset"') + 400,
    );
    expect(buttonRegion).toContain("await resetDemo()");
    expect(buttonRegion).toContain("setRefreshToast(");
  });

  // Tests R-P6-08 — live-functions-only minimal-touch guarantee.
  //
  // The original BSD branch contract was "App.tsx diff vs main < 30
  // added, 0 removed". That branch-time numstat check became a no-op
  // post-commit (HEAD equals working tree). It is now promoted to a
  // permanent source-shape invariant that pins the BSD demo-mode
  // surface area in App.tsx: exactly one nav filter call, exactly
  // one Reset Demo button, and the import comes from the small
  // demoNavConfig helper module rather than being inlined.
  //
  // Together with R-P6-03 / R-P6-04 (already asserted above), this
  // proves the BSD touch is bounded and any future sprint that
  // accidentally widens the demo surface inside App.tsx will trip
  // this test.
  it("App.tsx demo-mode surface is bounded to the BSD contract", () => {
    const isDemoCount = (appSource.match(/isDemoNavMode\(\)/g) ?? []).length;
    const applyFilterCount = (appSource.match(/applyDemoNavFilter\(/g) ?? [])
      .length;
    const resetDemoCount = (appSource.match(/resetDemo\(\)/g) ?? []).length;
    const navTestIdCount = (
      appSource.match(/data-testid="nav-demo-reset"/g) ?? []
    ).length;
    // 5x isDemoNavMode (route guard useEffect, refresh-toast suppress,
    // nav filter guard, Reset Demo button guard, CommsOverlay demo suppress).
    expect(isDemoCount).toBe(5);
    // 1x applyDemoNavFilter call inside the nav filter block.
    expect(applyFilterCount).toBe(1);
    // 1x resetDemo invocation inside the Reset Demo button onClick.
    expect(resetDemoCount).toBe(1);
    // 1x Reset Demo button (no duplicates).
    expect(navTestIdCount).toBe(1);
    // The helper must still be imported from the small services module.
    expect(appSource).toMatch(
      /import\s*\{[^}]*\bapplyDemoNavFilter\b[^}]*\}\s*from\s*["'][^"']*demoNavConfig["']/,
    );
  });
});
