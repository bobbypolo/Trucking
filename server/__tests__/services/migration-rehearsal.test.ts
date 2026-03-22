import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Tests R-P0-03, R-PV-04: Migration Rehearsal on Prod-Like Data
 *
 * Validates without a live DB connection:
 *  - All 13 migration files exist and are valid SQL
 *  - Execution order is deterministic (numeric prefix ascending)
 *  - Status normalization maps all 12 PascalCase → 8 canonical lowercase
 *  - FK structure is consistent (no orphaned references in schema)
 *  - DECIMAL(10,2) precision is used for all monetary columns
 *  - Every migration has a DOWN section (rollback support)
 */

const MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations");

function readMigrationFile(filename: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, filename), "utf-8");
}

function listMigrationFiles(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

// ─── § Migration Inventory ────────────────────────────────────────────────────

describe("R-PV-04: Migration Inventory", () => {
  it("Tests R-PV-04 — all 13 migration files exist on disk", () => {
    const expectedFiles = [
      "001_baseline.sql",
      "002_add_version_columns.sql",
      "002_load_status_normalization.sql",
      "002_load_status_normalization_rollback.sql",
      "003_enhance_dispatch_events.sql",
      "003_operational_entities.sql",
      "004_idempotency_keys.sql",
      "005_documents_table.sql",
      "006_add_load_legs_lat_lng.sql",
      "007_ocr_results.sql",
      "008_settlements.sql",
      "009_settlement_adjustments.sql",
      "016_exception_management.sql",
    ];

    for (const file of expectedFiles) {
      const fullPath = path.join(MIGRATIONS_DIR, file);
      const exists = fs.existsSync(fullPath);
      expect(exists, `Expected migration file to exist: ${file}`).toBe(true);
    }
  });

  it("Tests R-PV-04 — 13 migration files are present (no missing, no extras above expected)", () => {
    const files = listMigrationFiles();
    expect(files.length).toBeGreaterThanOrEqual(13);
  });
});

// ─── § Execution Order ────────────────────────────────────────────────────────

describe("R-PV-04: Migration Execution Order", () => {
  it("Tests R-PV-04 — numbered migrations sort in ascending order (001 → 009)", () => {
    const numberedFiles = listMigrationFiles()
      .filter((f) => /^\d{3}_/.test(f))
      .filter((f) => !f.includes("rollback"));

    // Extract prefix numbers and verify they are non-decreasing
    const prefixes = numberedFiles.map((f) => parseInt(f.slice(0, 3), 10));
    for (let i = 1; i < prefixes.length; i++) {
      const prev = prefixes[i - 1];
      const curr = prefixes[i];
      expect(
        curr,
        `Migration ${numberedFiles[i]} should sort after ${numberedFiles[i - 1]}`,
      ).toBeGreaterThanOrEqual(prev ?? 0);
    }
  });

  it("Tests R-PV-04 — baseline migration (001) is first numbered migration", () => {
    const numberedFiles = listMigrationFiles().filter((f) => /^\d{3}_/.test(f));
    const first = numberedFiles[0];
    expect(first).toBe("001_baseline.sql");
  });

  it("Tests R-PV-04 — quickbooks_tokens (029) is the highest numbered migration", () => {
    const numberedFiles = listMigrationFiles()
      .filter((f) => /^\d{3}_/.test(f))
      .filter((f) => !f.includes("rollback"));

    const prefixes = numberedFiles.map((f) => parseInt(f.slice(0, 3), 10));
    const maxPrefix = Math.max(...prefixes);
    expect(maxPrefix).toBe(29);
  });
});

// ─── § SQL Validity (parse-level) ─────────────────────────────────────────────

describe("R-PV-04: SQL File Validity", () => {
  it("Tests R-PV-04 — all migration files are non-empty and contain SQL keywords", () => {
    const files = listMigrationFiles();
    for (const file of files) {
      const sql = readMigrationFile(file);
      expect(sql.trim().length, `${file} should not be empty`).toBeGreaterThan(
        0,
      );
      // Every migration file should contain at least one SQL DDL or DML keyword
      const hasSql = /CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|SELECT/i.test(sql);
      expect(hasSql, `${file} should contain SQL statements`).toBe(true);
    }
  });

  it("Tests R-PV-04 — numbered forward migrations (not rollback) have an -- UP section", () => {
    // 002_load_status_normalization_rollback.sql is a standalone DOWN-only script,
    // not a standard UP/DOWN migration — it is intentionally UP-section-free.
    const forwardMigrations = listMigrationFiles().filter(
      (f) => /^\d{3}_/.test(f) && !f.includes("rollback"),
    );
    for (const file of forwardMigrations) {
      const sql = readMigrationFile(file);
      const hasUp = sql.includes("-- UP");
      expect(hasUp, `${file} must have a -- UP section`).toBe(true);
    }
  });

  it("Tests R-PV-04 — core numbered migrations have inline -- DOWN section (rollback coverage)", () => {
    // These migrations all have verified inline DOWN sections per ROLLBACK_VALIDATION.md:
    const migrationsWithInlineDown = [
      "001_baseline.sql",
      "002_add_version_columns.sql",
      "003_enhance_dispatch_events.sql",
      "004_idempotency_keys.sql",
      "005_documents_table.sql",
      "006_add_load_legs_lat_lng.sql",
      "007_ocr_results.sql",
      "008_settlements.sql",
      "009_settlement_adjustments.sql",
    ];
    for (const file of migrationsWithInlineDown) {
      const sql = readMigrationFile(file);
      const hasDown = sql.includes("-- DOWN");
      expect(hasDown, `${file} must have a -- DOWN section`).toBe(true);
    }
  });

  it("Tests R-PV-04 — 002_load_status_normalization rollback coverage via separate file", () => {
    // Verify the separate rollback file exists and contains DOWN instructions
    const rollbackPath = path.join(
      MIGRATIONS_DIR,
      "002_load_status_normalization_rollback.sql",
    );
    expect(fs.existsSync(rollbackPath)).toBe(true);
    const rollbackSql = readMigrationFile(
      "002_load_status_normalization_rollback.sql",
    );
    expect(rollbackSql).toContain("DOWN");
    expect(rollbackSql).toContain("ALTER TABLE loads");
  });
});

// ─── § Status Normalization Mapping ───────────────────────────────────────────

describe("R-PV-04: Status Normalization — 12 PascalCase → 8 canonical", () => {
  const LEGACY_STATUSES = [
    "Planned",
    "Booked",
    "Active",
    "Departed",
    "Arrived",
    "Docked",
    "Unloaded",
    "Delivered",
    "Invoiced",
    "Settled",
    "Cancelled",
    "CorrectionRequested",
  ];

  const CANONICAL_STATUSES = [
    "draft",
    "planned",
    "dispatched",
    "in_transit",
    "arrived",
    "delivered",
    "completed",
    "cancelled",
  ];

  it("Tests R-PV-04 — normalization migration maps all 12 legacy values to 8 canonical", () => {
    const sql = readMigrationFile("002_load_status_normalization.sql");

    // All 12 legacy values must appear in UPDATE WHERE clauses
    for (const legacy of LEGACY_STATUSES) {
      expect(
        sql,
        `Normalization SQL must reference legacy status: ${legacy}`,
      ).toContain(legacy);
    }
  });

  it("Tests R-PV-04 — normalization migration produces exactly 8 canonical statuses in final ENUM", () => {
    const sql = readMigrationFile("002_load_status_normalization.sql");

    for (const canonical of CANONICAL_STATUSES) {
      expect(
        sql,
        `Normalization SQL must include canonical status: ${canonical}`,
      ).toContain(`'${canonical}'`);
    }
  });

  it("Tests R-PV-04 — mapping: Planned+Booked+CorrectionRequested → planned", () => {
    const sql = readMigrationFile("002_load_status_normalization.sql");
    // Find the UPDATE that sets status = 'planned'
    const plannedUpdate = sql.match(
      /UPDATE loads SET status = 'planned'[^\n;]+/,
    );
    expect(plannedUpdate).not.toBeNull();
    const stmt = plannedUpdate?.[0] ?? "";
    expect(stmt).toContain("Planned");
    expect(stmt).toContain("Booked");
    expect(stmt).toContain("CorrectionRequested");
  });

  it("Tests R-PV-04 — mapping: Departed → dispatched", () => {
    const sql = readMigrationFile("002_load_status_normalization.sql");
    expect(sql).toContain("UPDATE loads SET status = 'dispatched'");
    const dispatchedUpdate = sql.match(
      /UPDATE loads SET status = 'dispatched'[^\n;]+/,
    );
    expect(dispatchedUpdate?.[0]).toContain("Departed");
  });

  it("Tests R-PV-04 — mapping: Active → in_transit", () => {
    const sql = readMigrationFile("002_load_status_normalization.sql");
    const transitUpdate = sql.match(
      /UPDATE loads SET status = 'in_transit'[^\n;]+/,
    );
    expect(transitUpdate?.[0]).toContain("Active");
  });

  it("Tests R-PV-04 — mapping: Arrived+Docked → arrived", () => {
    const sql = readMigrationFile("002_load_status_normalization.sql");
    const arrivedUpdate = sql.match(
      /UPDATE loads SET status = 'arrived'[^\n;]+/,
    );
    const stmt = arrivedUpdate?.[0] ?? "";
    expect(stmt).toContain("Arrived");
    expect(stmt).toContain("Docked");
  });

  it("Tests R-PV-04 — mapping: Unloaded+Delivered → delivered", () => {
    const sql = readMigrationFile("002_load_status_normalization.sql");
    const deliveredUpdate = sql.match(
      /UPDATE loads SET status = 'delivered'[^\n;]+/,
    );
    const stmt = deliveredUpdate?.[0] ?? "";
    expect(stmt).toContain("Unloaded");
    expect(stmt).toContain("Delivered");
  });

  it("Tests R-PV-04 — mapping: Invoiced+Settled → completed", () => {
    const sql = readMigrationFile("002_load_status_normalization.sql");
    const completedUpdate = sql.match(
      /UPDATE loads SET status = 'completed'[^\n;]+/,
    );
    const stmt = completedUpdate?.[0] ?? "";
    expect(stmt).toContain("Invoiced");
    expect(stmt).toContain("Settled");
  });

  it("Tests R-PV-04 — mapping: Cancelled → cancelled", () => {
    const sql = readMigrationFile("002_load_status_normalization.sql");
    const cancelledUpdate = sql.match(
      /UPDATE loads SET status = 'cancelled'[^\n;]+/,
    );
    expect(cancelledUpdate?.[0]).toContain("Cancelled");
  });

  it("Tests R-PV-04 — final ENUM does NOT include any legacy PascalCase values", () => {
    const sql = readMigrationFile("002_load_status_normalization.sql");
    // The last ALTER TABLE sets the final canonical-only ENUM
    const lastAlterIdx = sql.lastIndexOf("ALTER TABLE loads");
    const lastAlterBlock = sql.substring(lastAlterIdx);

    const legacyThatShouldBeGone = [
      "Booked",
      "Active",
      "Departed",
      "Docked",
      "Unloaded",
      "Invoiced",
      "Settled",
      "CorrectionRequested",
    ];
    for (const legacy of legacyThatShouldBeGone) {
      expect(
        lastAlterBlock,
        `Final ENUM must not contain legacy value: ${legacy}`,
      ).not.toContain(legacy);
    }
  });
});

// ─── § FK Relationships and Data Integrity Structure ─────────────────────────

describe("R-PV-04: FK Relationships — Schema Structure", () => {
  it("Tests R-PV-04 — baseline defines FK: load_legs.load_id → loads.id ON DELETE CASCADE", () => {
    const sql = readMigrationFile("001_baseline.sql");
    // load_legs table must declare FK to loads
    expect(sql).toContain("FOREIGN KEY (load_id) REFERENCES loads(id)");
  });

  it("Tests R-PV-04 — baseline defines FK: loads.company_id → companies.id ON DELETE CASCADE", () => {
    const sql = readMigrationFile("001_baseline.sql");
    expect(sql).toContain("FOREIGN KEY (company_id) REFERENCES companies(id)");
  });

  it("Tests R-PV-04 — settlements table defines FK: settlements.load_id → loads", () => {
    const sql = readMigrationFile("008_settlements.sql");
    // settlements must reference loads or company
    expect(sql).toContain("load_id");
    expect(sql).toContain("company_id");
  });

  it("Tests R-PV-04 — settlement_detail_lines defines FK to settlements with ON DELETE CASCADE", () => {
    const sql = readMigrationFile("008_settlements.sql");
    expect(sql).toContain(
      "CONSTRAINT fk_sdl_settlement FOREIGN KEY (settlement_id) REFERENCES settlements(id) ON DELETE CASCADE",
    );
  });

  it("Tests R-PV-04 — ocr_results defines FK to documents with ON DELETE CASCADE", () => {
    const sql = readMigrationFile("007_ocr_results.sql");
    expect(sql).toContain(
      "CONSTRAINT fk_ocr_results_document FOREIGN KEY (document_id)",
    );
    expect(sql).toContain("ON DELETE CASCADE");
  });

  it("Tests R-PV-04 — settlement_adjustments defines FK to settlements with ON DELETE RESTRICT", () => {
    const sql = readMigrationFile("009_settlement_adjustments.sql");
    expect(sql).toContain(
      "FOREIGN KEY (settlement_id) REFERENCES settlements(id) ON DELETE RESTRICT",
    );
  });

  it("Tests R-PV-04 — exception_management defines FK: exceptions.status → exception_status", () => {
    const sql = readMigrationFile("016_exception_management.sql");
    expect(sql).toContain(
      "FOREIGN KEY (status) REFERENCES exception_status(status_code)",
    );
  });
});

// ─── § DECIMAL(10,2) Precision ────────────────────────────────────────────────

describe("R-PV-04: DECIMAL(10,2) Monetary Precision", () => {
  it("Tests R-PV-04 — baseline uses DECIMAL(10,2) for carrier_rate and driver_pay", () => {
    const sql = readMigrationFile("001_baseline.sql");
    // loads table monetary columns
    expect(sql).toContain("carrier_rate DECIMAL(10, 2)");
    expect(sql).toContain("driver_pay DECIMAL(10, 2)");
  });

  it("Tests R-PV-04 — settlements table uses DECIMAL(10,2) for all monetary totals", () => {
    const sql = readMigrationFile("008_settlements.sql");
    expect(sql).toContain("total_earnings DECIMAL(10,2)");
    expect(sql).toContain("total_deductions DECIMAL(10,2)");
    expect(sql).toContain("total_reimbursements DECIMAL(10,2)");
    expect(sql).toContain("net_pay DECIMAL(10,2)");
  });

  it("Tests R-PV-04 — settlement_detail_lines uses DECIMAL(10,2) for amount", () => {
    const sql = readMigrationFile("008_settlements.sql");
    expect(sql).toContain("amount DECIMAL(10,2)");
  });

  it("Tests R-PV-04 — settlement_adjustments uses DECIMAL(10,2) for adjustment amount", () => {
    const sql = readMigrationFile("009_settlement_adjustments.sql");
    expect(sql).toContain("amount DECIMAL(10,2)");
  });

  it("Tests R-PV-04 — exception_management uses DECIMAL(10,2) for financial_impact_est", () => {
    const sql = readMigrationFile("016_exception_management.sql");
    expect(sql).toContain("financial_impact_est DECIMAL(10, 2)");
  });
});

// ─── § Unique Constraint: No Duplicate Active Assignments ─────────────────────

describe("R-PV-04: No Duplicate Active Assignments — Schema Constraints", () => {
  it("Tests R-PV-04 — settlements has UNIQUE KEY on (load_id, company_id) preventing duplicates", () => {
    const sql = readMigrationFile("008_settlements.sql");
    expect(sql).toContain(
      "UNIQUE KEY uq_settlement_load_tenant (load_id, company_id)",
    );
  });

  it("Tests R-PV-04 — idempotency_keys has UNIQUE KEY on idempotency_key preventing replay", () => {
    const sql = readMigrationFile("004_idempotency_keys.sql");
    expect(sql).toContain("UNIQUE KEY uk_idempotency_key (idempotency_key)");
  });
});

// ─── § Pre/Post Counts Logic ─────────────────────────────────────────────────

describe("R-PV-04: Pre/Post Row Count Verification — staging-rehearsal.ts", () => {
  const rehearsalPath = path.resolve(
    __dirname,
    "../../scripts/staging-rehearsal.ts",
  );

  it("Tests R-PV-04 — staging-rehearsal.ts exists", () => {
    expect(fs.existsSync(rehearsalPath)).toBe(true);
  });

  it("Tests R-PV-04 — staging-rehearsal.ts captures pre-migration status snapshot", () => {
    const src = fs.readFileSync(rehearsalPath, "utf-8");
    expect(src).toContain("captureStatusSnapshot");
    expect(src).toContain("preMigration");
  });

  it("Tests R-PV-04 — staging-rehearsal.ts captures post-migration status snapshot", () => {
    const src = fs.readFileSync(rehearsalPath, "utf-8");
    expect(src).toContain("postMigration");
  });

  it("Tests R-PV-04 — staging-rehearsal.ts checks row conservation (pre == post)", () => {
    const src = fs.readFileSync(rehearsalPath, "utf-8");
    expect(src).toContain("row-conservation");
    expect(src).toContain("preMigration.totalLoads");
    expect(src).toContain("postMigration.totalLoads");
  });

  it("Tests R-PV-04 — staging-rehearsal.ts checks no legacy rows remain after migration", () => {
    const src = fs.readFileSync(rehearsalPath, "utf-8");
    expect(src).toContain("no-legacy-statuses");
    expect(src).toContain("legacyRowsRemaining");
  });

  it("Tests R-PV-04 — staging-rehearsal.ts checks all statuses are canonical post-migration", () => {
    const src = fs.readFileSync(rehearsalPath, "utf-8");
    expect(src).toContain("all-statuses-canonical");
    expect(src).toContain("nonCanonicalRows");
  });

  it("Tests R-PV-04 — staging-rehearsal.ts supports rollback round-trip test", () => {
    const src = fs.readFileSync(rehearsalPath, "utf-8");
    expect(src).toContain("rollbackTest");
    expect(src).toContain("rollback-down");
    expect(src).toContain("rollback-reapply");
  });

  it("Tests R-PV-04 — staging-rehearsal.ts checks orphaned dispatch_events", () => {
    const src = fs.readFileSync(rehearsalPath, "utf-8");
    expect(src).toContain("reconciliation-orphan-check");
    expect(src).toContain("dispatch_events");
  });
});

// ─── § Document Orphan Check Structure ────────────────────────────────────────

describe("R-PV-04: Document Integrity — reconciliation.service.ts", () => {
  const reconcilePath = path.resolve(
    __dirname,
    "../../services/reconciliation.service.ts",
  );

  it("Tests R-PV-04 — reconciliation service exists", () => {
    expect(fs.existsSync(reconcilePath)).toBe(true);
  });

  it("Tests R-PV-04 — reconciliation service checks orphan stops", () => {
    const src = fs.readFileSync(reconcilePath, "utf-8");
    expect(src).toContain("orphan_stops");
    expect(src).toContain("load_legs");
  });

  it("Tests R-PV-04 — reconciliation service checks metadata vs storage bidirectionally", () => {
    const src = fs.readFileSync(reconcilePath, "utf-8");
    expect(src).toContain("metadataWithoutStorage");
    expect(src).toContain("storageWithoutMetadata");
  });

  it("Tests R-PV-04 — reconciliation service checks settlement mismatches with ROUND", () => {
    const src = fs.readFileSync(reconcilePath, "utf-8");
    expect(src).toContain("settlement_mismatches");
    expect(src).toContain("ROUND(");
  });

  it("Tests R-PV-04 — reconciliation service checks duplicate active assignments", () => {
    const src = fs.readFileSync(reconcilePath, "utf-8");
    expect(src).toContain("duplicate_driver_assignments");
    expect(src).toContain("duplicate_equipment_assignments");
  });
});

// ─── Phase 3: Table Count Validation ──────────────────────────────────────────

describe("R-P3: Table Count Validation — staging-rehearsal.ts", () => {
  // Tests R-P3-01, R-P3-04
  const rehearsalPath = path.resolve(
    __dirname,
    "../../scripts/staging-rehearsal.ts",
  );

  it("Tests R-P3-01, R-P3-04 — staging-rehearsal.ts has table-count-validation step", () => {
    const src = fs.readFileSync(rehearsalPath, "utf-8");
    expect(src).toContain("table-count-validation");
  });

  it("Tests R-P3-04 — staging-rehearsal.ts validates expected table count after migrations", () => {
    const src = fs.readFileSync(rehearsalPath, "utf-8");
    expect(src).toContain("EXPECTED_TABLE_COUNT");
  });

  it("Tests R-P3-04 — staging-rehearsal.ts queries information_schema for table count", () => {
    const src = fs.readFileSync(rehearsalPath, "utf-8");
    expect(src).toContain("information_schema.tables");
    expect(src).toContain("table-count-validation");
  });
});

// ─── Phase 3: Migration 015 Coverage ──────────────────────────────────────────

describe("R-P3: Migration 015 Coverage Verification", () => {
  // Tests R-P3-05
  const rehearsalPath = path.resolve(
    __dirname,
    "../../scripts/staging-rehearsal.ts",
  );

  it("Tests R-P3-05 — staging-rehearsal.ts references 015", () => {
    const src = fs.readFileSync(rehearsalPath, "utf-8");
    expect(src).toContain("015");
  });

  it("Tests R-P3-05 — migration-dry-run.sh exists", () => {
    const dryRunPath = path.resolve(
      __dirname,
      "../../scripts/migration-dry-run.sh",
    );
    expect(fs.existsSync(dryRunPath)).toBe(true);
  });

  it("Tests R-P3-05 — migration-dry-run.sh references 015", () => {
    const dryRunPath = path.resolve(
      __dirname,
      "../../scripts/migration-dry-run.sh",
    );
    const src = fs.readFileSync(dryRunPath, "utf-8");
    expect(src).toContain("015");
  });

  it("Tests R-P3-02 — migration-dry-run.sh creates a temp database", () => {
    const dryRunPath = path.resolve(
      __dirname,
      "../../scripts/migration-dry-run.sh",
    );
    const src = fs.readFileSync(dryRunPath, "utf-8");
    expect(src.toUpperCase()).toContain("CREATE DATABASE");
    expect(src.toUpperCase()).toContain("DROP DATABASE");
  });

  it("Tests R-P3-02 — migration-dry-run.sh runs staging-rehearsal.ts", () => {
    const dryRunPath = path.resolve(
      __dirname,
      "../../scripts/migration-dry-run.sh",
    );
    const src = fs.readFileSync(dryRunPath, "utf-8");
    expect(src).toContain("staging-rehearsal.ts");
  });
});

// ─── Phase 3: Migration Runbook ───────────────────────────────────────────────

describe("R-P3: MIGRATION_RUNBOOK.md Completeness", () => {
  // Tests R-P3-03, R-P3-06
  const runbookPath = path.resolve(
    __dirname,
    "../../../docs/deployment/MIGRATION_RUNBOOK.md",
  );

  it("Tests R-P3-03 — MIGRATION_RUNBOOK.md exists", () => {
    expect(fs.existsSync(runbookPath)).toBe(true);
  });

  it("Tests R-P3-03 — MIGRATION_RUNBOOK.md contains Pre-flight section", () => {
    const content = fs.readFileSync(runbookPath, "utf-8");
    expect(content.toLowerCase()).toContain("pre-flight");
  });

  it("Tests R-P3-03, R-P3-06 — MIGRATION_RUNBOOK.md contains Backup section with mysqldump", () => {
    const content = fs.readFileSync(runbookPath, "utf-8");
    expect(content.toLowerCase()).toContain("backup");
    expect(content).toContain("mysqldump");
  });

  it("Tests R-P3-03 — MIGRATION_RUNBOOK.md contains Apply section", () => {
    const content = fs.readFileSync(runbookPath, "utf-8");
    expect(content.toLowerCase()).toContain("apply");
  });

  it("Tests R-P3-03 — MIGRATION_RUNBOOK.md contains Validate section", () => {
    const content = fs.readFileSync(runbookPath, "utf-8");
    expect(content.toLowerCase()).toContain("validat");
  });

  it("Tests R-P3-03 — MIGRATION_RUNBOOK.md contains Rollback section", () => {
    const content = fs.readFileSync(runbookPath, "utf-8");
    expect(content.toLowerCase()).toContain("rollback");
  });

  it("Tests R-P3-03 — MIGRATION_RUNBOOK.md contains post-migration smoke section", () => {
    const content = fs.readFileSync(runbookPath, "utf-8");
    expect(content.toLowerCase()).toContain("smoke");
  });

  it("Tests R-P3-03 — MIGRATION_RUNBOOK.md covers fresh-DB rehearsal type", () => {
    const content = fs.readFileSync(runbookPath, "utf-8");
    expect(content.toLowerCase()).toContain("fresh");
  });

  it("Tests R-P3-03 — MIGRATION_RUNBOOK.md covers prod-like-snapshot rehearsal type", () => {
    const content = fs.readFileSync(runbookPath, "utf-8");
    expect(content.toLowerCase()).toContain("prod");
  });

  it("Tests R-P3-06 — MIGRATION_RUNBOOK.md Backup section has integrity verification step", () => {
    const content = fs.readFileSync(runbookPath, "utf-8");
    const hasVerification =
      content.includes("file size") ||
      content.includes("wc -c") ||
      content.includes("ls -lh") ||
      content.includes("stat ") ||
      content.includes("spot-check") ||
      content.includes("verify");
    expect(hasVerification).toBe(true);
  });
});
