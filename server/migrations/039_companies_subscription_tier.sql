-- Migration: Add subscription_tier to companies and seed supported dev tenants
-- UP

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(30) DEFAULT 'Records Vault' AFTER subscription_status;

UPDATE companies
   SET subscription_tier = 'Fleet Core'
 WHERE id IN (
   '02770dbb-afe0-42e4-b867-ff2d690f7286',
   '43a60d50-e282-4c4c-a193-81897cac35e9',
   '852c2a65-9a0a-4bab-b482-a3fc79e1d506',
   'c98895d7-b724-41ff-a51d-13e45b9101ab',
   'dev-company-001'
 );

-- DOWN

UPDATE companies
   SET subscription_tier = 'Records Vault'
 WHERE id IN (
   '02770dbb-afe0-42e4-b867-ff2d690f7286',
   '43a60d50-e282-4c4c-a193-81897cac35e9',
   '852c2a65-9a0a-4bab-b482-a3fc79e1d506',
   'c98895d7-b724-41ff-a51d-13e45b9101ab',
   'dev-company-001'
 );

ALTER TABLE companies DROP COLUMN IF EXISTS subscription_tier;
