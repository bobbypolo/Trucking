-- Migration 017: Quotes, Leads, Bookings tables
-- UP

CREATE TABLE IF NOT EXISTS quotes (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  status ENUM('Draft','Sent','Negotiating','Accepted','Declined','Expired') DEFAULT 'Draft',
  version INT DEFAULT 1,
  pickup_city VARCHAR(100),
  pickup_state VARCHAR(10),
  pickup_facility VARCHAR(200),
  dropoff_city VARCHAR(100),
  dropoff_state VARCHAR(10),
  dropoff_facility VARCHAR(200),
  equipment_type VARCHAR(50),
  linehaul DECIMAL(10,2),
  fuel_surcharge DECIMAL(10,2),
  total_rate DECIMAL(10,2),
  customer_id VARCHAR(36),
  broker_id VARCHAR(36),
  valid_until DATETIME,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(36),
  updated_by VARCHAR(36),
  archived_at DATETIME NULL,
  INDEX idx_quotes_company (company_id),
  INDEX idx_quotes_status (company_id, status),
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE TABLE IF NOT EXISTS leads (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  status ENUM('New','Contacted','Qualified','Proposal','Won','Lost') DEFAULT 'New',
  source VARCHAR(50),
  contact_name VARCHAR(100),
  contact_email VARCHAR(200),
  contact_phone VARCHAR(50),
  company_name VARCHAR(200),
  notes TEXT,
  estimated_value DECIMAL(10,2),
  lane VARCHAR(200),
  equipment_needed VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(36),
  updated_by VARCHAR(36),
  INDEX idx_leads_company (company_id),
  INDEX idx_leads_status (company_id, status),
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE TABLE IF NOT EXISTS bookings (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  quote_id VARCHAR(36),
  customer_id VARCHAR(36),
  status ENUM('Pending','Confirmed','Ready_for_Dispatch','Dispatched','Cancelled') DEFAULT 'Pending',
  pickup_date DATE,
  delivery_date DATE,
  load_id VARCHAR(36),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(36),
  updated_by VARCHAR(36),
  INDEX idx_bookings_company (company_id),
  INDEX idx_bookings_status (company_id, status),
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- DOWN
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS leads;
DROP TABLE IF EXISTS quotes;
