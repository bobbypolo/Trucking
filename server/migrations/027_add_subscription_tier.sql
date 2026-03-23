-- Migration: Add subscription_tier column to companies
-- UP

ALTER TABLE companies ADD COLUMN subscription_tier VARCHAR(30) DEFAULT 'Records Vault' AFTER subscription_status;

-- DOWN

ALTER TABLE companies DROP COLUMN subscription_tier;
