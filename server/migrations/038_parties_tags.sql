-- Migration 038: Add tags column to parties table for entity capabilities
-- Team 05: Onboarding entity model (T5-02)

-- UP
ALTER TABLE parties ADD COLUMN tags JSON DEFAULT NULL COMMENT 'Entity capability tags (e.g. ["fuel","maintenance","rental"])';

-- DOWN
ALTER TABLE parties DROP COLUMN tags;
