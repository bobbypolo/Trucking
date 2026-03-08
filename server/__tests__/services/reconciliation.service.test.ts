import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P4-03-AC1

import {
  runReconciliation,
  type ReconciliationReport,
} from "../../services/reconciliation.service";

// --- Mock pool ---
const mockQuery = vi.fn();

vi.mock("../../db", () => ({
  default: {
    query: (...args: unknown[]) => mockQuery(...args),
  },
}));

// --- Mock Firebase Storage adapter ---
const mockListObjects = vi.fn();

const TENANT = "company-aaa";

describe("R-P4-03: Reconciliation Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Clean data produces clean report", () => {
    it("returns a clean report when all data is consistent", async () => {
      // All loads have stops
      mockQuery.mockImplementation((sql: string) => {
        if (sql.includes("orphan_stops")) {
          return [[]]; // no orphan stops
        }
        if (sql.includes("missing_event_trails")) {
          return [[]]; // all loads have event trails
        }
        if (sql.includes("settlement_mismatches")) {
          return [[]]; // no mismatches
        }
        if (sql.includes("duplicate_driver_assignments")) {
          return [[]]; // no duplicates
        }
        if (sql.includes("duplicate_equipment_assignments")) {
          return [[]]; // no duplicates
        }
        if (sql.includes("orphan_metadata")) {
          return [[]]; // no orphan metadata
        }
        return [[]];
      });

      mockListObjects.mockResolvedValue([]);

      const report = await runReconciliation(TENANT, {
        listObjects: mockListObjects,
      });

      expect(report.companyId).toBe(TENANT);
      expect(report.orphanStops).toEqual([]);
      expect(report.missingEventTrails).toEqual([]);
      expect(report.settlementMismatches).toEqual([]);
      expect(report.duplicateAssignments).toEqual([]);
      expect(report.metadataWithoutStorage).toEqual([]);
      expect(report.storageWithoutMetadata).toEqual([]);
      expect(report.isClean).toBe(true);
    });
  });

  describe("Orphan stops detection", () => {
    it("detects stops not linked to any load", async () => {
      mockQuery.mockImplementation((sql: string) => {
        if (sql.includes("orphan_stops")) {
          return [
            [
              { stop_id: "stop-001", load_id: "load-deleted" },
              { stop_id: "stop-002", load_id: "load-missing" },
            ],
          ];
        }
        if (sql.includes("missing_event_trails")) return [[]];
        if (sql.includes("settlement_mismatches")) return [[]];
        if (sql.includes("duplicate_driver_assignments")) return [[]];
        if (sql.includes("duplicate_equipment_assignments")) return [[]];
        if (sql.includes("orphan_metadata")) return [[]];
        return [[]];
      });
      mockListObjects.mockResolvedValue([]);

      const report = await runReconciliation(TENANT, {
        listObjects: mockListObjects,
      });

      expect(report.orphanStops).toHaveLength(2);
      expect(report.orphanStops[0].stop_id).toBe("stop-001");
      expect(report.isClean).toBe(false);
    });
  });

  describe("Missing event trails detection", () => {
    it("detects loads with status changes but no dispatch_events", async () => {
      mockQuery.mockImplementation((sql: string) => {
        if (sql.includes("orphan_stops")) return [[]];
        if (sql.includes("missing_event_trails")) {
          return [
            [
              {
                load_id: "load-001",
                load_number: "LN-001",
                status: "in_transit",
              },
            ],
          ];
        }
        if (sql.includes("settlement_mismatches")) return [[]];
        if (sql.includes("duplicate_driver_assignments")) return [[]];
        if (sql.includes("duplicate_equipment_assignments")) return [[]];
        if (sql.includes("orphan_metadata")) return [[]];
        return [[]];
      });
      mockListObjects.mockResolvedValue([]);

      const report = await runReconciliation(TENANT, {
        listObjects: mockListObjects,
      });

      expect(report.missingEventTrails).toHaveLength(1);
      expect(report.missingEventTrails[0].load_id).toBe("load-001");
      expect(report.isClean).toBe(false);
    });
  });

  describe("Settlement mismatches detection", () => {
    it("detects settlement totals that do not match recalculated line items", async () => {
      mockQuery.mockImplementation((sql: string) => {
        if (sql.includes("orphan_stops")) return [[]];
        if (sql.includes("missing_event_trails")) return [[]];
        if (sql.includes("settlement_mismatches")) {
          return [
            [
              {
                settlement_id: "sett-001",
                load_id: "load-001",
                stored_total_earnings: "1500.00",
                recalc_total_earnings: "1600.00",
                stored_net_pay: "1400.00",
                recalc_net_pay: "1500.00",
              },
            ],
          ];
        }
        if (sql.includes("duplicate_driver_assignments")) return [[]];
        if (sql.includes("duplicate_equipment_assignments")) return [[]];
        if (sql.includes("orphan_metadata")) return [[]];
        return [[]];
      });
      mockListObjects.mockResolvedValue([]);

      const report = await runReconciliation(TENANT, {
        listObjects: mockListObjects,
      });

      expect(report.settlementMismatches).toHaveLength(1);
      expect(report.settlementMismatches[0].settlement_id).toBe("sett-001");
      expect(report.isClean).toBe(false);
    });
  });

  describe("Duplicate assignments detection", () => {
    it("detects drivers assigned to multiple active loads", async () => {
      mockQuery.mockImplementation((sql: string) => {
        if (sql.includes("orphan_stops")) return [[]];
        if (sql.includes("missing_event_trails")) return [[]];
        if (sql.includes("settlement_mismatches")) return [[]];
        if (sql.includes("duplicate_driver_assignments")) {
          return [
            [
              {
                entity_type: "driver",
                entity_id: "driver-001",
                load_count: 2,
                load_ids: "load-001,load-002",
              },
            ],
          ];
        }
        if (sql.includes("duplicate_equipment_assignments")) return [[]];
        if (sql.includes("orphan_metadata")) return [[]];
        return [[]];
      });
      mockListObjects.mockResolvedValue([]);

      const report = await runReconciliation(TENANT, {
        listObjects: mockListObjects,
      });

      expect(report.duplicateAssignments).toHaveLength(1);
      expect(report.duplicateAssignments[0].entity_type).toBe("driver");
      expect(report.duplicateAssignments[0].entity_id).toBe("driver-001");
      expect(report.isClean).toBe(false);
    });

    it("detects equipment assigned to multiple active loads", async () => {
      mockQuery.mockImplementation((sql: string) => {
        if (sql.includes("orphan_stops")) return [[]];
        if (sql.includes("missing_event_trails")) return [[]];
        if (sql.includes("settlement_mismatches")) return [[]];
        if (sql.includes("duplicate_driver_assignments")) return [[]];
        if (sql.includes("duplicate_equipment_assignments")) {
          return [
            [
              {
                entity_type: "equipment",
                entity_id: "equip-001",
                load_count: 3,
                load_ids: "load-001,load-002,load-003",
              },
            ],
          ];
        }
        if (sql.includes("orphan_metadata")) return [[]];
        return [[]];
      });
      mockListObjects.mockResolvedValue([]);

      const report = await runReconciliation(TENANT, {
        listObjects: mockListObjects,
      });

      expect(report.duplicateAssignments).toHaveLength(1);
      expect(report.duplicateAssignments[0].entity_type).toBe("equipment");
      expect(report.isClean).toBe(false);
    });
  });

  describe("Document metadata without storage object", () => {
    it("detects documents with DB rows but no Firebase Storage object", async () => {
      mockQuery.mockImplementation((sql: string) => {
        if (sql.includes("orphan_stops")) return [[]];
        if (sql.includes("missing_event_trails")) return [[]];
        if (sql.includes("settlement_mismatches")) return [[]];
        if (sql.includes("duplicate_driver_assignments")) return [[]];
        if (sql.includes("duplicate_equipment_assignments")) return [[]];
        if (sql.includes("orphan_metadata")) {
          return [
            [
              {
                doc_id: "doc-001",
                storage_path: "tenants/company-aaa/documents/doc-001/file.pdf",
              },
              {
                doc_id: "doc-002",
                storage_path: "tenants/company-aaa/documents/doc-002/file.png",
              },
            ],
          ];
        }
        return [[]];
      });

      // Storage only has doc-001, not doc-002
      mockListObjects.mockResolvedValue([
        "tenants/company-aaa/documents/doc-001/file.pdf",
      ]);

      const report = await runReconciliation(TENANT, {
        listObjects: mockListObjects,
      });

      expect(report.metadataWithoutStorage).toHaveLength(1);
      expect(report.metadataWithoutStorage[0].doc_id).toBe("doc-002");
      expect(report.isClean).toBe(false);
    });
  });

  describe("Storage objects without metadata row", () => {
    it("detects Firebase Storage objects with no document DB row", async () => {
      mockQuery.mockImplementation((sql: string) => {
        if (sql.includes("orphan_stops")) return [[]];
        if (sql.includes("missing_event_trails")) return [[]];
        if (sql.includes("settlement_mismatches")) return [[]];
        if (sql.includes("duplicate_driver_assignments")) return [[]];
        if (sql.includes("duplicate_equipment_assignments")) return [[]];
        if (sql.includes("orphan_metadata")) {
          return [
            [
              {
                doc_id: "doc-001",
                storage_path: "tenants/company-aaa/documents/doc-001/file.pdf",
              },
            ],
          ];
        }
        return [[]];
      });

      // Storage has doc-001 AND an extra orphan blob
      mockListObjects.mockResolvedValue([
        "tenants/company-aaa/documents/doc-001/file.pdf",
        "tenants/company-aaa/documents/doc-orphan/invoice.pdf",
      ]);

      const report = await runReconciliation(TENANT, {
        listObjects: mockListObjects,
      });

      expect(report.storageWithoutMetadata).toHaveLength(1);
      expect(report.storageWithoutMetadata[0].storage_path).toBe(
        "tenants/company-aaa/documents/doc-orphan/invoice.pdf",
      );
      expect(report.isClean).toBe(false);
    });
  });

  describe("Report structure", () => {
    it("report contains all required fields", async () => {
      mockQuery.mockResolvedValue([[]]);
      mockListObjects.mockResolvedValue([]);

      const report = await runReconciliation(TENANT, {
        listObjects: mockListObjects,
      });

      expect(report).toHaveProperty("companyId");
      expect(report).toHaveProperty("generatedAt");
      expect(report).toHaveProperty("orphanStops");
      expect(report).toHaveProperty("missingEventTrails");
      expect(report).toHaveProperty("settlementMismatches");
      expect(report).toHaveProperty("duplicateAssignments");
      expect(report).toHaveProperty("metadataWithoutStorage");
      expect(report).toHaveProperty("storageWithoutMetadata");
      expect(report).toHaveProperty("isClean");
      expect(typeof report.generatedAt).toBe("string");
    });

    it("isClean is true only when ALL checks pass", async () => {
      // Only orphan stops present
      mockQuery.mockImplementation((sql: string) => {
        if (sql.includes("orphan_stops")) {
          return [[{ stop_id: "s1", load_id: "l1" }]];
        }
        return [[]];
      });
      mockListObjects.mockResolvedValue([]);

      const report = await runReconciliation(TENANT, {
        listObjects: mockListObjects,
      });
      expect(report.isClean).toBe(false);
    });
  });

  describe("Multiple anomalies combined", () => {
    it("captures all categories of anomalies in a single report", async () => {
      mockQuery.mockImplementation((sql: string) => {
        if (sql.includes("orphan_stops")) {
          return [[{ stop_id: "s1", load_id: "l-gone" }]];
        }
        if (sql.includes("missing_event_trails")) {
          return [
            [{ load_id: "l2", load_number: "LN-002", status: "in_transit" }],
          ];
        }
        if (sql.includes("settlement_mismatches")) {
          return [
            [
              {
                settlement_id: "sett-1",
                load_id: "l3",
                stored_total_earnings: "100.00",
                recalc_total_earnings: "200.00",
                stored_net_pay: "90.00",
                recalc_net_pay: "190.00",
              },
            ],
          ];
        }
        if (sql.includes("duplicate_driver_assignments")) {
          return [
            [
              {
                entity_type: "driver",
                entity_id: "d1",
                load_count: 2,
                load_ids: "l4,l5",
              },
            ],
          ];
        }
        if (sql.includes("duplicate_equipment_assignments")) {
          return [
            [
              {
                entity_type: "equipment",
                entity_id: "e1",
                load_count: 2,
                load_ids: "l6,l7",
              },
            ],
          ];
        }
        if (sql.includes("orphan_metadata")) {
          return [
            [
              {
                doc_id: "doc-1",
                storage_path: "tenants/company-aaa/documents/doc-1/f.pdf",
              },
            ],
          ];
        }
        return [[]];
      });

      // Storage has different file (doc-1 exists in both, but add orphan storage)
      mockListObjects.mockResolvedValue([
        "tenants/company-aaa/documents/doc-1/f.pdf",
        "tenants/company-aaa/documents/doc-ghost/g.pdf",
      ]);

      const report = await runReconciliation(TENANT, {
        listObjects: mockListObjects,
      });

      expect(report.orphanStops).toHaveLength(1);
      expect(report.missingEventTrails).toHaveLength(1);
      expect(report.settlementMismatches).toHaveLength(1);
      expect(report.duplicateAssignments).toHaveLength(2); // driver + equipment
      expect(report.metadataWithoutStorage).toHaveLength(0); // doc-1 IS in storage
      expect(report.storageWithoutMetadata).toHaveLength(1); // doc-ghost not in DB
      expect(report.isClean).toBe(false);
    });
  });
});
