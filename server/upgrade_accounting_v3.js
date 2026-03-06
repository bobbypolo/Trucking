const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function upgrade() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'trucklogix'
    });

    console.log('--- STARTING ACCOUNTING V3 UPGRADE ---');
    console.log(`Target Database: ${process.env.DB_NAME || 'trucklogix'}`);
    console.log(`Target Host: ${process.env.DB_HOST || 'localhost'}`);

    // 1. AR Invoice Lines
    await connection.query(`
        CREATE TABLE IF NOT EXISTS ar_invoice_lines (
            id VARCHAR(50) PRIMARY KEY,
            invoice_id VARCHAR(50),
            catalog_item_id VARCHAR(50),
            description TEXT,
            quantity DECIMAL(15, 2) DEFAULT 1,
            unit_price DECIMAL(15, 2),
            total_amount DECIMAL(15, 2),
            gl_account_id VARCHAR(50),
            FOREIGN KEY (invoice_id) REFERENCES ar_invoices(id) ON DELETE CASCADE
        )
    `);

    // 2. AP Bill Lines
    await connection.query(`
        CREATE TABLE IF NOT EXISTS ap_bill_lines (
            id VARCHAR(50) PRIMARY KEY,
            bill_id VARCHAR(50),
            description TEXT,
            amount DECIMAL(15, 2),
            allocation_type ENUM('Load', 'Truck', 'Trailer', 'Driver', 'Overhead'),
            allocation_id VARCHAR(50),
            gl_account_id VARCHAR(50),
            FOREIGN KEY (bill_id) REFERENCES ap_bills(id) ON DELETE CASCADE
        )
    `);

    // 3. Settlement Lines
    await connection.query(`
        CREATE TABLE IF NOT EXISTS settlement_lines (
            id VARCHAR(50) PRIMARY KEY,
            settlement_id VARCHAR(50),
            type ENUM('Earning', 'Deduction', 'Reimbursement'),
            description TEXT,
            amount DECIMAL(15, 2),
            load_id VARCHAR(50),
            gl_account_id VARCHAR(50),
            FOREIGN KEY (settlement_id) REFERENCES driver_settlements(id) ON DELETE CASCADE
        )
    `);

    // 4. Mileage By State (IFTA)
    await connection.query(`
        CREATE TABLE IF NOT EXISTS mileage_jurisdiction (
            id VARCHAR(50) PRIMARY KEY,
            truck_id VARCHAR(50),
            load_id VARCHAR(50),
            state_code VARCHAR(5),
            miles DECIMAL(15, 2),
            date DATE,
            source ENUM('Manual', 'ELD', 'Import') DEFAULT 'Manual'
        )
    `);

    // 5. Document Vault (Metadata)
    await connection.query(`
        CREATE TABLE IF NOT EXISTS document_vault (
            id VARCHAR(50) PRIMARY KEY,
            tenant_id VARCHAR(50),
            type ENUM('BOL', 'POD', 'Fuel', 'Lumper', 'Repair', 'Toll', 'Scale', 'Insurance', 'Permit', 'Other'),
            url TEXT,
            filename VARCHAR(255),
            file_size INT,
            mime_type VARCHAR(100),
            load_id VARCHAR(50),
            driver_id VARCHAR(50),
            truck_id VARCHAR(50),
            trailer_id VARCHAR(50),
            vendor_id VARCHAR(50),
            customer_id VARCHAR(50),
            amount DECIMAL(15, 2),
            date DATE,
            state_code VARCHAR(5),
            payment_method VARCHAR(50),
            status ENUM('Draft', 'Submitted', 'Approved', 'Locked') DEFAULT 'Draft',
            is_locked BOOLEAN DEFAULT FALSE,
            version INT DEFAULT 1,
            parent_doc_id VARCHAR(50),
            created_by VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `);

    // 6. QuickBooks Sync Log
    await connection.query(`
        CREATE TABLE IF NOT EXISTS sync_qb_log (
            id VARCHAR(50) PRIMARY KEY,
            tenant_id VARCHAR(50),
            entity_type ENUM('Invoice', 'Bill', 'Settlement', 'JournalEntry'),
            entity_id VARCHAR(50),
            qb_id VARCHAR(100),
            status ENUM('Pending', 'Success', 'Error'),
            error_message TEXT,
            synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 7. Adjustment Entries (for post-lock changes)
    await connection.query(`
        CREATE TABLE IF NOT EXISTS adjustment_entries (
            id VARCHAR(50) PRIMARY KEY,
            parent_entity_type ENUM('Invoice', 'Bill', 'Settlement'),
            parent_entity_id VARCHAR(50),
            reason_code VARCHAR(50),
            description TEXT,
            amount_adjustment DECIMAL(15, 2),
            created_by VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    console.log('--- UPGRADE COMPLETE ---');
    process.exit(0);
}

upgrade().catch(err => {
    console.error(err);
    process.exit(1);
});
