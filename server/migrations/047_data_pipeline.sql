-- Migration 047: Data pipeline — geofence timestamps, weight discrepancy tracking,
--                broker intelligence scoring, load_events event log
-- Originally authored as 001_data_pipeline.sql by coworker; renumbered to fit
-- the project's sequential migration scheme.
--
-- All ALTER TABLE statements are made idempotent via INFORMATION_SCHEMA checks
-- so re-running this migration is safe.

-- UP

-- ─────────────────────────────────────────────
-- 1. load_legs: facility coordinates + timestamps
-- ─────────────────────────────────────────────
SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'load_legs' AND COLUMN_NAME = 'facility_lat');
SET @sql = IF(@col = 0, 'ALTER TABLE load_legs ADD COLUMN facility_lat DECIMAL(10,8) NULL COMMENT ''Facility latitude for geofence center''', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'load_legs' AND COLUMN_NAME = 'facility_lng');
SET @sql = IF(@col = 0, 'ALTER TABLE load_legs ADD COLUMN facility_lng DECIMAL(11,8) NULL COMMENT ''Facility longitude for geofence center''', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'load_legs' AND COLUMN_NAME = 'arrived_at');
SET @sql = IF(@col = 0, 'ALTER TABLE load_legs ADD COLUMN arrived_at TIMESTAMP NULL COMMENT ''Auto-set when driver enters 0.5mi geofence''', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'load_legs' AND COLUMN_NAME = 'loaded_at');
SET @sql = IF(@col = 0, 'ALTER TABLE load_legs ADD COLUMN loaded_at TIMESTAMP NULL COMMENT ''Auto-set when driver scans BOL''', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'load_legs' AND COLUMN_NAME = 'departed_at');
SET @sql = IF(@col = 0, 'ALTER TABLE load_legs ADD COLUMN departed_at TIMESTAMP NULL COMMENT ''Auto-set when driver exits geofence after loading''', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'load_legs' AND COLUMN_NAME = 'detention_minutes');
SET @sql = IF(@col = 0, 'ALTER TABLE load_legs ADD COLUMN detention_minutes INT NULL COMMENT ''Calculated: TIMESTAMPDIFF(MINUTE, arrived_at, loaded_at)''', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ─────────────────────────────────────────────
-- 2. loads: quoted vs scanned weight/commodity
-- ─────────────────────────────────────────────
SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loads' AND COLUMN_NAME = 'quoted_weight');
SET @sql = IF(@col = 0, 'ALTER TABLE loads ADD COLUMN quoted_weight DECIMAL(10,2) NULL COMMENT ''Weight stated by broker at dispatch time''', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loads' AND COLUMN_NAME = 'scanned_weight');
SET @sql = IF(@col = 0, 'ALTER TABLE loads ADD COLUMN scanned_weight DECIMAL(10,2) NULL COMMENT ''Weight extracted from scanned BOL by Gemini''', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loads' AND COLUMN_NAME = 'weight_discrepancy_pct');
SET @sql = IF(@col = 0, 'ALTER TABLE loads ADD COLUMN weight_discrepancy_pct DECIMAL(5,2) NULL COMMENT ''(scanned - quoted) / quoted * 100''', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loads' AND COLUMN_NAME = 'quoted_commodity');
SET @sql = IF(@col = 0, 'ALTER TABLE loads ADD COLUMN quoted_commodity VARCHAR(255) NULL COMMENT ''Commodity stated by broker at dispatch time''', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loads' AND COLUMN_NAME = 'scanned_commodity');
SET @sql = IF(@col = 0, 'ALTER TABLE loads ADD COLUMN scanned_commodity VARCHAR(255) NULL COMMENT ''Commodity extracted from scanned BOL''', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loads' AND COLUMN_NAME = 'discrepancy_flagged');
SET @sql = IF(@col = 0, 'ALTER TABLE loads ADD COLUMN discrepancy_flagged BOOLEAN DEFAULT FALSE COMMENT ''TRUE if weight variance exceeds 5%''', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ─────────────────────────────────────────────
-- 3. customers: broker intelligence columns
-- ─────────────────────────────────────────────
SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'discrepancy_score');
SET @sql = IF(@col = 0, 'ALTER TABLE customers ADD COLUMN discrepancy_score INT DEFAULT 0 COMMENT ''Count of loads where broker weight was off >5%''', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'total_loads_completed');
SET @sql = IF(@col = 0, 'ALTER TABLE customers ADD COLUMN total_loads_completed INT DEFAULT 0 COMMENT ''Total settled loads with this broker''', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'avg_payment_days');
SET @sql = IF(@col = 0, 'ALTER TABLE customers ADD COLUMN avg_payment_days DECIMAL(5,1) DEFAULT 0 COMMENT ''Average days from invoice to payment received''', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'last_discrepancy_at');
SET @sql = IF(@col = 0, 'ALTER TABLE customers ADD COLUMN last_discrepancy_at TIMESTAMP NULL COMMENT ''Timestamp of most recent flagged discrepancy''', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ─────────────────────────────────────────────
-- 4. load_events: immutable pipeline event log
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS load_events (
  id           VARCHAR(36)   NOT NULL PRIMARY KEY,
  load_id      VARCHAR(36)   NOT NULL,
  load_leg_id  VARCHAR(36)   NULL,
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
  occurred_at  TIMESTAMP     NOT NULL COMMENT 'When the event happened (not when logged)',
  driver_lat   DECIMAL(10,8) NULL,
  driver_lng   DECIMAL(11,8) NULL,
  payload      JSON          NULL COMMENT 'Event-specific data (amounts, scores, extracted values)',
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_load_events_load     FOREIGN KEY (load_id)     REFERENCES loads(id)     ON DELETE CASCADE,
  CONSTRAINT fk_load_events_load_leg FOREIGN KEY (load_leg_id) REFERENCES load_legs(id) ON DELETE SET NULL
);

-- ─────────────────────────────────────────────
-- 5. Indexes (idempotent via INFORMATION_SCHEMA checks)
-- ─────────────────────────────────────────────
SET @idx = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'load_events' AND INDEX_NAME = 'idx_load_events_load');
SET @sql = IF(@idx = 0, 'CREATE INDEX idx_load_events_load ON load_events(load_id)', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @idx = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'load_events' AND INDEX_NAME = 'idx_load_events_type');
SET @sql = IF(@idx = 0, 'CREATE INDEX idx_load_events_type ON load_events(event_type)', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @idx = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'load_events' AND INDEX_NAME = 'idx_load_events_occurred');
SET @sql = IF(@idx = 0, 'CREATE INDEX idx_load_events_occurred ON load_events(occurred_at)', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @idx = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loads' AND INDEX_NAME = 'idx_loads_discrepancy');
SET @sql = IF(@idx = 0, 'CREATE INDEX idx_loads_discrepancy ON loads(discrepancy_flagged)', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @idx = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND INDEX_NAME = 'idx_customers_dscore');
SET @sql = IF(@idx = 0, 'CREATE INDEX idx_customers_dscore ON customers(discrepancy_score)', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @idx = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'load_legs' AND INDEX_NAME = 'idx_load_legs_arrived');
SET @sql = IF(@idx = 0, 'CREATE INDEX idx_load_legs_arrived ON load_legs(arrived_at)', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- DOWN

ALTER TABLE load_legs
  DROP COLUMN IF EXISTS facility_lat,
  DROP COLUMN IF EXISTS facility_lng,
  DROP COLUMN IF EXISTS arrived_at,
  DROP COLUMN IF EXISTS loaded_at,
  DROP COLUMN IF EXISTS departed_at,
  DROP COLUMN IF EXISTS detention_minutes;

ALTER TABLE loads
  DROP COLUMN IF EXISTS quoted_weight,
  DROP COLUMN IF EXISTS scanned_weight,
  DROP COLUMN IF EXISTS weight_discrepancy_pct,
  DROP COLUMN IF EXISTS quoted_commodity,
  DROP COLUMN IF EXISTS scanned_commodity,
  DROP COLUMN IF EXISTS discrepancy_flagged;

ALTER TABLE customers
  DROP COLUMN IF EXISTS discrepancy_score,
  DROP COLUMN IF EXISTS total_loads_completed,
  DROP COLUMN IF EXISTS avg_payment_days,
  DROP COLUMN IF EXISTS last_discrepancy_at;

DROP TABLE IF EXISTS load_events;
