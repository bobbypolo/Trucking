
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config({ path: './server/.env' });

async function seed() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    try {
        console.log('Seeding Accounting Exception Types...');

        const exceptionTypes = [
            { code: 'MISSING_RECEIPT', name: 'Missing Receipt', group: 'Document Entry', team: 'ACCOUNTING_AP', severity: 3 },
            { code: 'RATE_MISMATCH', name: 'Rate Mismatch', group: 'Finance', team: 'ACCOUNTING_AR', severity: 4 },
            { code: 'UNASSIGNED_FUEL', name: 'Unassigned Fuel Purchase', group: 'Finance', team: 'FINANCE', severity: 2 },
            { code: 'NEGATIVE_MARGIN', name: 'Negative Margin Load', group: 'Finance', team: 'OPS_MANAGER', severity: 4 }
        ];

        for (const type of exceptionTypes) {
            await pool.query(
                'INSERT INTO exception_type (type_code, display_name, dashboard_group, default_owner_team, default_severity, default_sla_hours) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)',
                [type.code, type.name, type.group, type.team, type.severity, 24]
            );
        }

        console.log('Seeding Demo Exceptions...');
        const demoExceptions = [
            {
                id: uuidv4(),
                type: 'MISSING_RECEIPT',
                status: 'OPEN',
                severity: 3,
                entity_type: 'LOAD',
                entity_id: 'L-1001',
                description: 'Fuel receipt for $450.00 not found in vault for Transaction #TXN-9921',
                team: 'ACCOUNTING_AP'
            },
            {
                id: uuidv4(),
                type: 'RATE_MISMATCH',
                status: 'OPEN',
                severity: 4,
                entity_type: 'LOAD',
                entity_id: 'L-1002',
                description: 'Invoice amount ($2,500) exceeds Rate Confirmation ($2,100)',
                team: 'ACCOUNTING_AR'
            },
            {
                id: uuidv4(),
                type: 'NEGATIVE_MARGIN',
                status: 'OPEN',
                severity: 4,
                entity_type: 'LOAD',
                entity_id: 'L-1005',
                description: 'Estimated load margin is -12% due to high detention and repair costs',
                team: 'OPS_MANAGER'
            }
        ];

        for (const ex of demoExceptions) {
            await pool.query(
                'INSERT INTO exceptions (id, tenant_id, type, status, severity, entity_type, entity_id, description, team, sla_due_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))',
                [ex.id, 'DEFAULT', ex.type, ex.status, ex.severity, ex.entity_type, ex.entity_id, ex.description, ex.team]
            );
        }

        console.log('Successfully seeded accounting exceptions.');
    } catch (e) {
        console.error('Seeding Error:', e);
    } finally {
        await pool.end();
    }
}

seed();
