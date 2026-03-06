-- Migration: Exception Management System V1

-- Reference Tables
CREATE TABLE IF NOT EXISTS exception_status (
  status_code VARCHAR(32) PRIMARY KEY,
  display_name VARCHAR(64) NOT NULL,
  is_terminal BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL
);

CREATE TABLE IF NOT EXISTS exception_type (
  type_code VARCHAR(64) PRIMARY KEY,
  display_name VARCHAR(96) NOT NULL,
  dashboard_group VARCHAR(64) NOT NULL,
  default_owner_team VARCHAR(64) NOT NULL,
  default_severity INT NOT NULL,          -- 1=Low, 2=Med, 3=High, 4=Critical
  default_sla_hours NUMERIC(10,2) NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS dashboard_card (
  card_code VARCHAR(64) PRIMARY KEY,
  display_name VARCHAR(96) NOT NULL,
  sort_order INT NOT NULL,
  icon_key VARCHAR(64) NULL,
  route VARCHAR(255) NOT NULL,
  filter_json TEXT NOT NULL              -- JSON string or JSON type
);

-- Core Exception Table
CREATE TABLE IF NOT EXISTS exceptions (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'DEFAULT',
  type VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  severity INT NOT NULL DEFAULT 2, -- 1=Low, 2=Med, 3=High, 4=Critical
  entity_type VARCHAR(32), -- LOAD, DRIVER, TRUCK, TRAILER, BROKER, FACILITY
  entity_id VARCHAR(64),
  owner_user_id VARCHAR(64),
  team VARCHAR(64),
  sla_due_at DATETIME,
  workflow_step VARCHAR(64), -- triage, request_docs, approve_pay, invoice_adjust, close
  financial_impact_est DECIMAL(10, 2) DEFAULT 0.00,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  resolved_at DATETIME,
  links JSON, -- Deep links to related records
  FOREIGN KEY (status) REFERENCES exception_status(status_code),
  FOREIGN KEY (type) REFERENCES exception_type(type_code)
);

-- Audit Trail / Events
CREATE TABLE IF NOT EXISTS exception_events (
  id VARCHAR(64) PRIMARY KEY,
  exception_id VARCHAR(64) NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  actor_id VARCHAR(64),
  actor_name VARCHAR(128),
  action VARCHAR(128) NOT NULL,
  notes TEXT,
  before_state JSON,
  after_state JSON,
  FOREIGN KEY (exception_id) REFERENCES exceptions(id)
);

-- Seed Statuses
INSERT IGNORE INTO exception_status (status_code, display_name, is_terminal, sort_order) VALUES
('OPEN','Open',FALSE,10),
('TRIAGED','Triaged',FALSE,20),
('IN_PROGRESS','In Progress',FALSE,30),
('WAITING_EXTERNAL','Waiting External',FALSE,40),
('APPROVAL_REQUIRED','Approval Required',FALSE,50),
('RESOLVED','Resolved',TRUE,90),
('CLOSED','Closed',TRUE,100);

-- Seed Exception Types
INSERT IGNORE INTO exception_type
(type_code, display_name, dashboard_group, default_owner_team, default_severity, default_sla_hours, description)
VALUES
('DELAY_REPORTED','Delay Reported','Delay Entry','Dispatch',2,2,'Driver/carrier reported delay; requires ETA update + notifications'),
('CARRIER_DELAY','Carrier Delay','Carrier Delay','Dispatch',3,1,'Confirmed carrier delay; detention risk'),
('MISSED_APPT','Missed Appointment','Carrier Delay','Dispatch',4,0.5,'Appointment missed; immediate reschedule/notify'),
('DETENTION_ELIGIBLE','Detention Eligible','Delay Entry','Billing',2,8,'Detention timer suggests eligibility; draft accessorial'),
('LUMPER_REQUEST','Lumper Request','Delay Entry','Billing',2,12,'Lumper fee submitted; needs receipt + approval'),
('LAYOVER_REQUEST','Layover Request','Delay Entry','Billing',2,12,'Layover requested; needs approval/docs'),
('VEHICLE_OOS','Vehicle Out of Service','Maintenance Entry','Fleet/Maint',4,1,'Asset is OOS; blocks dispatch assignment'),
('BREAKDOWN','Breakdown','Maintenance Entry','Fleet/Maint',3,1,'Road breakdown; roadside + recovery workflow'),
('PM_OVERDUE','PM Overdue','Maintenance Entry','Fleet/Maint',2,72,'PM overdue; may restrict dispatch by policy'),
('POD_MISSING','POD Missing','Document Entry','Billing',3,24,'POD not received; invoice hold risk'),
('DOC_PENDING_48H','Docs Pending 48h','Document Entry','Billing',2,12,'Docs pending >48h; escalation needed'),
('SIGNATURE_MISSING','Signature Missing','Document Entry','Billing',2,12,'Signature missing on critical doc'),
('BOL_MISSING','BOL Missing','Document Entry','Dispatch',2,6,'BOL missing; blocks close-out'),
('RATE_CONFIRM_MISSING','Rate Confirmation Missing','Document Entry','Billing',2,6,'Rate con missing; blocks invoicing'),
('REROUTE_REQUEST','Reroute Request','System Entry','Dispatch',3,2,'Reroute requested; approve if rate impact'),
('ADDRESS_CORRECTION','Address Correction','System Entry','Dispatch',2,4,'Address correction needed; updates lane/appt'),
('RATE_CORRECTION','Rate Correction','System Entry','Billing',3,6,'Change order / rate correction; affects invoice + settlement'),
('ACCESSORIAL_CORRECTION','Accessorial Correction','System Entry','Billing',2,12,'Detention/lumper/layover correction'),
('INVOICE_HOLD','Invoice Hold','Process All Exceptions','Billing',3,24,'Invoice can’t issue due to missing requirements'),
('SETTLEMENT_HOLD','Settlement Hold','Process All Exceptions','Payroll/Settlements',2,24,'Driver pay held pending docs/approvals'),
('COMPLIANCE_RESTRICTED','Compliance Restricted','Process All Exceptions','Safety',3,4,'Driver/asset restricted from dispatch'),
('CUSTOMER_NOTIFY_REQUIRED','Customer Notify Required','Process All Exceptions','Dispatch',2,2,'Customer/broker must be notified');

-- Seed Dashboard Cards
INSERT IGNORE INTO dashboard_card (card_code, display_name, sort_order, icon_key, route, filter_json) VALUES
('DELAY_ENTRY','Delay Entry',10,'clock','/exceptions?view=delay-entry',
 '{"type_in":["DELAY_REPORTED","DETENTION_ELIGIBLE","LUMPER_REQUEST","LAYOVER_REQUEST"],"status_not_in":["RESOLVED","CLOSED"]}'
),
('CARRIER_DELAY','Carrier Delay',20,'alert','/exceptions?view=carrier-delay',
 '{"type_in":["CARRIER_DELAY","MISSED_APPT"],"status_not_in":["RESOLVED","CLOSED"]}'
),
('MAINT_ENTRY','Maintenance Entry',30,'wrench','/exceptions?view=maintenance',
 '{"type_in":["VEHICLE_OOS","BREAKDOWN","PM_OVERDUE"],"status_not_in":["RESOLVED","CLOSED"]}'
),
('VEHICLE_OOS','Vehicle OOS',40,'truck','/exceptions?view=oos',
 '{"type_in":["VEHICLE_OOS"],"status_not_in":["RESOLVED","CLOSED"]}'
),
('DOC_ENTRY','Document Entry',50,'file','/exceptions?view=docs',
 '{"type_in":["POD_MISSING","DOC_PENDING_48H","SIGNATURE_MISSING","BOL_MISSING","RATE_CONFIRM_MISSING"],"status_not_in":["RESOLVED","CLOSED"]}'
),
('POD_MISSING_48','POD Missing / Pending 48h',60,'paperclip','/exceptions?view=pod-aging',
 '{"type_in":["POD_MISSING","DOC_PENDING_48H"],"status_not_in":["RESOLVED","CLOSED"]}'
),
('SYSTEM_ENTRY','System Entry (Reroute / Correction)',70,'settings','/exceptions?view=system',
 '{"type_in":["REROUTE_REQUEST","ADDRESS_CORRECTION","RATE_CORRECTION","ACCESSORIAL_CORRECTION"],"status_not_in":["RESOLVED","CLOSED"]}'
),
('ALL_EXCEPTIONS','Process All Exceptions',80,'inbox','/exceptions',
 '{"status_not_in":["RESOLVED","CLOSED"]}'
);
