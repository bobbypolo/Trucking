import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
    host: process.env.DB_HOST!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_NAME!,
    waitForConnections: true,
    connectionLimit: 25,
    queueLimit: 100,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
});

export async function closePool(): Promise<void> {
    await pool.end();
}

export default pool;
