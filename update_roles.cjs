
const mysql = require('mysql2/promise');
require('dotenv').config({ path: './server/.env' });

async function run() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'trucklogix'
        });

        console.log('UPDATING ENUM...');
        await connection.query(`
            ALTER TABLE users MODIFY COLUMN role ENUM(
                'admin', 'driver', 'owner_operator', 'safety_manager', 'dispatcher', 'payroll_manager', 'customer',
                'OWNER_ADMIN', 'OPS', 'SAFETY_MAINT', 'FINANCE', 'SALES_CS',
                'ORG_OWNER_SUPER_ADMIN', 'OPS_MANAGER', 'SAFETY_COMPLIANCE', 'MAINTENANCE_MANAGER',
                'ACCOUNTING_AR', 'ACCOUNTING_AP', 'PAYROLL_SETTLEMENTS', 'DRIVER_PORTAL', 'FLEET_OO_ADMIN_PORTAL',
                'SALES_CUSTOMER_SERVICE'
            ) NOT NULL
        `);
        console.log('✅ User role ENUM updated successfully.');
        await connection.end();
    } catch (e) {
        console.error('❌ Update failed:', e.message);
    }
}

run();
