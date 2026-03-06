const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    let pool;
    try {
        pool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            connectionLimit: 1
        });

        console.log('Updating parties table...');
        await pool.query(`
            ALTER TABLE parties 
            ADD COLUMN is_customer BOOLEAN DEFAULT FALSE AFTER type,
            ADD COLUMN is_vendor BOOLEAN DEFAULT FALSE AFTER is_customer,
            MODIFY COLUMN type ENUM('Shipper', 'Broker', 'Carrier', 'Vendor_Service', 'Vendor_Equipment', 'Facility', 'Vendor_Product') NOT NULL
        `);

        console.log('Creating equipment_types table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS equipment_types (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                category ENUM('Van', 'Box_Truck', 'Tractor', 'Dry_Van', 'Reefer', 'Flatbed', 'Power_Only', 'Other') NOT NULL,
                capacity_range VARCHAR(100),
                required_docs TEXT
            )
        `);

        console.log('Creating equipment_assets table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS equipment_assets (
                id VARCHAR(50) PRIMARY KEY,
                type_id VARCHAR(50) NOT NULL,
                unit_number VARCHAR(50) NOT NULL,
                provider_id VARCHAR(50) NOT NULL,
                status ENUM('Available', 'Reserved', 'Out_Of_Service') DEFAULT 'Available',
                vin VARCHAR(100),
                plate VARCHAR(50),
                capabilities TEXT,
                FOREIGN KEY (type_id) REFERENCES equipment_types(id),
                FOREIGN KEY (provider_id) REFERENCES parties(id) ON DELETE CASCADE
            )
        `);

        console.log('Creating vendor_profiles table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS vendor_profiles (
                party_id VARCHAR(50) PRIMARY KEY,
                offering_types TEXT, -- JSON array ['Service', 'Equipment', 'Product']
                payment_method VARCHAR(100),
                banking_reference TEXT,
                tax_id VARCHAR(50),
                FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE
            )
        `);

        console.log('Creating vendor_catalog table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS vendor_catalog (
                id VARCHAR(50) PRIMARY KEY,
                vendor_id VARCHAR(50) NOT NULL,
                name VARCHAR(255) NOT NULL,
                category VARCHAR(100) NOT NULL,
                rate_type ENUM('Flat', 'Hourly', 'PerMile', 'Unit') DEFAULT 'Flat',
                rate_value DECIMAL(15,2) DEFAULT 0,
                description TEXT,
                FOREIGN KEY (vendor_id) REFERENCES parties(id) ON DELETE CASCADE
            )
        `);

        console.log('Creating party_preferred_partners table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS party_preferred_partners (
                id VARCHAR(50) PRIMARY KEY,
                party_id VARCHAR(50) NOT NULL,
                partner_id VARCHAR(50) NOT NULL,
                partner_type ENUM('Vendor', 'Equipment') NOT NULL,
                FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE
            )
        `);

        console.log('Database upgrade completed.');
    } catch (e) {
        console.error('Error upgrading database:', e);
    } finally {
        if (pool) await pool.end();
        process.exit();
    }
}

run();
