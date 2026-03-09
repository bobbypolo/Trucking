-- Migration: 002_load_status_normalization
-- Description: Normalize loads.status ENUM from 12 legacy PascalCase values to 8 canonical lowercase values
-- Author: ralph-story-agent
-- Date: 2026-03-08
-- IMPORTANT: This migration targets the DEV database only. Do NOT run against production.
--
-- Three-step approach:
--   Step 1 (Widen): Add canonical lowercase values alongside legacy PascalCase to avoid ENUM constraint errors
--   Step 2 (Normalize): UPDATE existing rows to canonical lowercase values
--   Step 3 (Shrink): Remove legacy PascalCase values, leaving only canonical 8

-- UP

-- Step 1: Widen ENUM to include canonical values alongside legacy
-- This allows existing rows (with legacy values) to coexist with new canonical values
-- during the UPDATE step without violating the ENUM constraint.
ALTER TABLE loads MODIFY COLUMN status ENUM(
  'draft', 'planned', 'dispatched', 'in_transit', 'arrived', 'delivered', 'completed', 'cancelled',
  'Planned', 'Booked', 'Active', 'Departed', 'Arrived', 'Docked', 'Unloaded', 'Delivered',
  'Invoiced', 'Settled', 'Cancelled', 'CorrectionRequested'
) DEFAULT 'draft';

-- Step 2: Normalize existing rows from legacy PascalCase to canonical lowercase
-- Direct maps
UPDATE loads SET status = 'planned'    WHERE status IN ('Planned', 'Booked', 'CorrectionRequested');
UPDATE loads SET status = 'dispatched' WHERE status = 'Departed';
UPDATE loads SET status = 'in_transit' WHERE status = 'Active';
UPDATE loads SET status = 'arrived'    WHERE status IN ('Arrived', 'Docked');
UPDATE loads SET status = 'delivered'  WHERE status IN ('Unloaded', 'Delivered');
UPDATE loads SET status = 'completed'  WHERE status IN ('Invoiced', 'Settled');
UPDATE loads SET status = 'cancelled'  WHERE status = 'Cancelled';

-- Step 3: Shrink ENUM to canonical-only (removes legacy PascalCase values)
-- All rows should now have canonical lowercase values after Step 2.
ALTER TABLE loads MODIFY COLUMN status ENUM(
  'draft', 'planned', 'dispatched', 'in_transit', 'arrived', 'delivered', 'completed', 'cancelled'
) DEFAULT 'draft';
