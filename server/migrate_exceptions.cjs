const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function migrate() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'trucklogix',
        multipleStatements: true
    });

    console.log('--- STARTING EXCEPTION MANAGEMENT MIGRATION ---');

    const sqlPath = path.join(__dirname, 'migrations', 'exception_management.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    try {
        await connection.query(sql);
        console.log('--- MIGRATION COMPLETE ---');
    } catch (err) {
        console.error('--- MIGRATION FAILED ---');
        console.error(err);
    } finally {
        await connection.end();
        process.exit(0);
    }
}

migrate();
