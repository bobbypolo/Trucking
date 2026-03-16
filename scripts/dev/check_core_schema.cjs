
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const checkDb = async () => {
    try {
        const pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: '',
            database: process.env.DB_NAME || 'trucklogix',
        });

        const tables = ['loads', 'customers', 'companies', 'users'];

        for (const tableName of tables) {
            console.log(`\n--- SCHEMA: ${tableName} ---`);
            const [columns] = await pool.query(`DESCRIBE ${tableName}`);
            console.log(columns.map(c => `${c.Field} (${c.Type})`).join(', '));
        }

        await pool.end();
    } catch (error) {
        console.error('DB Check Failed:', error);
    }
};

checkDb();
