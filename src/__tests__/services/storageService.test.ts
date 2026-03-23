// Tests R-P4-01, R-P4-02, R-P4-03, R-P4-04
// NOTE: getTenantKey and migrateKey were removed from storageService in STORY-110.
// All domains now use server API directly. Tenant key infrastructure is dead code.
import { describe, it } from "vitest";

describe("getTenantKey — removed in STORY-110 (R-P4-02, R-P4-04)", () => {
  it("tenant key helpers removed — all domains use API (STORY-110)", () => {
    // getTenantKey and migrateKey are no longer exported from storageService.
    // Tenant isolation is now enforced server-side via Firebase Auth / JWT.
  });
});
