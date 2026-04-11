-- UP
CREATE TABLE IF NOT EXISTS push_tokens (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  expo_push_token VARCHAR(255) NOT NULL,
  platform ENUM('ios','android') NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_token (user_id, expo_push_token),
  INDEX idx_push_tokens_user (user_id)
);

-- DOWN
DROP TABLE IF EXISTS push_tokens;
