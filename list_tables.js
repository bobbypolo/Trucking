
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });

async function check() {
    console.log('DB_HOST:', process.env.DB_HOST);
    console.log('DB_USER:', process.env.DB_USER);
    console.log('DB_NAME:', process.env.DB_NAME);

    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });
    try {
        const [tables] = await pool.query('SHOW TABLES');
        console.log('Tables:', tables.map(t => Object.values(t)[0]));
    } catch (e) {
        console.error('Database Check Error:', e);
    } finally {
        await pool.end();
    }
}
check();
