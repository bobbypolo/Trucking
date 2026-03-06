const mysql = require('mysql2/promise');

async function upgrade() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'trucklogix'
  });

  console.log('Starting Unified Network Engine migration...');

  try {
    // 1. Catalog Hierarchy
    await connection.query(`
      CREATE TABLE IF NOT EXISTS catalog_categories (
        id VARCHAR(50) PRIMARY KEY,
        tenant_id VARCHAR(50) NOT NULL,
        parent_id VARCHAR(50),
        name VARCHAR(100) NOT NULL,
        type ENUM('Service', 'Equipment', 'Product', 'Accessorial', 'Facility_Fee') NOT NULL,
        INDEX idx_tenant (tenant_id)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS catalog_items (
        id VARCHAR(50) PRIMARY KEY,
        tenant_id VARCHAR(50) NOT NULL,
        category_id VARCHAR(50) NOT NULL,
        item_code VARCHAR(50) NOT NULL,
        item_name VARCHAR(100) NOT NULL,
        kind ENUM('Service', 'Equipment_Type', 'Product', 'Accessorial', 'Facility_Fee') NOT NULL,
        active BOOLEAN DEFAULT TRUE,
        attributes_json JSON,
        INDEX idx_category (category_id),
        INDEX idx_tenant_code (tenant_id, item_code)
      )
    `);

    // 2. Unit Pricing (Rate Tables)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS rate_rows (
        id VARCHAR(50) PRIMARY KEY,
        tenant_id VARCHAR(50) NOT NULL,
        party_id VARCHAR(50) NOT NULL,
        catalog_item_id VARCHAR(50) NOT NULL,
        variant_id VARCHAR(50),
        direction ENUM('AR', 'AP') NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        price_type ENUM('Flat', 'Per_Unit', 'Base_Plus_Variable', 'Tiered', 'Matrix') NOT NULL,
        unit_type ENUM('Mile', 'Hour', 'Day', 'Stop', 'Load', 'Piece', 'Pallet', 'LB', 'Ton', 'Event'),
        base_amount DECIMAL(19,4),
        unit_amount DECIMAL(19,4),
        min_charge DECIMAL(19,4),
        max_charge DECIMAL(19,4),
        free_units DECIMAL(19,4),
        effective_start DATETIME NOT NULL,
        effective_end DATETIME,
        taxable_flag BOOLEAN DEFAULT FALSE,
        rounding_rule VARCHAR(50),
        notes_internal TEXT,
        approval_required BOOLEAN DEFAULT FALSE,
        INDEX idx_party_direction (party_id, direction),
        INDEX idx_catalog_item (catalog_item_id)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS rate_tiers (
        id VARCHAR(50) PRIMARY KEY,
        rate_row_id VARCHAR(50) NOT NULL,
        tier_start DECIMAL(19,4) NOT NULL,
        tier_end DECIMAL(19,4),
        unit_amount DECIMAL(19,4) NOT NULL,
        base_amount DECIMAL(19,4),
        INDEX idx_rate_row (rate_row_id)
      )
    `);

    // 3. Operational Constraints
    await connection.query(`
      CREATE TABLE IF NOT EXISTS constraint_sets (
        id VARCHAR(50) PRIMARY KEY,
        tenant_id VARCHAR(50) NOT NULL,
        party_id VARCHAR(50) NOT NULL,
        applies_to ENUM('Party', 'Catalog_Item', 'Equipment_Type', 'Facility', 'Lane') NOT NULL,
        priority INT DEFAULT 0,
        status ENUM('Active', 'Inactive') DEFAULT 'Active',
        effective_start DATETIME NOT NULL,
        effective_end DATETIME,
        INDEX idx_party (party_id)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS constraint_rules (
        id VARCHAR(50) PRIMARY KEY,
        constraint_set_id VARCHAR(50) NOT NULL,
        rule_type ENUM('Time', 'Geo', 'Equipment', 'Capacity', 'Compliance', 'Operational') NOT NULL,
        field_key VARCHAR(100) NOT NULL,
        operator ENUM('=', '!=', 'IN', 'NOT_IN', '>=', '<=', 'EXISTS') NOT NULL,
        value_text TEXT,
        enforcement ENUM('Block', 'Warn', 'Require_Approval') DEFAULT 'Block',
        message TEXT,
        INDEX idx_set (constraint_set_id)
      )
    `);

    // 4. Extensible Schema (Custom Fields)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS custom_field_defs (
        id VARCHAR(50) PRIMARY KEY,
        tenant_id VARCHAR(50) NOT NULL,
        scope ENUM('Party', 'Catalog_Item', 'Rate_Row', 'Constraint_Rule', 'Equipment_Asset', 'Facility') NOT NULL,
        field_key VARCHAR(100) NOT NULL,
        label VARCHAR(100) NOT NULL,
        data_type ENUM('Text', 'Number', 'Currency', 'Date', 'Boolean', 'Enum', 'Reference') NOT NULL,
        required_flag BOOLEAN DEFAULT FALSE,
        default_value TEXT,
        validation_regex TEXT,
        searchable_flag BOOLEAN DEFAULT TRUE,
        INDEX idx_tenant_scope (tenant_id, scope)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS custom_field_vals (
        id VARCHAR(50) PRIMARY KEY,
        tenant_id VARCHAR(50) NOT NULL,
        scope ENUM('Party', 'Catalog_Item', 'Rate_Row', 'Constraint_Rule', 'Equipment_Asset', 'Facility') NOT NULL,
        entity_id VARCHAR(50) NOT NULL,
        field_def_id VARCHAR(50) NOT NULL,
        value_text TEXT,
        INDEX idx_entity (entity_id),
        INDEX idx_field_def (field_def_id)
      )
    `);

    // 5. Equipment
    await connection.query(`
      CREATE TABLE IF NOT EXISTS equipment_assets (
        id VARCHAR(50) PRIMARY KEY,
        tenant_id VARCHAR(50) NOT NULL,
        type_id VARCHAR(50) NOT NULL,
        provider_party_id VARCHAR(50) NOT NULL,
        unit_number VARCHAR(50) NOT NULL,
        vin VARCHAR(50),
        plate VARCHAR(50),
        status ENUM('Available', 'Reserved', 'Out_Of_Service') DEFAULT 'Available',
        capabilities_json JSON,
        INDEX idx_provider (provider_party_id),
        INDEX idx_type (type_id)
      )
    `);

    // 6. Party Catalog Links (Relationship Browser support)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS party_catalog_links (
        id VARCHAR(50) PRIMARY KEY,
        party_id VARCHAR(50) NOT NULL,
        catalog_item_id VARCHAR(50) NOT NULL,
        relationship_type ENUM('Offers', 'Uses', 'Preferred') DEFAULT 'Offers',
        INDEX idx_party (party_id),
        INDEX idx_item (catalog_item_id)
      )
    `);

    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await connection.end();
  }
}

upgrade();
