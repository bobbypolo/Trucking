const mysql = require('mysql2/promise');
require('dotenv').config();

async function upgrade() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'trucklogix'
    });

    console.log('Adding driver_visibility_settings to companies table...');

    try {
        await connection.query(`
      ALTER TABLE companies 
      ADD COLUMN driver_visibility_settings JSON AFTER accessorial_rates
    `);
        console.log('Migration completed successfully.');
    } catch (error) {
        if (error.code === 'ER_DUP_COLUMN_NAME') {
            console.log('Column driver_visibility_settings already exists.');
        } else {
            console.error('Migration failed:', error);
        }
    } finally {
        await connection.end();
    }
}

upgrade();
