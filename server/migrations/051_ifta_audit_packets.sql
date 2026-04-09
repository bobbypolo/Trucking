-- UP
CREATE TABLE ifta_audit_packets (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    company_id VARCHAR(64) NOT NULL,
    quarter TINYINT NOT NULL,
    tax_year SMALLINT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'generated',
    packet_hash CHAR(64) NOT NULL,
    download_url VARCHAR(512) NOT NULL,
    created_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    packet_bytes LONGBLOB NULL,
    INDEX idx_ifta_audit_packets_company_quarter (company_id, tax_year, quarter)
);

-- DOWN
DROP TABLE ifta_audit_packets;
