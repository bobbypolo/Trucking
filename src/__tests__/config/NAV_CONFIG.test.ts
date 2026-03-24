/**
 * Tests for NAV_CONFIG.ts — role-based navigation visibility matrix.
 * Verifies all 5 canonical roles × 9 pages match the approved matrix
 * from NAV_VISIBILITY_AND_ROLE_MATRIX.md.
 */
import { describe, it, expect } from "vitest";
import {
  getVisibleNavIds,
  getNavAccessLevel,
  isNavItemVisible,
} from "../../../config/NAV_CONFIG";
import type { UserRole } from "../../../types";

const ALL_NAV_IDS = [
  "operations-hub",
  "loads",
  "quotes",
  "calendar",
  "network",
  "finance",
  "accounting",
  "exceptions",
  "company",
] as const;

describe("NAV_CONFIG — approved visibility matrix", () => {
  describe("admin sees all 9 pages", () => {
    it("returns all 9 nav IDs for admin", () => {
      const ids = getVisibleNavIds("admin");
      expect(ids).toHaveLength(9);
      for (const id of ALL_NAV_IDS) {
        expect(ids).toContain(id);
      }
    });

    it("all pages have full access for admin", () => {
      for (const id of ALL_NAV_IDS) {
        expect(getNavAccessLevel("admin", id)).toBe("full");
      }
    });
  });

  describe("owner sees all 9 pages", () => {
    it("returns all 9 nav IDs for owner_operator", () => {
      const ids = getVisibleNavIds("owner_operator");
      expect(ids).toHaveLength(9);
    });

    it("enterprise OWNER_ADMIN also sees all 9", () => {
      const ids = getVisibleNavIds("OWNER_ADMIN");
      expect(ids).toHaveLength(9);
    });

    it("FLEET_OO_ADMIN_PORTAL maps to owner and sees all 9", () => {
      const ids = getVisibleNavIds("FLEET_OO_ADMIN_PORTAL");
      expect(ids).toHaveLength(9);
    });
  });

  describe("dispatcher sees 8 pages (not Company Settings)", () => {
    const dispatcherRoles: UserRole[] = [
      "dispatcher",
      "DISPATCHER",
      "OPS",
      "OPS_MANAGER",
    ];

    for (const role of dispatcherRoles) {
      it(`${role} sees 8 pages`, () => {
        const ids = getVisibleNavIds(role);
        expect(ids).toHaveLength(8);
        expect(ids).not.toContain("company");
      });

      it(`${role} has full access to Operations Center`, () => {
        expect(getNavAccessLevel(role, "operations-hub")).toBe("full");
      });

      it(`${role} has read access to Driver Pay and Accounting`, () => {
        expect(getNavAccessLevel(role, "finance")).toBe("read");
        expect(getNavAccessLevel(role, "accounting")).toBe("read");
      });

      it(`${role} has no access to Company Settings`, () => {
        expect(getNavAccessLevel(role, "company")).toBe("none");
        expect(isNavItemVisible(role, "company")).toBe(false);
      });
    }
  });

  describe("driver sees 4 pages only", () => {
    const driverRoles: UserRole[] = ["driver", "DRIVER_PORTAL"];

    for (const role of driverRoles) {
      it(`${role} sees exactly 4 pages`, () => {
        const ids = getVisibleNavIds(role);
        expect(ids).toHaveLength(4);
      });

      it(`${role} sees Load Board (assigned)`, () => {
        expect(isNavItemVisible(role, "loads")).toBe(true);
        expect(getNavAccessLevel(role, "loads")).toBe("assigned");
      });

      it(`${role} sees Schedule (assigned)`, () => {
        expect(isNavItemVisible(role, "calendar")).toBe(true);
        expect(getNavAccessLevel(role, "calendar")).toBe("assigned");
      });

      it(`${role} sees Driver Pay (submit)`, () => {
        expect(isNavItemVisible(role, "finance")).toBe(true);
        expect(getNavAccessLevel(role, "finance")).toBe("submit");
      });

      it(`${role} sees Issues & Alerts (submit)`, () => {
        expect(isNavItemVisible(role, "exceptions")).toBe(true);
        expect(getNavAccessLevel(role, "exceptions")).toBe("submit");
      });

      it(`${role} does NOT see Operations Center`, () => {
        expect(isNavItemVisible(role, "operations-hub")).toBe(false);
      });

      it(`${role} does NOT see Quotes, Broker Network, Accounting, Company Settings`, () => {
        expect(isNavItemVisible(role, "quotes")).toBe(false);
        expect(isNavItemVisible(role, "network")).toBe(false);
        expect(isNavItemVisible(role, "accounting")).toBe(false);
        expect(isNavItemVisible(role, "company")).toBe(false);
      });
    }
  });

  describe("accounting sees 7 pages (not Broker Network or Company Settings)", () => {
    const accountingRoles: UserRole[] = [
      "payroll_manager",
      "ACCOUNTING_AR",
      "ACCOUNTING_AP",
      "PAYROLL_SETTLEMENTS",
      "FINANCE",
    ];

    for (const role of accountingRoles) {
      it(`${role} sees 7 pages`, () => {
        const ids = getVisibleNavIds(role);
        expect(ids).toHaveLength(7);
      });

      it(`${role} has full access to Driver Pay and Accounting`, () => {
        expect(getNavAccessLevel(role, "finance")).toBe("full");
        expect(getNavAccessLevel(role, "accounting")).toBe("full");
      });

      it(`${role} has read access to operational pages`, () => {
        expect(getNavAccessLevel(role, "operations-hub")).toBe("read");
        expect(getNavAccessLevel(role, "loads")).toBe("read");
        expect(getNavAccessLevel(role, "quotes")).toBe("read");
        expect(getNavAccessLevel(role, "calendar")).toBe("read");
      });

      it(`${role} does NOT see Broker Network or Company Settings`, () => {
        expect(isNavItemVisible(role, "network")).toBe(false);
        expect(isNavItemVisible(role, "company")).toBe(false);
      });
    }
  });

  describe("enterprise admin roles get full access", () => {
    it("ORG_OWNER_SUPER_ADMIN sees all 9 with full access", () => {
      const ids = getVisibleNavIds("ORG_OWNER_SUPER_ADMIN");
      expect(ids).toHaveLength(9);
      for (const id of ALL_NAV_IDS) {
        expect(getNavAccessLevel("ORG_OWNER_SUPER_ADMIN", id)).toBe("full");
      }
    });
  });

  describe("unknown roles default to driver (safest)", () => {
    it("unknown role gets driver visibility", () => {
      const ids = getVisibleNavIds("customer");
      expect(ids).toHaveLength(4);
    });
  });

  describe("isNavItemVisible rejects removed items", () => {
    it("returns false for non-existent nav IDs", () => {
      expect(isNavItemVisible("admin", "dashboard")).toBe(false);
      expect(isNavItemVisible("admin", "map")).toBe(false);
      expect(isNavItemVisible("admin", "safety")).toBe(false);
      expect(isNavItemVisible("admin", "audit")).toBe(false);
    });
  });
});
