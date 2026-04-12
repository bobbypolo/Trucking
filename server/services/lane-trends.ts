/**
 * STORY-011 Phase 11 — Lane trends service.
 *
 * Aggregates loads by lane + calendar month and computes a direction
 * indicator ("up" / "down" / "flat") for each row based on its own
 * lane's previous month average rate.
 *
 * R-P11-01: shape { lane, month, avgRate, volume, trend }
 * R-P11-02: trend rules
 *   > +5% vs previous month -> "up"
 *   < -5% vs previous month -> "down"
 *   within [-5%, +5%]       -> "flat"
 */
import pool from "../db";
import type { RowDataPacket } from "mysql2/promise";

export interface LaneTrendAggregateRow extends RowDataPacket {
  lane: string;
  month: string;
  avg_rate: number | string | null;
  volume: number | string | null;
}

export type LaneTrendDirection = "up" | "down" | "flat";

export interface LaneTrendResult {
  lane: string;
  month: string;
  avgRate: number;
  volume: number;
  trend: LaneTrendDirection;
}

const MIN_MONTHS = 1;
const MAX_MONTHS = 60;
const DEFAULT_MONTHS = 6;
const TREND_THRESHOLD = 0.05; // > 5% move required

/**
 * Validates and returns a months value in the allowed range.
 * Returns null when the raw value is not a positive integer within range.
 */
export function parseMonths(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") {
    return DEFAULT_MONTHS;
  }
  const str = Array.isArray(raw) ? String(raw[0]) : String(raw);
  if (!/^\d+$/.test(str)) {
    return null;
  }
  const n = Number.parseInt(str, 10);
  if (!Number.isFinite(n) || n < MIN_MONTHS || n > MAX_MONTHS) {
    return null;
  }
  return n;
}

/**
 * Classifies the direction of a rate change against its previous month
 * using the R-P11-02 rules. A previous value of zero (or missing) yields
 * "flat" because percentage change is undefined.
 */
export function classifyTrend(
  current: number,
  previous: number | null,
): LaneTrendDirection {
  if (previous === null || previous === 0) {
    return "flat";
  }
  const delta = (current - previous) / previous;
  if (delta > TREND_THRESHOLD) {
    return "up";
  }
  if (delta < -TREND_THRESHOLD) {
    return "down";
  }
  return "flat";
}

/**
 * Aggregation SQL: group loads by a synthetic lane key (pickup state
 * arrow dropoff state) and the pickup month. Pickup / dropoff are stored
 * on load_legs (Pickup / Dropoff rows), so we join them via subqueries.
 *
 * Rows from the database are returned in (lane ASC, month ASC) order so
 * the previous-month lookup in applyTrendDirection is a simple scan.
 */
const LANE_TRENDS_SQL = `
  SELECT
    CONCAT(
      COALESCE(pickup_leg.state, 'UNK'),
      ' -> ',
      COALESCE(dropoff_leg.state, 'UNK')
    ) AS lane,
    DATE_FORMAT(l.pickup_date, '%Y-%m') AS month,
    AVG(l.carrier_rate) AS avg_rate,
    COUNT(*) AS volume
  FROM loads l
  LEFT JOIN (
    SELECT load_id, MIN(state) AS state
    FROM load_legs
    WHERE type = 'Pickup'
    GROUP BY load_id
  ) pickup_leg ON pickup_leg.load_id = l.id
  LEFT JOIN (
    SELECT load_id, MIN(state) AS state
    FROM load_legs
    WHERE type = 'Dropoff'
    GROUP BY load_id
  ) dropoff_leg ON dropoff_leg.load_id = l.id
  WHERE l.company_id = ?
    AND l.pickup_date IS NOT NULL
    AND l.pickup_date >= DATE_SUB(CURRENT_DATE, INTERVAL ? MONTH)
  GROUP BY lane, month
  ORDER BY lane ASC, month ASC
`;

/**
 * Post-processes raw aggregate rows into the public response shape,
 * attaching a per-row trend classification.
 */
export function applyTrendDirection(
  rows: Array<{
    lane: string;
    month: string;
    avg_rate: number | string | null;
    volume: number | string | null;
  }>,
): LaneTrendResult[] {
  const byLanePrev = new Map<string, number>();
  const out: LaneTrendResult[] = [];
  for (const raw of rows) {
    const lane = String(raw.lane);
    const month = String(raw.month);
    const avgRate = Number(raw.avg_rate ?? 0);
    const volume = Number(raw.volume ?? 0);
    const prev = byLanePrev.has(lane) ? byLanePrev.get(lane)! : null;
    const trend = classifyTrend(avgRate, prev);
    out.push({ lane, month, avgRate, volume, trend });
    byLanePrev.set(lane, avgRate);
  }
  return out;
}

/**
 * Loads lane trend data for a company for the trailing `months` window.
 */
export async function getLaneTrends(
  companyId: string,
  months: number,
): Promise<LaneTrendResult[]> {
  const [rows] = await pool.query<LaneTrendAggregateRow[]>(LANE_TRENDS_SQL, [
    companyId,
    months,
  ]);
  return applyTrendDirection(rows);
}
