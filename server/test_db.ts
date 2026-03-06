import pool from './db';

async function testConnection() {
    try {
        console.log('Attempting to connect to database...');
        const [rows] = await pool.query('SELECT 1 + 1 AS result');
        console.log('Connection successful! result:', (rows as any)[0].result);

        console.log('Checking tables...');
        const [tables] = await pool.query('SHOW TABLES');
        console.log('Tables:', tables);

        process.exit(0);
    } catch (error) {
        console.error('DATABASE CONNECTION FAILED:');
        console.error(error);
        process.exit(1);
    }
}

testConnection();
