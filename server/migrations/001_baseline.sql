-- Migration: 001_baseline
-- Description: Captures full current schema from schema.sql as baseline migration
-- Author: recovery-program
-- Date: 2026-03-07

-- UP

-- 1. Companies
CREATE TABLE IF NOT EXISTS companies (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  account_type ENUM('fleet', 'owner_operator', 'independent_driver') DEFAULT 'fleet',
  email VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(50),
  zip VARCHAR(20),
  tax_id VARCHAR(50),
  phone VARCHAR(50),
  mc_number VARCHAR(50),
  dot_number VARCHAR(50),
  subscription_status ENUM('active', 'trial', 'past_due') DEFAULT 'active',
  load_numbering_config JSON,
  accessorial_rates JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users (Drivers, Dispatchers, Admins)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  firebase_uid VARCHAR(128) UNIQUE,
  password VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  role ENUM('admin', 'driver', 'owner_operator', 'safety_manager', 'dispatcher', 'payroll_manager', 'customer', 'OWNER_ADMIN', 'OPS', 'SAFETY_MAINT', 'FINANCE', 'SALES_CS', 'ORG_OWNER_SUPER_ADMIN', 'OPS_MANAGER', 'SAFETY_COMPLIANCE', 'MAINTENANCE_MANAGER', 'ACCOUNTING_AR', 'ACCOUNTING_AP', 'PAYROLL_SETTLEMENTS', 'DRIVER_PORTAL', 'FLEET_OO_ADMIN_PORTAL', 'SALES_CUSTOMER_SERVICE') NOT NULL,
  pay_model ENUM('percent', 'mileage', 'hourly', 'salary'),
  pay_rate DECIMAL(10, 2),
  onboarding_status ENUM('Pending', 'Completed') DEFAULT 'Pending',
  safety_score INT DEFAULT 100,
  managed_by_user_id VARCHAR(36),
  compliance_status ENUM('Eligible', 'Restricted') DEFAULT 'Eligible',
  restriction_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- 3. Customers (Brokers & Direct Clients)
CREATE TABLE IF NOT EXISTS customers (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type ENUM('Broker', 'Direct Customer') NOT NULL,
  mc_number VARCHAR(50),
  dot_number VARCHAR(50),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  payment_terms VARCHAR(100),
  chassis_requirements JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- 4. Customer Contracts
CREATE TABLE IF NOT EXISTS customer_contracts (
  id VARCHAR(36) PRIMARY KEY,
  customer_id VARCHAR(36) NOT NULL,
  contract_name VARCHAR(255) NOT NULL,
  terms TEXT,
  start_date DATE,
  expiry_date DATE,
  equipment_preferences JSON,
  status ENUM('Active', 'Expired', 'Draft') DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- 5. Equipment Registry
CREATE TABLE IF NOT EXISTS equipment (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  unit_number VARCHAR(50) NOT NULL,
  type ENUM('Truck', 'Trailer', 'Chassis', 'Container') NOT NULL,
  status ENUM('Active', 'Out of Service', 'Removed') DEFAULT 'Active',
  ownership_type VARCHAR(100),
  provider_name VARCHAR(100),
  daily_cost DECIMAL(10, 2),
  maintenance_history JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- 6. Loads
CREATE TABLE IF NOT EXISTS loads (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  customer_id VARCHAR(36),
  driver_id VARCHAR(36),
  dispatcher_id VARCHAR(36),
  load_number VARCHAR(100) NOT NULL,
  status ENUM('Planned', 'Booked', 'Active', 'Departed', 'Arrived', 'Docked', 'Unloaded', 'Delivered', 'Invoiced', 'Settled', 'Cancelled', 'CorrectionRequested') DEFAULT 'Planned',
  carrier_rate DECIMAL(10, 2) DEFAULT 0,
  driver_pay DECIMAL(10, 2) DEFAULT 0,
  pickup_date DATE,
  freight_type VARCHAR(100),
  commodity VARCHAR(255),
  weight DECIMAL(10, 2),
  container_number VARCHAR(100),
  container_size VARCHAR(50),
  chassis_number VARCHAR(100),
  chassis_provider VARCHAR(255),
  bol_number VARCHAR(100),
  notification_emails JSON,
  contract_id VARCHAR(36),
  gps_history JSON,
  pod_urls JSON,
  customer_user_id VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (contract_id) REFERENCES customer_contracts(id) ON DELETE SET NULL
);

-- 7. Load Legs (Stops)
CREATE TABLE IF NOT EXISTS load_legs (
  id VARCHAR(36) PRIMARY KEY,
  load_id VARCHAR(36) NOT NULL,
  type ENUM('Pickup', 'Dropoff', 'Fuel', 'Rest') NOT NULL,
  facility_name VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(50),
  date DATE,
  appointment_time VARCHAR(50),
  completed BOOLEAN DEFAULT FALSE,
  sequence_order INT DEFAULT 0,
  FOREIGN KEY (load_id) REFERENCES loads(id) ON DELETE CASCADE
);

-- 8. Expenses & Financials
CREATE TABLE IF NOT EXISTS expenses (
  id VARCHAR(36) PRIMARY KEY,
  load_id VARCHAR(36),
  company_id VARCHAR(36) NOT NULL,
  category VARCHAR(100) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  date DATE,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (load_id) REFERENCES loads(id) ON DELETE SET NULL
);

-- 9. Issues & Maintenance
CREATE TABLE IF NOT EXISTS issues (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  load_id VARCHAR(36),
  driver_id VARCHAR(36),
  category VARCHAR(100),
  description TEXT,
  status ENUM('Open', 'Resolved') DEFAULT 'Open',
  reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- 10. Emergency Incidents
CREATE TABLE IF NOT EXISTS incidents (
  id VARCHAR(36) PRIMARY KEY,
  load_id VARCHAR(36) NOT NULL,
  type ENUM('Breakdown', 'Accident', 'Cargo Issue', 'Weather Shutdown', 'HOS Risk', 'Load at Risk', 'Reefer Temp', 'Theft Risk') NOT NULL,
  severity ENUM('Critical', 'High', 'Medium', 'Low') DEFAULT 'Medium',
  status ENUM('Open', 'In_Progress', 'Recovered', 'Closed') DEFAULT 'Open',
  reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sla_deadline TIMESTAMP NULL,
  description TEXT,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  recovery_plan TEXT,
  FOREIGN KEY (load_id) REFERENCES loads(id) ON DELETE CASCADE
);

-- 11. Incident Timeline (Immutable Actions)
CREATE TABLE IF NOT EXISTS incident_actions (
  id VARCHAR(36) PRIMARY KEY,
  incident_id VARCHAR(36) NOT NULL,
  actor_name VARCHAR(255),
  action VARCHAR(255) NOT NULL,
  notes TEXT,
  attachments JSON,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
);

-- 12. Emergency Billing & Charges
CREATE TABLE IF NOT EXISTS emergency_charges (
  id VARCHAR(36) PRIMARY KEY,
  incident_id VARCHAR(36) NOT NULL,
  category ENUM('Tow', 'Roadside', 'Storage', 'Cross-Dock', 'Repower', 'Layover', 'Hotel', 'Claim') NOT NULL,
  amount DECIMAL(10, 2) DEFAULT 0,
  provider_vendor VARCHAR(255),
  status ENUM('Draft', 'Pending_Approval', 'Approved', 'Billed') DEFAULT 'Draft',
  approved_by VARCHAR(36),
  receipt_url TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
);

-- 13. Compliance Records
CREATE TABLE IF NOT EXISTS compliance_records (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  type ENUM('CDL', 'Medical_Card', 'Drug_Test', 'Background_Check', 'Training') NOT NULL,
  expiry_date DATE,
  status ENUM('Valid', 'Expired', 'Pending_Review') DEFAULT 'Valid',
  document_url TEXT,
  is_mandatory BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 14. Training Modules
CREATE TABLE IF NOT EXISTS training_courses (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  content_url TEXT,
  mandatory_roles JSON,
  quiz_id VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 15. Driver Time Logs
CREATE TABLE IF NOT EXISTS driver_time_logs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  load_id VARCHAR(36),
  clock_in TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  clock_out TIMESTAMP NULL,
  activity_type VARCHAR(100),
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (load_id) REFERENCES loads(id) ON DELETE SET NULL
);

-- 16. Dispatch Intelligence Logs
CREATE TABLE IF NOT EXISTS dispatch_events (
  id VARCHAR(36) PRIMARY KEY,
  load_id VARCHAR(36) NOT NULL,
  dispatcher_id VARCHAR(36) NOT NULL,
  event_type ENUM('Note', 'StatusChange', 'DriverCall', 'SystemAlert') NOT NULL,
  message TEXT,
  payload JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (load_id) REFERENCES loads(id) ON DELETE CASCADE,
  FOREIGN KEY (dispatcher_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 17. Operational Messaging — moved to 018_messages_threads.sql (authoritative)

-- 18. Agile Authorization & Workspaces
ALTER TABLE companies ADD COLUMN operating_mode ENUM('Small Team', 'Split Roles', 'Enterprise') DEFAULT 'Small Team';
ALTER TABLE users ADD COLUMN primary_workspace ENUM('Quotes', 'Dispatch', 'Balanced') DEFAULT 'Dispatch';
ALTER TABLE users ADD COLUMN duty_mode ENUM('Pricing', 'Dispatch', 'Both') DEFAULT 'Both';
ALTER TABLE users ADD COLUMN assigned_capabilities JSON;

-- 19. Intake, Quotes & Bookings — moved to 017_quotes_leads_bookings.sql (authoritative)

-- 20. Operational Work Items — moved to 019_tasks_workitems.sql (authoritative)

-- Indexes for quotes/bookings/work_items — moved to their authoritative migrations

-- DOWN

-- Drop columns added by ALTER TABLE (section 18)
ALTER TABLE users DROP COLUMN assigned_capabilities;
ALTER TABLE users DROP COLUMN duty_mode;
ALTER TABLE users DROP COLUMN primary_workspace;
ALTER TABLE companies DROP COLUMN operating_mode;

-- Drop tables in reverse dependency order (children before parents)
-- work_items, bookings, quotes, leads, messages — dropped by their authoritative migrations
DROP TABLE IF EXISTS dispatch_events;
DROP TABLE IF EXISTS driver_time_logs;
DROP TABLE IF EXISTS training_courses;
DROP TABLE IF EXISTS compliance_records;
DROP TABLE IF EXISTS emergency_charges;
DROP TABLE IF EXISTS incident_actions;
DROP TABLE IF EXISTS incidents;
DROP TABLE IF EXISTS issues;
DROP TABLE IF EXISTS expenses;
DROP TABLE IF EXISTS load_legs;
DROP TABLE IF EXISTS loads;
DROP TABLE IF EXISTS equipment;
DROP TABLE IF EXISTS customer_contracts;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS companies;
