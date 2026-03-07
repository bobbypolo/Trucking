-- Migration: 003_enhance_dispatch_events
-- Description: Add actor_id, prior_state, next_state, correlation_id columns to dispatch_events
-- Author: recovery-program
-- Date: 2026-03-07
-- Story: R-P2-04

-- UP

ALTER TABLE dispatch_events ADD COLUMN actor_id VARCHAR(36) NOT NULL AFTER dispatcher_id;
ALTER TABLE dispatch_events ADD COLUMN prior_state VARCHAR(50) NULL AFTER event_type;
ALTER TABLE dispatch_events ADD COLUMN next_state VARCHAR(50) NULL AFTER prior_state;
ALTER TABLE dispatch_events ADD COLUMN correlation_id VARCHAR(36) NULL AFTER next_state;

CREATE INDEX idx_dispatch_events_load_id ON dispatch_events(load_id);
CREATE INDEX idx_dispatch_events_actor_id ON dispatch_events(actor_id);
CREATE INDEX idx_dispatch_events_correlation_id ON dispatch_events(correlation_id);

-- DOWN

DROP INDEX idx_dispatch_events_correlation_id ON dispatch_events;
DROP INDEX idx_dispatch_events_actor_id ON dispatch_events;
DROP INDEX idx_dispatch_events_load_id ON dispatch_events;

ALTER TABLE dispatch_events DROP COLUMN correlation_id;
ALTER TABLE dispatch_events DROP COLUMN next_state;
ALTER TABLE dispatch_events DROP COLUMN prior_state;
ALTER TABLE dispatch_events DROP COLUMN actor_id;
