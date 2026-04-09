-- UP
CREATE TABLE IF NOT EXISTS feature_flags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  flag_name VARCHAR(255) NOT NULL,
  flag_value TINYINT(1) NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by VARCHAR(255) NOT NULL,
  UNIQUE KEY uq_company_flag (company_id, flag_name),
  INDEX idx_feature_flags_company (company_id)
);

-- DOWN
DROP TABLE IF EXISTS feature_flags;
