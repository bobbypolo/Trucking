-- Migration 056: Message Threading + Read State
-- Adds read_at to messages for read receipts, participant_ids to threads for thread membership
-- UP

ALTER TABLE messages ADD COLUMN read_at DATETIME NULL;

ALTER TABLE threads ADD COLUMN participant_ids JSON;

ALTER TABLE threads ADD COLUMN load_id VARCHAR(36);

ALTER TABLE threads ADD INDEX idx_threads_load (company_id, load_id);

-- DOWN

ALTER TABLE threads DROP INDEX idx_threads_load;

ALTER TABLE threads DROP COLUMN load_id;

ALTER TABLE threads DROP COLUMN participant_ids;

ALTER TABLE messages DROP COLUMN read_at;
