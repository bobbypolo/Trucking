-- Migration 055 — quote margin settings
-- Adds 5 numeric columns to the quotes table to support margin settings:
--   margin, discount, commission (percentages), estimated_driver_pay (dollars),
--   and company_cost_factor (percentage, default 50.00).
-- These columns back the Quote Margin Settings UI (R-P8-01..R-P8-06).

-- UP
ALTER TABLE quotes ADD COLUMN margin DECIMAL(5, 2) DEFAULT NULL;
ALTER TABLE quotes ADD COLUMN discount DECIMAL(5, 2) DEFAULT NULL;
ALTER TABLE quotes ADD COLUMN commission DECIMAL(5, 2) DEFAULT NULL;
ALTER TABLE quotes ADD COLUMN estimated_driver_pay DECIMAL(10, 2) DEFAULT NULL;
ALTER TABLE quotes ADD COLUMN company_cost_factor DECIMAL(5, 2) NOT NULL DEFAULT 50.00;

-- DOWN
ALTER TABLE quotes DROP COLUMN company_cost_factor;
ALTER TABLE quotes DROP COLUMN estimated_driver_pay;
ALTER TABLE quotes DROP COLUMN commission;
ALTER TABLE quotes DROP COLUMN discount;
ALTER TABLE quotes DROP COLUMN margin;
