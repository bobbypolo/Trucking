-- UP

ALTER TABLE users
  ADD COLUMN home_terminal_lat DECIMAL(10,7) NULL,
  ADD COLUMN home_terminal_lng DECIMAL(11,7) NULL;

-- DOWN
ALTER TABLE users
  DROP COLUMN home_terminal_lat,
  DROP COLUMN home_terminal_lng;
