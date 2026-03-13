import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Cloud SQL support: prefer Unix socket (DB_SOCKET_PATH) over TCP (DB_HOST + DB_PORT).
// DB_SOCKET_PATH is used exclusively for Cloud SQL Unix socket connections so that
// DB_HOST remains a clean TCP host value with no overloading.
const socketPath = process.env.DB_SOCKET_PATH;

const pool = mysql.createPool({
    // Use socketPath for Cloud SQL Unix socket; fall back to host:port for TCP.
    ...(socketPath
        ? { socketPath }
        : {
              host: process.env.DB_HOST!,
              port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
          }),
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
