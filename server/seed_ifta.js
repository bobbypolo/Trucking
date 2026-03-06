
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

async function seed() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'trucklogix'
    });

    console.log('--- SEEDING IFTA EVIDENCE DATA ---');

    const [loads] = await connection.query('SELECT id FROM loads LIMIT 3');
    if (loads.length === 0) {
        console.log('No loads found to seed evidence.');
        process.exit(0);
    }

    const loadId = loads[0].id;
    const truckId = 'TRK-9900';

    const pings = [
        { lat: 32.7767, lng: -96.7970, state: 'TX', type: 'GPS_PING' }, // Dallas
        { lat: 34.0500, lng: -96.8000, state: 'TX', type: 'GPS_PING' },
        { lat: 34.7300, lng: -96.7000, state: 'OK', type: 'BORDER_CROSSING' }, // OK Border
        { lat: 35.4676, lng: -97.5164, state: 'OK', type: 'FUEL_STOP' }, // OKC
        { lat: 37.6872, lng: -97.3301, state: 'KS', type: 'GPS_PING' }  // Wichita
    ];

    for (let i = 0; i < pings.length; i++) {
        const p = pings[i];
        await connection.query(
            'INSERT INTO ifta_trip_evidence (id, truck_id, load_id, timestamp, event_type, lat, lng, state_code, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                uuidv4(), truckId, loadId,
                new Date(Date.now() - (pings.length - i) * 3600000),
                p.type, p.lat, p.lng, p.state, 'Samsara ELD'
            ]
        );
    }

    console.log(`Seeded ${pings.length} evidence points for load ${loadId}`);
    process.exit(0);
}

seed().catch(console.error);
