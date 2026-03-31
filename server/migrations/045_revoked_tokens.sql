-- UP
CREATE TABLE IF NOT EXISTS revoked_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    firebase_uid VARCHAR(128) NOT NULL,
    revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason VARCHAR(255) NOT NULL DEFAULT 'admin_revocation'
);

CREATE INDEX idx_revoked_tokens_firebase_uid ON revoked_tokens (firebase_uid);

-- DOWN
DROP INDEX idx_revoked_tokens_firebase_uid ON revoked_tokens;
DROP TABLE IF EXISTS revoked_tokens;
