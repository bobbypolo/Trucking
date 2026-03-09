-- Migration: 002_load_status_normalization_rollback
-- Description: Rollback for 002_load_status_normalization — restores 12-value PascalCase ENUM
-- Author: ralph-story-agent
-- Date: 2026-03-08
-- IMPORTANT: This rollback targets the DEV database only. Do NOT run against production.
--
-- Three-step approach (reverse of forward migration):
--   Step 1 (Widen): Add legacy PascalCase values back to the ENUM alongside canonical
--   Step 2 (Denormalize): UPDATE rows from canonical lowercase back to legacy PascalCase
--   Step 3 (Shrink): Remove canonical lowercase values, restoring the original 12-value ENUM

-- DOWN

-- Step 1: Widen ENUM to include legacy values alongside canonical
ALTER TABLE loads MODIFY COLUMN status ENUM(
  'draft', 'planned', 'dispatched', 'in_transit', 'arrived', 'delivered', 'completed', 'cancelled',
  'Planned', 'Booked', 'Active', 'Departed', 'Arrived', 'Docked', 'Unloaded', 'Delivered',
  'Invoiced', 'Settled', 'Cancelled', 'CorrectionRequested'
) DEFAULT 'Planned';

-- Step 2: Denormalize rows from canonical lowercase back to legacy PascalCase
-- Note: Some mappings were many-to-one (e.g., Booked+CorrectionRequested -> planned,
-- Arrived+Docked -> arrived, Invoiced+Settled -> completed). On rollback, we use the
-- primary legacy value for each canonical value.
UPDATE loads SET status = 'Planned'   WHERE status = 'planned';
UPDATE loads SET status = 'Departed'  WHERE status = 'dispatched';
UPDATE loads SET status = 'Active'    WHERE status = 'in_transit';
UPDATE loads SET status = 'Arrived'   WHERE status = 'arrived';
UPDATE loads SET status = 'Delivered' WHERE status = 'delivered';
UPDATE loads SET status = 'Invoiced'  WHERE status = 'completed';
UPDATE loads SET status = 'Cancelled' WHERE status = 'cancelled';
-- Note: 'draft' has no original PascalCase equivalent (it was a new status added by migration).
-- Any rows with 'draft' are mapped to 'Planned' as the closest legacy state.
UPDATE loads SET status = 'Planned'   WHERE status = 'draft';

-- Step 3: Shrink ENUM back to original 12 PascalCase values
ALTER TABLE loads MODIFY COLUMN status ENUM(
  'Planned', 'Booked', 'Active', 'Departed', 'Arrived', 'Docked', 'Unloaded', 'Delivered',
  'Invoiced', 'Settled', 'Cancelled', 'CorrectionRequested'
) DEFAULT 'Planned';
