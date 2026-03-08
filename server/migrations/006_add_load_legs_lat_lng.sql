-- Migration: 006_add_load_legs_lat_lng
-- Description: Adds canonical latitude/longitude columns to load_legs table
--              for storing geocoded coordinates (R-P3-02-AC1)
-- Author: recovery-program
-- Date: 2026-03-07

-- UP

ALTER TABLE load_legs
  ADD COLUMN latitude DECIMAL(10, 7) NULL AFTER sequence_order,
  ADD COLUMN longitude DECIMAL(10, 7) NULL AFTER latitude;

-- DOWN

ALTER TABLE load_legs
  DROP COLUMN longitude,
  DROP COLUMN latitude;
