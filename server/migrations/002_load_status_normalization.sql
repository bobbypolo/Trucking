-- Migration: 002_load_status_normalization
-- Description: Normalize loads.status ENUM from 12 legacy PascalCase values to 8 canonical lowercase values
-- Author: ralph-story-agent
-- Date: 2026-03-08
-- IMPORTANT: This migration targets the DEV database only. Do NOT run against production.
--
-- MySQL 8.4 compatible two-step approach:
--   Step 1 (Convert to VARCHAR): Change status column to VARCHAR to allow any string value
--   Step 2 (Normalize): UPDATE existing rows to canonical lowercase values
--   Step 3 (Convert to ENUM): Change back to canonical ENUM
--
-- Note: MySQL 8.4 treats ENUM values as case-insensitive for duplicate detection.
--   The original 3-step widen approach fails because 'Planned' and 'planned' are
--   considered duplicates. We use VARCHAR as intermediate type instead.

-- UP

-- Step 1: Convert status to VARCHAR so we can hold any value during migration
ALTER TABLE loads MODIFY COLUMN status VARCHAR(64) NOT NULL DEFAULT 'draft';

-- Step 2: Normalize existing rows from legacy PascalCase to canonical lowercase
UPDATE loads SET status = 'planned'    WHERE status IN ('Planned', 'Booked', 'CorrectionRequested');
UPDATE loads SET status = 'dispatched' WHERE status = 'Departed';
UPDATE loads SET status = 'in_transit' WHERE status = 'Active';
UPDATE loads SET status = 'arrived'    WHERE status IN ('Arrived', 'Docked');
UPDATE loads SET status = 'delivered'  WHERE status IN ('Unloaded', 'Delivered');
UPDATE loads SET status = 'completed'  WHERE status IN ('Invoiced', 'Settled');
UPDATE loads SET status = 'cancelled'  WHERE status = 'Cancelled';

-- Step 3: Convert to canonical ENUM (all rows should now have canonical lowercase values)
ALTER TABLE loads MODIFY COLUMN status ENUM(
  'draft', 'planned', 'dispatched', 'in_transit', 'arrived', 'delivered', 'completed', 'cancelled'
) DEFAULT 'draft';

-- DOWN

-- Step 1: Denormalize rows from canonical lowercase back to PascalCase legacy names
-- (must run before converting to VARCHAR, while ENUM validation is still active)
UPDATE loads SET status = 'draft'      WHERE status = 'draft';
UPDATE loads SET status = 'planned'    WHERE status = 'planned';
UPDATE loads SET status = 'dispatched' WHERE status = 'dispatched';
UPDATE loads SET status = 'in_transit' WHERE status = 'in_transit';
UPDATE loads SET status = 'arrived'    WHERE status = 'arrived';
UPDATE loads SET status = 'delivered'  WHERE status = 'delivered';
UPDATE loads SET status = 'completed'  WHERE status = 'completed';
UPDATE loads SET status = 'cancelled'  WHERE status = 'cancelled';

-- Step 2: Convert status back to VARCHAR (allows restoration of legacy ENUM in rollback file)
ALTER TABLE loads MODIFY COLUMN status VARCHAR(64) NOT NULL DEFAULT 'draft';
