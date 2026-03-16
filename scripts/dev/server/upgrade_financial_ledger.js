/**
 * MIGRATION: Unified Financial Ledger
 * Rationale: Implements the "Everything is a Financial Transaction" core rule.
 * Enables true P&L per load, per truck, and per driver with double-entry accounting.
 */

const mysql = require('mysql2/promise');

async function upgrade() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'trucklogix'
    });

    console.log('--- STARTING FINANCIAL LEDGER UPGRADE ---');

    // 1. Chart of Accounts (GL Accounts)
    await connection.query(`
        CREATE TABLE IF NOT EXISTS gl_accounts (
            id VARCHAR(50) PRIMARY KEY,
            tenant_id VARCHAR(50),
            account_number VARCHAR(20),
            name VARCHAR(100),
            type ENUM('Asset', 'Liability', 'Equity', 'Income', 'Expense'),
            category VARCHAR(50),
            sub_category VARCHAR(50),
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 2. Journal Entries (Transaction Headers)
    await connection.query(`
        CREATE TABLE IF NOT EXISTS journal_entries (
            id VARCHAR(50) PRIMARY KEY,
            tenant_id VARCHAR(50),
            entry_date DATE,
            reference_number VARCHAR(50),
            description TEXT,
            source_document_type ENUM('Invoice', 'Bill', 'Settlement', 'Fuel_Import', 'Manual'),
            source_document_id VARCHAR(50),
            posted_at TIMESTAMP,
            created_by VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 3. Journal Lines (Debits/Credits)
    await connection.query(`
        CREATE TABLE IF NOT EXISTS journal_lines (
            id VARCHAR(50) PRIMARY KEY,
            journal_entry_id VARCHAR(50),
            gl_account_id VARCHAR(50),
            debit DECIMAL(15, 2) DEFAULT 0,
            credit DECIMAL(15, 2) DEFAULT 0,
            allocation_type ENUM('Load', 'Truck', 'Trailer', 'Driver', 'Overhead'),
            allocation_id VARCHAR(50),
            notes VARCHAR(255),
            FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id)
        )
    `);

    // 4. AR Invoices
    await connection.query(`
        CREATE TABLE IF NOT EXISTS ar_invoices (
            id VARCHAR(50) PRIMARY KEY,
            tenant_id VARCHAR(50),
            customer_id VARCHAR(50),
            load_id VARCHAR(50),
            invoice_number VARCHAR(50),
            invoice_date DATE,
            due_date DATE,
            status ENUM('Draft', 'Sent', 'Partial', 'Paid', 'Void', 'Disputed'),
            total_amount DECIMAL(15, 2),
            balance_due DECIMAL(15, 2),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 5. AP Bills
    await connection.query(`
        CREATE TABLE IF NOT EXISTS ap_bills (
            id VARCHAR(50) PRIMARY KEY,
            tenant_id VARCHAR(50),
            vendor_id VARCHAR(50),
            bill_number VARCHAR(50),
            bill_date DATE,
            due_date DATE,
            status ENUM('Pending', 'Approved', 'Paid', 'Void'),
            total_amount DECIMAL(15, 2),
            balance_due DECIMAL(15, 2),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 6. Fuel Ledger (IFTA Support)
    await connection.query(`
        CREATE TABLE IF NOT EXISTS fuel_ledger (
            id VARCHAR(50) PRIMARY KEY,
            tenant_id VARCHAR(50),
            truck_id VARCHAR(50),
            driver_id VARCHAR(50),
            load_id VARCHAR(50),
            card_number VARCHAR(50),
            transaction_date DATETIME,
            state_code VARCHAR(5),
            gallons DECIMAL(10, 3),
            unit_price DECIMAL(10, 3),
            total_cost DECIMAL(15, 2),
            vendor_name VARCHAR(100),
            is_ifta_taxable BOOLEAN DEFAULT TRUE,
            is_billable_to_load BOOLEAN DEFAULT TRUE
        )
    `);

    // 7. Driver Settlements
    await connection.query(`
        CREATE TABLE IF NOT EXISTS driver_settlements (
            id VARCHAR(50) PRIMARY KEY,
            tenant_id VARCHAR(50),
            driver_id VARCHAR(50),
            settlement_date DATE,
            period_start DATE,
            period_end DATE,
            total_earnings DECIMAL(15, 2),
            total_deductions DECIMAL(15, 2),
            total_reimbursements DECIMAL(15, 2),
            net_pay DECIMAL(15, 2),
            status ENUM('Draft', 'Calculated', 'Approved', 'Paid')
        )
    `);

    console.log('--- TABLES CREATED SUCCESSFULLY ---');

    console.log('--- SEEDING INITIAL CHART OF ACCOUNTS ---');

    const coaSeed = [
        ['1000', 'Cash (Operating)', 'Asset', 'Cash'],
        ['1200', 'Accounts Receivable', 'Asset', 'Receivable'],
        ['1300', 'Fuel Advances Receivable', 'Asset', 'Receivable'],
        ['2000', 'Accounts Payable', 'Liability', 'Payable'],
        ['2100', 'Payroll Liabilities', 'Liability', 'Payable'],
        ['2200', 'IFTA Fuel Tax Payable', 'Liability', 'Payable'],
        ['4000', 'Linehaul Revenue', 'Income', 'Revenue'],
        ['4100', 'Fuel Surcharge Revenue', 'Income', 'Revenue'],
        ['4200', 'Accessorial Revenue', 'Income', 'Revenue'],
        ['5000', 'Driver Pay Expense', 'Expense', 'COGS'],
        ['5100', 'Fuel Expense', 'Expense', 'COGS'],
        ['5200', 'Lumper Fees', 'Expense', 'COGS'],
        ['5300', 'Maintenance - Load Related', 'Expense', 'COGS'],
        ['6000', 'Insurance Expense', 'Expense', 'Operating'],
        ['6100', 'Office/G&A Expense', 'Expense', 'Operating']
    ];

    for (const [num, name, type, cat] of coaSeed) {
        await connection.query(`
            INSERT INTO gl_accounts (id, tenant_id, account_number, name, type, category)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE name=VALUES(name)
        `, [`GL-${num}`, 'DEFAULT', num, name, type, cat]);
    }

    console.log('--- UPGRADE COMPLETE ---');
    process.exit(0);
}

upgrade().catch(err => {
    console.error(err);
    process.exit(1);
});
