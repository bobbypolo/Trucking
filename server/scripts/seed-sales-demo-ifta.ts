/**
 * Sales Demo IFTA Seed Helper — Phase 3, Bulletproof Sales Demo.
 *
 * Seeds Q4 2025 trip-based IFTA evidence for the hero load
 * LP-DEMO-RC-001 so the live GET /api/accounting/ifta-summary can
 * analyze and audit-lock the trip on stage. Trip-based design — the
 * lock-time handler writes truckId from load.driver_id at audit time.
 *
 * Writes into 3 tables using only INSERT IGNORE:
 *   - ifta_trip_evidence: 12 rows (6 jurisdictions x 2 trips)
 *   - fuel_ledger: 8 rows distributed across the same 6 jurisdictions
 *   - mileage_jurisdiction: 6 rows (one per jurisdiction, Q4 2025 totals)
 *
 * ALL 12 ifta_trip_evidence rows carry load_id = 'LP-DEMO-RC-001' — the
 * trip-based continuity anchor for the R-P3-02 contract.
 */

import * as path from "path";
import * as fs from "fs";

// Minimal connection-like interface (same shape as seed-sales-demo.ts
// SqlExecutor — intentionally re-declared here to keep this helper
// orthogonal and independently testable).
export interface IftaSqlExecutor {
  execute(sql: string, params?: unknown[]): Promise<unknown>;
}

export interface SeedSalesDemoIftaResult {
  evidenceRows: number;
  fuelRows: number;
  mileageRows: number;
}

export const SALES_DEMO_COMPANY_ID = "SALES-DEMO-001";
export const SALES_DEMO_HERO_LOAD_ID = "LP-DEMO-RC-001";
export const SALES_DEMO_HERO_DRIVER_ID = "SALES-DEMO-DRIVER-001";

// ─── Fixture types ────────────────────────────────────────────────────────────

interface IftaEvidenceFixtureRow {
  id: string;
  trip: string;
  timestamp: string;
  lat: number;
  lng: number;
  state_code: string;
  odometer: number;
  speed_mph: number;
}

interface FuelLedgerFixtureRow {
  id: string;
  state_code: string;
  gallons: number;
  total_cost: number;
  price_per_gallon: number;
  vendor_name: string;
  entry_date: string;
}

interface MileageJurisdictionFixtureRow {
  id: string;
  state_code: string;
  miles: number;
  entry_date: string;
  date: string;
}

interface IftaQ4Fixture {
  _meta: Record<string, unknown>;
  ifta_trip_evidence: IftaEvidenceFixtureRow[];
  fuel_ledger: FuelLedgerFixtureRow[];
  mileage_jurisdiction: MileageJurisdictionFixtureRow[];
}

// ─── Fixture loader ───────────────────────────────────────────────────────────

export function loadIftaQ4Fixture(): IftaQ4Fixture {
  const fixturePath = path.resolve(
    __dirname,
    "sales-demo-fixtures",
    "ifta-q4-2025.json",
  );
  const raw = fs.readFileSync(fixturePath, "utf-8");
  const parsed = JSON.parse(raw) as IftaQ4Fixture;
  return parsed;
}

// ─── Seed helper ──────────────────────────────────────────────────────────────

/**
 * Phase 3 seed — inserts exactly 12 ifta_trip_evidence rows, 8 fuel_ledger
 * rows, and 6 mileage_jurisdiction rows into the sales-demo tenant using
 * only INSERT IGNORE. All ifta_trip_evidence rows are tied to the hero
 * load LP-DEMO-RC-001 and the sales-demo driver. truck_id is left NULL
 * (trip-based design — the lock-time handler populates it from
 * load.driver_id at audit time).
 *
 * Idempotent: a second invocation re-runs the same INSERT IGNOREs, which
 * the DB treats as no-ops because every row has a deterministic primary
 * key.
 */
export async function seedSalesDemoIfta(
  conn: IftaSqlExecutor,
): Promise<SeedSalesDemoIftaResult> {
  const fixture = loadIftaQ4Fixture();
  const companyId = SALES_DEMO_COMPANY_ID;
  const loadId = SALES_DEMO_HERO_LOAD_ID;
  const driverId = SALES_DEMO_HERO_DRIVER_ID;

  // Step 1: ifta_trip_evidence — 12 rows. EVERY row carries load_id =
  // LP-DEMO-RC-001 (R-P3-02 contract). truck_id is intentionally not in
  // the INSERT column list — this is trip-based, not fleet-based. The
  // audit-lock handler reads the fleet id from load.driver_id at lock
  // time.
  for (const row of fixture.ifta_trip_evidence) {
    await conn.execute(
      `INSERT IGNORE INTO ifta_trip_evidence
         (id, company_id, load_id, driver_id, timestamp, lat, lng,
          odometer, state_code, speed_mph, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        companyId,
        loadId,
        driverId,
        row.timestamp,
        row.lat,
        row.lng,
        row.odometer,
        row.state_code,
        row.speed_mph,
        "GPS",
      ],
    );
  }

  // Step 2: fuel_ledger — 8 rows scoped to the sales-demo tenant and
  // linked to the hero load (load_id column is optional but we populate
  // it to preserve the demo narrative continuity). entry_date is the
  // verified column name (migration 011 line 114).
  for (const row of fixture.fuel_ledger) {
    await conn.execute(
      `INSERT IGNORE INTO fuel_ledger
         (id, company_id, load_id, state_code, gallons, total_cost,
          price_per_gallon, vendor_name, entry_date, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        companyId,
        loadId,
        row.state_code,
        row.gallons,
        row.total_cost,
        row.price_per_gallon,
        row.vendor_name,
        row.entry_date,
        "Receipt",
      ],
    );
  }

  // Step 3: mileage_jurisdiction — 6 rows (one per state) summing to
  // >= 20,000 miles for the Q4 2025 quarter totals. The live
  // GET /api/accounting/ifta-summary query is
  // `SELECT state_code, SUM(miles) FROM mileage_jurisdiction GROUP BY
  // state_code`, so a single Q4 row per state is sufficient to produce
  // rows.length === 6 in the live response.
  for (const row of fixture.mileage_jurisdiction) {
    await conn.execute(
      `INSERT IGNORE INTO mileage_jurisdiction
         (id, company_id, load_id, state_code, miles, date, entry_date, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        companyId,
        loadId,
        row.state_code,
        row.miles,
        row.date,
        row.entry_date,
        "GPS",
      ],
    );
  }

  return {
    evidenceRows: fixture.ifta_trip_evidence.length,
    fuelRows: fixture.fuel_ledger.length,
    mileageRows: fixture.mileage_jurisdiction.length,
  };
}
