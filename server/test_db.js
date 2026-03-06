const mysql = require('mysql2/promise');

async function test() {
    try {
        const connection = await mysql.createConnection({
            host: '127.0.0.1',
            user: 'root',
            password: '',
        });
        const [rows] = await connection.query('SHOW DATABASES');
        console.log(rows);
        await connection.end();
    } catch (err) {
        console.error(err);
    }
}
test();
