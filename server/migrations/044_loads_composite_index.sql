-- UP
CREATE INDEX idx_loads_company_status_deleted ON loads (company_id, status, deleted_at);

-- DOWN
DROP INDEX idx_loads_company_status_deleted ON loads;
