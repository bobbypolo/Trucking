-- Migration: 057_stop_status_tracking
-- Description: Add status ENUM, arrived_at, departed_at to load_legs for driver stop tracking
-- Author: ralph-worker
-- Date: 2026-04-12

-- UP
ALTER TABLE load_legs
  ADD COLUMN status ENUM('pending', 'arrived', 'departed', 'completed') NOT NULL DEFAULT 'pending' AFTER completed,
  ADD COLUMN arrived_at DATETIME NULL AFTER status,
  ADD COLUMN departed_at DATETIME NULL AFTER arrived_at;

-- DOWN
ALTER TABLE load_legs
  DROP COLUMN departed_at,
  DROP COLUMN arrived_at,
  DROP COLUMN status;
