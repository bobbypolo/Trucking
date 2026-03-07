-- Migration: 004_idempotency_keys
-- Description: Creates the idempotency_keys table for request deduplication
-- Author: recovery-program
-- Date: 2026-03-07
-- Key format: {actor_id}:{endpoint}:{entity_id}:{nonce}
-- TTL: 24 hours (enforced at application level via expires_at column)

-- UP

CREATE TABLE IF NOT EXISTS idempotency_keys (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    idempotency_key VARCHAR(512) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    response_status INT NOT NULL,
    response_body TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    UNIQUE KEY uk_idempotency_key (idempotency_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- DOWN

DROP TABLE IF EXISTS idempotency_keys;
