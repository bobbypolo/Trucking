-- Migration: GPS Positions Table
-- UP

CREATE TABLE IF NOT EXISTS gps_positions (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  vehicle_id VARCHAR(36) NOT NULL,
  driver_id VARCHAR(36) NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  speed DECIMAL(6,2) NULL,
  heading DECIMAL(5,2) NULL,
  recorded_at DATETIME NOT NULL,
  provider VARCHAR(30) NULL,
  provider_vehicle_id VARCHAR(100) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_gps_positions_lookup (company_id, vehicle_id, recorded_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOWN

DROP TABLE IF EXISTS gps_positions;
