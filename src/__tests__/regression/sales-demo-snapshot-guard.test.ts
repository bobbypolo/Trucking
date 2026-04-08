/**
 * Sales-Demo Regression Guard — live-functions-only snapshot lock
 *
 * Context: Phase 5 of the Bulletproof Sales Demo sprint is explicitly a
 * "regression tests only — zero production-code edits" phase. The goal is
 * to lock the three demo-blocker fixes (commits de188a8, 5f19242, b735d48)
 * so they cannot regress during the sprint window.
 *
 * This file carries two guards that run as plain Node (no React render):
 *
 *  R-P5-04: docs/sales-demo-seed-contract.md must contain an H2 section
 *           titled exactly "## Quotes route disposition". This locks the
 *           written rationale for why the /quotes route is hidden (not
 *           deleted) in sales-demo nav mode.
 *
 *  R-P5-05: components/SafetyView.tsx and components/GlobalMapViewEnhanced.tsx
 *           are on the Phase 5 "DO NOT EDIT" list. We assert the SHA-256
 *           of each file's on-disk byte content matches the checkpoint the
 *           plan was written against. If a later story accidentally edits
 *           either file, this test fails loud before the demo.
 *
 * The expected SHA-256 values are computed once when this test file is
 * first run and then pinned. See the SHA constants near the top of each
 * test — they are the source of truth for "byte-for-byte no diff vs the
 * sprint-start HEAD".
 *
 * Tests R-P5-04, R-P5-05
 */

import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Project root resolution
// ---------------------------------------------------------------------------
// Vitest runs from the repository root (where vitest.config.ts lives), so
// process.cwd() is the project root. We resolve all paths relative to it so
// the test is stable regardless of where it lives in the tree.
const projectRoot = process.cwd();

const readProjectFile = (relativePath: string): string => {
  const full = resolve(projectRoot, relativePath);
  return readFileSync(full, "utf8");
};

const sha256 = (contents: string): string =>
  createHash("sha256").update(contents, "utf8").digest("hex");

// ---------------------------------------------------------------------------
// R-P5-05: Protected file content SHA-256 pins
// ---------------------------------------------------------------------------
// These SHA-256 values were captured at the HEAD of ralph/bulletproof-sales-
// demo commit 5e41907d (STORY-001 post-merge checkpoint). They pin the exact
// byte content of the two production components that Phase 5 must NOT edit.
//
// If you are reading this because a test failed: either (a) you made an
// unrelated intentional edit to one of these files — in which case the
// sprint rule has been broken and the PR should be rejected — or (b) a
// merge from main dragged in a legitimate change. In case (b), the fix is
// NOT to rotate the SHA here; it is to re-plan the phase with the owner.
const SAFETYVIEW_PATH = "components/SafetyView.tsx";
const GLOBALMAP_PATH = "components/GlobalMapViewEnhanced.tsx";

// Computed once on first successful run; pinned below.
const SAFETYVIEW_SHA_PIN =
  "1ec4ac187d8b7def03fe4285a053983207f6338716cfee5efdf6a796a5352663";
const GLOBALMAP_SHA_PIN =
  "832173bdff3b352daf8fe9758a4c74611c4188c561a2dfe5d409916f6f02a365";

// ---------------------------------------------------------------------------
// R-P5-04: docs/sales-demo-seed-contract.md H2 assertion
// ---------------------------------------------------------------------------
describe("sales-demo-seed-contract.md documents Quotes route disposition (R-P5-04)", () => {
  it("contains a level-2 heading '## Quotes route disposition'", () => {
    // Tests R-P5-04: Phase 5 adds exactly one new H2 section to the
    // already-existing contract file (authored by STORY-001) explaining
    // why the /quotes route is hidden rather than fixed in this sprint.
    const contents = readProjectFile("docs/sales-demo-seed-contract.md");

    // Use a start-of-line anchored regex so we do not match any incidental
    // mention of the phrase inside a paragraph. H2 = exactly two hashes
    // followed by a space and the exact title.
    const h2Regex = /^## Quotes route disposition\s*$/m;
    expect(h2Regex.test(contents)).toBe(true);

    // Belt-and-suspenders: make sure the section actually has body text
    // beneath the heading (not just an empty stub).
    const afterHeading =
      contents.split(/^## Quotes route disposition\s*$/m)[1] ?? "";
    expect(afterHeading.trim().length).toBeGreaterThan(200);
  });
});

// ---------------------------------------------------------------------------
// R-P5-05: SafetyView.tsx and GlobalMapViewEnhanced.tsx snapshot guard
// ---------------------------------------------------------------------------
describe("live-functions-only snapshot guard for protected components (R-P5-05)", () => {
  it("components/SafetyView.tsx matches its Phase 5 pinned SHA-256", () => {
    // Tests R-P5-05 (part 1): SafetyView.tsx must be byte-for-byte
    // identical to the sprint-start content. If this test fails, a later
    // story accidentally edited SafetyView.tsx, violating the Phase 5
    // "zero production-code edits" rule.
    const contents = readProjectFile(SAFETYVIEW_PATH);
    const actualSha = sha256(contents);

    // First-run bootstrap: if the pin placeholder is still present, the
    // current SHA is captured and the test fails loud with the value to
    // paste back into SAFETYVIEW_SHA_PIN. This makes the one-time bootstrap
    // obvious rather than silently passing a meaningless comparison.
    if (SAFETYVIEW_SHA_PIN.startsWith("__PIN_")) {
      throw new Error(
        `R-P5-05 bootstrap: paste this SHA-256 into SAFETYVIEW_SHA_PIN: ${actualSha}`,
      );
    }

    expect(actualSha).toBe(SAFETYVIEW_SHA_PIN);
  });

  it("components/GlobalMapViewEnhanced.tsx matches its Phase 5 pinned SHA-256", () => {
    // Tests R-P5-05 (part 2): same contract as part 1, for the second
    // protected component. Both files must be pinned together — editing
    // either one without the other violates the sprint rule.
    const contents = readProjectFile(GLOBALMAP_PATH);
    const actualSha = sha256(contents);

    if (GLOBALMAP_SHA_PIN.startsWith("__PIN_")) {
      throw new Error(
        `R-P5-05 bootstrap: paste this SHA-256 into GLOBALMAP_SHA_PIN: ${actualSha}`,
      );
    }

    expect(actualSha).toBe(GLOBALMAP_SHA_PIN);
  });
});
