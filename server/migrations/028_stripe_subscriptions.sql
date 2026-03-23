-- UP
ALTER TABLE companies ADD COLUMN stripe_customer_id VARCHAR(255) NULL AFTER subscription_status;
ALTER TABLE companies ADD COLUMN stripe_subscription_id VARCHAR(255) NULL AFTER stripe_customer_id;
ALTER TABLE companies ADD COLUMN subscription_period_end DATETIME NULL AFTER stripe_subscription_id;

-- DOWN
ALTER TABLE companies DROP COLUMN subscription_period_end;
ALTER TABLE companies DROP COLUMN stripe_subscription_id;
ALTER TABLE companies DROP COLUMN stripe_customer_id;
