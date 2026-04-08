-- UP
ALTER TABLE loads ADD COLUMN intake_source VARCHAR(20) DEFAULT 'dispatcher';

-- DOWN
ALTER TABLE loads DROP COLUMN intake_source;
