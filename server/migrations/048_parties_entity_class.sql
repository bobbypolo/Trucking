-- UP

-- Parties Entity Class + Vendor Profile
-- Source: server/routes/clients.ts POST /api/parties (vendor_profile) and GET /api/parties (entity_class filter)
--
-- Additive migration: adds two nullable columns and one compound index.
-- Does NOT rewrite existing rows; GET /api/parties already tolerates NULL entity_class
-- via normalizeEntityClass() in server/schemas/parties.ts.
--
-- Reference migrations:
--   032_parties_subsystem.sql     — original parties table
--   037_fix_parties_fk.sql        — fk cleanup
--   038_parties_tags.sql          — tags JSON column
--   040_parties_tags.sql          — tags backfill

ALTER TABLE parties
  ADD COLUMN entity_class VARCHAR(50) DEFAULT NULL,
  ADD COLUMN vendor_profile JSON DEFAULT NULL,
  ADD INDEX idx_parties_entity_class (company_id, entity_class);

-- DOWN
ALTER TABLE parties
  DROP INDEX idx_parties_entity_class,
  DROP COLUMN entity_class,
  DROP COLUMN vendor_profile;
