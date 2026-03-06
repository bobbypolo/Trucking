
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config({ path: './server/.env' });

async function upgrade() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'trucklogix'
    });

    console.log('--- STARTING IFTA INTELLIGENCE UPGRADE ---');

    // 1. Trip Evidence Timeline
    await connection.query(`
        CREATE TABLE IF NOT EXISTS ifta_trip_evidence (
            id VARCHAR(50) PRIMARY KEY,
            truck_id VARCHAR(50),
            load_id VARCHAR(50),
            timestamp TIMESTAMP,
            event_type ENUM('GPS_PING', 'CHECK_IN', 'FUEL_STOP', 'MANIFEST_LEG', 'BORDER_CROSSING'),
            lat DECIMAL(10, 8),
            lng DECIMAL(11, 8),
            odometer DECIMAL(15, 2),
            state_code VARCHAR(10),
            source VARCHAR(100),
            raw_payload JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 2. IFTA Audit Records (Locked Trips)
    await connection.query(`
        CREATE TABLE IF NOT EXISTS ifta_trips_audit (
            id VARCHAR(50) PRIMARY KEY,
            truck_id VARCHAR(50),
            load_id VARCHAR(50),
            trip_date DATE,
            start_time TIMESTAMP NULL,
            end_time TIMESTAMP NULL,
            start_odometer DECIMAL(15, 2),
            end_odometer DECIMAL(15, 2),
            total_total_miles DECIMAL(15, 2),
            method ENUM('ACTUAL_GPS', 'HYBRID', 'RECONSTRUCTED') DEFAULT 'RECONSTRUCTED',
            confidence_level ENUM('HIGH', 'MEDIUM', 'LOW') DEFAULT 'LOW',
            route_meta JSON,
            jurisdiction_miles JSON,
            attested_by VARCHAR(100),
            attested_at TIMESTAMP NULL,
            status ENUM('DRAFT', 'LOCKED') DEFAULT 'DRAFT',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    console.log('--- IFTA INTELLIGENCE UPGRADE COMPLETE ---');
    process.exit(0);
}

upgrade().catch(err => {
    console.error(err);
    process.exit(1);
});
