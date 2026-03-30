-- Migration 043: Encrypt existing plaintext tracking provider secrets
-- Phase 5 S-5.2: Encrypt api_token and webhook_secret at rest
--
-- NOTE: This migration is a schema-level marker. The actual encryption of
-- existing plaintext values must be performed by a Node.js migration script
-- because SQL alone cannot call AES-256-GCM encryption with the application's
-- key management. The application code handles encryption on read/write:
--
-- 1. New values: encrypted on INSERT/UPDATE via encryptSecret()
-- 2. Existing plaintext: detected by missing "enc:" prefix and handled
--    gracefully (decrypt falls back to raw value during transition)
-- 3. A one-time migration script should be run to encrypt legacy values:
--    node -e "require('./server/scripts/encrypt-tracking-secrets.js').run()"
--
-- This SQL migration widens the columns to accommodate base64-encoded
-- ciphertext which is longer than the original plaintext.

-- UP

-- Widen api_token column to accommodate encrypted values (base64 expands ~4/3x + prefix)
-- Already TEXT type, no change needed for api_token

-- Widen webhook_secret from VARCHAR(255) to TEXT to accommodate encrypted values
ALTER TABLE tracking_provider_configs MODIFY COLUMN webhook_secret TEXT;

-- DOWN

ALTER TABLE tracking_provider_configs MODIFY COLUMN webhook_secret VARCHAR(255);
