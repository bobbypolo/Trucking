-- Migration: 013_ifta_intelligence
-- Description: Creates IFTA intelligence and audit tables.
--   ifta_trip_evidence, ifta_trips_audit.
-- Both tables include tenant_id for multi-tenant isolation.
-- Depends on: 012_accounting_v3_extensions.sql
-- Author: ralph-story STORY-001
-- Date: 2026-03-10
-- Tests R-P1-03

-- UP

CREATE TABLE IF NOT EXISTS ifta_trip_evidence (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    load_id VARCHAR(36) NOT NULL,
    truck_id VARCHAR(36),
    driver_id VARCHAR(36),
    timestamp TIMESTAMP NOT NULL,
    lat DECIMAL(10,7) NOT NULL,
    lng DECIMAL(11,7) NOT NULL,
    odometer DECIMAL(10,2),
    state_code CHAR(2),
    speed_mph DECIMAL(6,2),
    source ENUM('ELD','GPS','Manual','Import') NOT NULL DEFAULT 'ELD',
    raw_payload JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ifta_evidence_tenant (tenant_id),
    INDEX idx_ifta_evidence_load (load_id),
    INDEX idx_ifta_evidence_truck (truck_id),
    INDEX idx_ifta_evidence_timestamp (timestamp),
    INDEX idx_ifta_evidence_state (state_code)
);

CREATE TABLE IF NOT EXISTS ifta_trips_audit (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    truck_id VARCHAR(36),
    load_id VARCHAR(36),
    trip_date DATE NOT NULL,
    start_odometer DECIMAL(10,2),
    end_odometer DECIMAL(10,2),
    total_total_miles DECIMAL(10,3) NOT NULL DEFAULT 0.000,
    method ENUM('ACTUAL_GPS','ROUTES','MANUAL','ELD_ODOMETER') NOT NULL DEFAULT 'MANUAL',
    confidence_level ENUM('HIGH','MEDIUM','LOW') NOT NULL DEFAULT 'MEDIUM',
    jurisdiction_miles JSON,
    status ENUM('LOCKED','DRAFT','AMENDED') NOT NULL DEFAULT 'DRAFT',
    attested_by VARCHAR(36),
    attested_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ifta_trips_audit_tenant (tenant_id),
    INDEX idx_ifta_trips_audit_truck (truck_id),
    INDEX idx_ifta_trips_audit_load (load_id),
    INDEX idx_ifta_trips_audit_trip_date (trip_date),
    INDEX idx_ifta_trips_audit_status (status)
);

-- DOWN

DROP TABLE IF EXISTS ifta_trips_audit;
DROP TABLE IF EXISTS ifta_trip_evidence;
