
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: './server/.env' });

async function seed() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'trucklogix'
    });

    const COMPANY_ID = 'iscope-authority-001';

    // User IDs
    const DISPATCHER_ID = 'disp-001';
    const SAFETY_ID = 'safety-001';
    const DRIVER_1_ID = 'drv-001'; // John Roadrunner
    const DRIVER_2_ID = 'drv-002'; // Alex Trucker (The Repower Driver)

    // Customer ID
    const CLIENT_ID = 'cust-fresh-001';

    console.log('--- STARTING COMPREHENSIVE SAFETY & DISPATCH SEEDING ---');

    try {
        const hashedPassword = await bcrypt.hash('admin123', 10);

        // 1. Company
        await connection.query(
            'REPLACE INTO companies (id, name, account_type, subscription_status, operating_mode) VALUES (?, ?, ?, ?, ?)',
            [COMPANY_ID, 'KCI TruckLogix Pro', 'fleet', 'active', 'Enterprise']
        );

        // 2. Dispatcher & Safety
        await connection.query(
            'REPLACE INTO users (id, company_id, email, password, name, role, onboarding_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [DISPATCHER_ID, COMPANY_ID, 'dispatcher@loadpilot.com', hashedPassword, 'Sarah Dispatcher', 'dispatcher', 'Completed']
        );
        await connection.query(
            'REPLACE INTO users (id, company_id, email, password, name, role, onboarding_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [SAFETY_ID, COMPANY_ID, 'safety@loadpilot.com', hashedPassword, 'Alex Safety Manager', 'safety_manager', 'Completed']
        );

        // 3. Drivers (Roster)
        await connection.query(
            'REPLACE INTO users (id, company_id, email, password, name, role, onboarding_status, safety_score, pay_model, pay_rate, compliance_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [DRIVER_1_ID, COMPANY_ID, 'driver1@loadpilot.com', hashedPassword, 'John Roadrunner', 'driver', 'Completed', 98, 'percent', 25.00, 'Eligible']
        );
        await connection.query(
            'REPLACE INTO users (id, company_id, email, password, name, role, onboarding_status, safety_score, pay_model, pay_rate, compliance_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [DRIVER_2_ID, COMPANY_ID, 'driver2@loadpilot.com', hashedPassword, 'Alex Trucker', 'driver', 'Completed', 95, 'mileage', 0.65, 'Eligible']
        );

        // 4. Equipment Assigned to Fleet
        const truck1Id = 'trn-101';
        const trailer1Id = 'tlr-5001';
        await connection.query('REPLACE INTO equipment (id, company_id, unit_number, type, status, ownership_type, provider_name, daily_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [truck1Id, COMPANY_ID, 'TR-101', 'Truck', 'Active', 'Owned', 'Freightliner', 150.00]);
        await connection.query('REPLACE INTO equipment (id, company_id, unit_number, type, status, ownership_type, provider_name, daily_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [trailer1Id, COMPANY_ID, 'TL-5001', 'Trailer', 'Active', 'Leased', 'Utility', 75.00]);

        await connection.query('REPLACE INTO equipment (id, company_id, unit_number, type, status, ownership_type, provider_name, daily_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            ['trn-102', COMPANY_ID, 'TR-102', 'Truck', 'Active', 'Owned', 'Peterbilt', 180.00]);

        // 5. Compliance Records (Safety Roster Health)
        await connection.query('REPLACE INTO compliance_records (id, user_id, type, expiry_date, status) VALUES (?, ?, ?, ?, ?)',
            [uuidv4(), DRIVER_1_ID, 'CDL', '2028-12-01', 'Valid']);
        await connection.query('REPLACE INTO compliance_records (id, user_id, type, expiry_date, status) VALUES (?, ?, ?, ?, ?)',
            [uuidv4(), DRIVER_1_ID, 'Medical_Card', '2026-06-01', 'Valid']);
        await connection.query('REPLACE INTO compliance_records (id, user_id, type, expiry_date, status) VALUES (?, ?, ?, ?, ?)',
            [uuidv4(), DRIVER_2_ID, 'CDL', '2027-05-15', 'Valid']);

        // 6. Leads & Quotes (Stem from quotes)
        const leadId = 'lead-001';
        await connection.query(
            'REPLACE INTO leads (id, company_id, customer_name, caller_name, caller_phone, notes) VALUES (?, ?, ?, ?, ?, ?)',
            [leadId, COMPANY_ID, 'Fresh Foods Logistics', 'Mark Spencer', '555-0199', 'Perishable organic produce contract Kansas -> Denver']
        );

        const quoteId = 'quote-001';
        await connection.query(
            'REPLACE INTO quotes (id, lead_id, company_id, status, pickup_city, pickup_state, dropoff_city, dropoff_state, total_rate, linehaul, fuel_surcharge) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [quoteId, leadId, COMPANY_ID, 'Accepted', 'Kansas City', 'MO', 'Denver', 'CO', 4500.00, 3800.00, 700.00]
        );

        const bookingId = 'book-001';
        await connection.query(
            'REPLACE INTO bookings (id, quote_id, company_id, status) VALUES (?, ?, ?, ?)',
            [bookingId, quoteId, COMPANY_ID, 'Ready_for_Dispatch']
        );

        // 7. Client
        await connection.query(
            'REPLACE INTO customers (id, company_id, name, type, email, phone, address) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [CLIENT_ID, COMPANY_ID, 'Fresh Foods Logistics', 'Direct Customer', 'ops@freshfoods.com', '555-FOOD-01', '500 Cold Storage Blvd, Kansas City, MO']
        );

        // 8. Load (LP-REPOWER-101) - Tying it all together
        const loadId = 'load-repower-101';
        await connection.query(
            'REPLACE INTO loads (id, company_id, customer_id, driver_id, dispatcher_id, load_number, status, carrier_rate, pickup_date, freight_type, commodity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [loadId, COMPANY_ID, CLIENT_ID, DRIVER_1_ID, DISPATCHER_ID, 'LP-REPOWER-101', 'Active', 4500.00, '2026-01-15', 'Reefer', 'Organic Produce']
        );

        // Add Legs
        await connection.query('DELETE FROM load_legs WHERE load_id = ?', [loadId]);
        await connection.query('INSERT INTO load_legs (id, load_id, type, facility_name, city, state, sequence_order) VALUES (?, ?, ?, ?, ?, ?, ?)', [uuidv4(), loadId, 'Pickup', 'KC Cold Storage', 'Kansas City', 'MO', 1]);
        await connection.query('INSERT INTO load_legs (id, load_id, type, facility_name, city, state, sequence_order) VALUES (?, ?, ?, ?, ?, ?, ?)', [uuidv4(), loadId, 'Dropoff', 'Denver Distribution', 'Denver', 'CO', 2]);

        // 9. Time Logs (Roster Visibility)
        await connection.query('DELETE FROM driver_time_logs WHERE user_id IN (?, ?)', [DRIVER_1_ID, DRIVER_2_ID]);
        await connection.query(
            'INSERT INTO driver_time_logs (id, user_id, load_id, activity_type, location_lat, location_lng, clock_in) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [uuidv4(), DRIVER_1_ID, loadId, 'DRIVING', 38.8794, -99.3267, new Date().toISOString()]
        );
        await connection.query(
            'INSERT INTO driver_time_logs (id, user_id, activity_type, location_lat, location_lng, clock_in) VALUES (?, ?, ?, ?, ?, ?)',
            [uuidv4(), DRIVER_2_ID, 'ON_DUTY', 38.8403, -97.6114, new Date().toISOString()]
        );

        // 10. THE INCIDENTS
        const incidentId = 'inc-breakdown-101';
        await connection.query(
            'REPLACE INTO incidents (id, load_id, type, severity, status, description, location_lat, location_lng, recovery_plan) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [incidentId, loadId, 'Breakdown', 'Critical', 'Open', 'Driver reports engine overheating and white smoke from hood.', 38.8794, -99.3267, 'REPOWER REQUIRED: Cargo is perishable organic produce.']
        );

        const incident2Id = 'inc-accident-202';
        await connection.query(
            'REPLACE INTO incidents (id, load_id, type, severity, status, description, location_lat, location_lng, recovery_plan) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [incident2Id, loadId, 'Accident', 'High', 'In_Progress', 'Minor fender bender at truck stop.', 38.8794, -99.3267, 'Documentation collection and vehicle inspection.']
        );

        // 11. CHAIN OF CUSTODY (Incident Actions)
        await connection.query('DELETE FROM incident_actions WHERE incident_id IN (?, ?)', [incidentId, incident2Id]);
        const actions = [
            { id: uuidv4(), incId: incidentId, action: 'INCIDENT_REPORTED', actor: 'John Roadrunner', notes: 'Initial report: Cooling system failure.' },
            { id: uuidv4(), incId: incidentId, action: 'SAFETY_TRIAGE', actor: 'Alex Safety Manager', notes: 'Critical due to reefer cargo.' },
            { id: uuidv4(), incId: incident2Id, action: 'ACCIDENT_REPORTED', actor: 'John Roadrunner', notes: 'Fender bender at Love\'s Travel Stop.' }
        ];

        for (const act of actions) {
            await connection.query(
                'INSERT INTO incident_actions (id, incident_id, actor_name, action, notes) VALUES (?, ?, ?, ?, ?)',
                [act.id, act.incId, act.actor, act.action, act.notes]
            );
        }

        // 12. WORK ITEMS
        await connection.query('DELETE FROM work_items WHERE company_id = ?', [COMPANY_ID]);
        await connection.query(
            'INSERT INTO work_items (id, company_id, type, priority, label, description, entity_id, entity_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [uuidv4(), COMPANY_ID, 'SAFETY_ALARM', 'High', `Breakdown: TR-101`, `Engine failure at Hays, KS.`, incidentId, 'INCIDENT']
        );
        await connection.query(
            'INSERT INTO work_items (id, company_id, type, priority, label, description, entity_id, entity_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [uuidv4(), COMPANY_ID, 'LOAD_EXCEPTION', 'High', `Lateness Risk: LP-REPOWER-101`, `Repower matching active.`, loadId, 'LOAD']
        );

        // 13. VENDORS & COSTS
        await connection.query('DELETE FROM emergency_charges WHERE incident_id IN (?, ?)', [incidentId, incident2Id]);
        await connection.query(
            'INSERT INTO emergency_charges (id, incident_id, category, amount, provider_vendor, status) VALUES (?, ?, ?, ?, ?, ?)',
            [uuidv4(), incidentId, 'Tow', 850.00, 'Salina Heavy Towing', 'Pending_Approval']
        );

        console.log('✔ DATA SEEDING COMPLETE: Dispatch, Safety, Roster, and Quotes fully synchronized.');

    } catch (e) {
        console.error('❌ SEEDING FAILED:', e);
    } finally {
        await connection.end();
    }
}

seed();
