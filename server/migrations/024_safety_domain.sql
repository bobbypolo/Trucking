-- Migration: 024_safety_domain
-- Description: Add safety domain tables for quizzes, maintenance, service tickets, vendors, and activity log
-- Author: ralph-story-agent
-- Date: 2026-03-18

-- UP

-- Safety quizzes (driver training / compliance quizzes)
CREATE TABLE IF NOT EXISTS safety_quizzes (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status ENUM('draft','active','archived') NOT NULL DEFAULT 'draft',
  created_by VARCHAR(36),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_safety_quizzes_company (company_id)
);

-- Safety quiz results (per-driver quiz submissions)
CREATE TABLE IF NOT EXISTS safety_quiz_results (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  quiz_id VARCHAR(36) NOT NULL,
  driver_id VARCHAR(36),
  driver_name VARCHAR(255),
  score DECIMAL(5,2),
  passed TINYINT(1) DEFAULT 0,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_safety_quiz_results_company (company_id),
  INDEX idx_safety_quiz_results_quiz (quiz_id)
);

-- Safety maintenance records (vehicle maintenance scheduling and history)
CREATE TABLE IF NOT EXISTS safety_maintenance (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  vehicle_id VARCHAR(255) NOT NULL,
  type VARCHAR(255) NOT NULL,
  description TEXT,
  status ENUM('Scheduled','In Progress','Completed','Overdue','Cancelled') NOT NULL DEFAULT 'Scheduled',
  scheduled_date DATE,
  completed_date DATE,
  mileage_at_service INT UNSIGNED,
  cost DECIMAL(10,2),
  vendor_id VARCHAR(36),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_safety_maintenance_company (company_id),
  INDEX idx_safety_maintenance_vehicle (vehicle_id)
);

-- Safety service tickets (maintenance/repair work orders)
CREATE TABLE IF NOT EXISTS safety_service_tickets (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  maintenance_id VARCHAR(36),
  vehicle_id VARCHAR(255),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status ENUM('Open','In Progress','Resolved','Closed') NOT NULL DEFAULT 'Open',
  priority ENUM('Low','Medium','High','Critical') NOT NULL DEFAULT 'Medium',
  assigned_to VARCHAR(255),
  resolved_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_safety_service_tickets_company (company_id)
);

-- Safety vendors (approved service/training providers)
CREATE TABLE IF NOT EXISTS safety_vendors (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  contact_name VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  address TEXT,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_safety_vendors_company (company_id)
);

-- Safety activity log (audit trail for all safety domain actions)
CREATE TABLE IF NOT EXISTS safety_activity_log (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(100),
  entity_id VARCHAR(36),
  actor VARCHAR(255),
  details JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_safety_activity_log_company_created (company_id, created_at)
);

-- DOWN

DROP TABLE IF EXISTS safety_activity_log;
DROP TABLE IF EXISTS safety_vendors;
DROP TABLE IF EXISTS safety_service_tickets;
DROP TABLE IF EXISTS safety_maintenance;
DROP TABLE IF EXISTS safety_quiz_results;
DROP TABLE IF EXISTS safety_quizzes;
