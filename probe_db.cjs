
const mysql = require('mysql2/promise');

async function probe() {
    const ports = [3306, 3307, 3308, 3309, 8889, 8888];
    for (const port of ports) {
        try {
            console.log(`Probing port ${port}...`);
            const connection = await mysql.createConnection({
                host: '127.0.0.1',
                port: port,
                user: 'root',
                password: 'admin' // Trying 'admin' since it was in root .env
            });
            console.log(`✅ SUCCESS on port ${port}!`);
            const [rows] = await connection.query('SHOW DATABASES');
            console.log('Databases:', rows.map(r => r.Database));
            await connection.end();
            return;
        } catch (e) {
            console.log(`❌ Port ${port} failed: ${e.code || e.message}`);
        }
    }
    console.log('All ports failed.');
}

probe();
