-- Migration: 001_data_pipeline.sql
-- Adds passive data pipeline support:
--   - Geofence arrival/load timestamps on load_legs
--   - Quoted vs scanned weight discrepancy tracking on loads
--   - Broker intelligence scoring on customers
--   - Immutable load_events event log

USE trucklogix;

-- ─────────────────────────────────────────────
-- 1. load_legs: facility coordinates + timestamps
-- ─────────────────────────────────────────────
ALTER TABLE load_legs
  ADD COLUMN facility_lat      DECIMAL(10, 8) NULL        COMMENT 'Facility latitude for geofence center',
  ADD COLUMN facility_lng      DECIMAL(11, 8) NULL        COMMENT 'Facility longitude for geofence center',
  ADD COLUMN arrived_at        TIMESTAMP      NULL        COMMENT 'Auto-set when driver enters 0.5mi geofence',
  ADD COLUMN loaded_at         TIMESTAMP      NULL        COMMENT 'Auto-set when driver scans BOL',
  ADD COLUMN departed_at       TIMESTAMP      NULL        COMMENT 'Auto-set when driver exits geofence after loading',
  ADD COLUMN detention_minutes INT            NULL        COMMENT 'Calculated: TIMESTAMPDIFF(MINUTE, arrived_at, loaded_at)';

-- ─────────────────────────────────────────────
-- 2. loads: quoted vs scanned weight/commodity
-- ─────────────────────────────────────────────
ALTER TABLE loads
  ADD COLUMN quoted_weight           DECIMAL(10, 2) NULL          COMMENT 'Weight stated by broker at dispatch time',
  ADD COLUMN scanned_weight          DECIMAL(10, 2) NULL          COMMENT 'Weight extracted from scanned BOL by Gemini',
  ADD COLUMN weight_discrepancy_pct  DECIMAL(5, 2)  NULL          COMMENT '(scanned - quoted) / quoted * 100',
  ADD COLUMN quoted_commodity        VARCHAR(255)   NULL          COMMENT 'Commodity stated by broker at dispatch time',
  ADD COLUMN scanned_commodity       VARCHAR(255)   NULL          COMMENT 'Commodity extracted from scanned BOL',
  ADD COLUMN discrepancy_flagged     BOOLEAN        DEFAULT FALSE COMMENT 'TRUE if weight variance exceeds 5%';

-- ─────────────────────────────────────────────
-- 3. customers: broker intelligence columns
-- ─────────────────────────────────────────────
ALTER TABLE customers
  ADD COLUMN discrepancy_score      INT          DEFAULT 0    COMMENT 'Count of loads where broker weight was off >5%',
  ADD COLUMN total_loads_completed  INT          DEFAULT 0    COMMENT 'Total settled loads with this broker',
  ADD COLUMN avg_payment_days       DECIMAL(5,1) DEFAULT 0    COMMENT 'Average days from invoice to payment received',
  ADD COLUMN last_discrepancy_at    TIMESTAMP    NULL         COMMENT 'Timestamp of most recent flagged discrepancy';

-- ─────────────────────────────────────────────
-- 4. load_events: immutable pipeline event log
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS load_events (
  id           VARCHAR(36)  PRIMARY KEY,
  load_id      VARCHAR(36)  NOT NULL,
  load_leg_id  VARCHAR(36)  NULL,
  event_type   ENUM(
    'GEOFENCE_ENTRY',
    'GEOFENCE_EXIT',
    'BOL_SCANNED',
    'LUMPER_SCANNED',
    'LOAD_COMPLETED',
    'DETENTION_FLAGGED',
    'DISCREPANCY_FLAGGED',
    'INVOICE_SENT',
    'PAYMENT_RECEIVED'
  ) NOT NULL,
  occurred_at  TIMESTAMP    NOT NULL   COMMENT 'When the event happened (not when logged)',
  driver_lat   DECIMAL(10, 8) NULL,
  driver_lng   DECIMAL(11, 8) NULL,
  payload      JSON         NULL       COMMENT 'Event-specific data (amounts, scores, extracted values)',
  created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (load_id)     REFERENCES loads(id)     ON DELETE CASCADE,
  FOREIGN KEY (load_leg_id) REFERENCES load_legs(id) ON DELETE SET NULL
);

-- ─────────────────────────────────────────────
-- 5. Indexes for analytics queries
-- ─────────────────────────────────────────────
CREATE INDEX idx_load_events_load      ON load_events(load_id);
CREATE INDEX idx_load_events_type      ON load_events(event_type);
CREATE INDEX idx_load_events_occurred  ON load_events(occurred_at);
CREATE INDEX idx_loads_discrepancy     ON loads(discrepancy_flagged);
CREATE INDEX idx_customers_dscore      ON customers(discrepancy_score);
CREATE INDEX idx_load_legs_arrived     ON load_legs(arrived_at);
