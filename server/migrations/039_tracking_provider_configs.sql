-- Migration 039: Tracking provider configuration and vehicle mappings
-- Team 3: Tracking & Fleet Map
-- Enables admin UI-based telematics provider setup (T3-01, T3-02, T3-03)

-- UP

CREATE TABLE IF NOT EXISTS tracking_provider_configs (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  provider_name VARCHAR(50) NOT NULL,
  api_token TEXT,
  webhook_url VARCHAR(500),
  webhook_secret VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tpc_company (company_id),
  UNIQUE KEY uq_tpc_company_provider (company_id, provider_name)
);

CREATE TABLE IF NOT EXISTS tracking_vehicle_mappings (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  vehicle_id VARCHAR(255) NOT NULL,
  provider_config_id VARCHAR(36) NOT NULL,
  provider_vehicle_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tvm_company (company_id),
  UNIQUE KEY uq_tvm_vehicle_provider (company_id, vehicle_id, provider_config_id),
  FOREIGN KEY (provider_config_id) REFERENCES tracking_provider_configs(id) ON DELETE CASCADE
);

-- DOWN

DROP TABLE IF EXISTS tracking_vehicle_mappings;
DROP TABLE IF EXISTS tracking_provider_configs;
