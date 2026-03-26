-- UP

CREATE TABLE IF NOT EXISTS geofence_events (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  load_id VARCHAR(36) NOT NULL,
  driver_id VARCHAR(36),
  facility_name VARCHAR(255),
  facility_lat DECIMAL(10,7) NOT NULL,
  facility_lng DECIMAL(11,7) NOT NULL,
  geofence_radius_meters INT DEFAULT 500,
  event_type ENUM('ENTRY','EXIT') NOT NULL,
  event_timestamp DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (load_id) REFERENCES loads(id) ON DELETE CASCADE,
  INDEX idx_geofence_company (company_id),
  INDEX idx_geofence_load_event (load_id, event_type, event_timestamp DESC)
);

CREATE TABLE IF NOT EXISTS detention_rules (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  free_hours DECIMAL(5,2) NOT NULL DEFAULT 2.00,
  hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 75.00,
  max_billable_hours DECIMAL(5,2) DEFAULT 24.00,
  applies_to ENUM('ALL','PICKUP','DROPOFF') DEFAULT 'ALL',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  INDEX idx_detention_rules_company (company_id)
);

-- DOWN
DROP TABLE IF EXISTS detention_rules;
DROP TABLE IF EXISTS geofence_events;
