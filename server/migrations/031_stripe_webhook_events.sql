-- UP
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id VARCHAR(255) PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  processed_at DATETIME NOT NULL
);

-- DOWN
DROP TABLE IF EXISTS stripe_webhook_events;
