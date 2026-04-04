-- Migration: 048_ifta_gps_bridge
-- Description: Add indexes to support GPS-to-IFTA evidence bridge queries.
-- Depends on: 013_ifta_intelligence, 030_gps_positions, 038_accounting_tenant_to_company_id

-- UP

-- Composite index for bridge dedup / lookup by truck+time
CREATE INDEX IF NOT EXISTS idx_ifta_evidence_truck_ts
  ON ifta_trip_evidence (company_id, truck_id, timestamp);

-- Index for driver lookup in GPS positions (used by findActiveLoadForVehicle)
CREATE INDEX IF NOT EXISTS idx_gps_positions_driver
  ON gps_positions (company_id, driver_id, recorded_at DESC);

-- DOWN

DROP INDEX idx_ifta_evidence_truck_ts ON ifta_trip_evidence;
DROP INDEX idx_gps_positions_driver ON gps_positions;
