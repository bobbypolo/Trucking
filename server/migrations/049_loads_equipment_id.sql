-- Migration 049 — loads.equipment_id
-- Adds a persisted equipment reference column to loads so dispatcher intake
-- and state-machine dispatch guards can use it as the canonical equipment identifier.

-- UP
ALTER TABLE loads ADD COLUMN equipment_id VARCHAR(36) DEFAULT NULL;
ALTER TABLE loads ADD CONSTRAINT fk_loads_equipment_id FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE SET NULL;
CREATE INDEX idx_loads_equipment_id ON loads (equipment_id);

-- DOWN
DROP INDEX idx_loads_equipment_id ON loads;
ALTER TABLE loads DROP FOREIGN KEY fk_loads_equipment_id;
ALTER TABLE loads DROP COLUMN equipment_id;
