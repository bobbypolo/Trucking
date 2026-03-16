
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config({ path: '../.env' });

async function check() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'trucklogix',
    });
    try {
        const [rows] = await pool.query('SELECT * FROM users');
        console.log('Users found:', rows.length);
        console.log(JSON.stringify(rows[0], null, 2));
    } catch (e) {
        console.error('Database Check Error:', e.message);
    } finally {
        await pool.end();
    }
}
check();
