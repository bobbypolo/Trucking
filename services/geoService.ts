
/**
 * Point-in-Polygon algorithm for jurisdiction detection
 */
export interface StatePolygon {
    code: string;
    name: string;
    polygon: [number, number][][]; // Array of rings (each ring is [lat, lng])
}

// Highly simplified boundary data for key states (for demo/initial build)
// In production, load full GeoJSON from US Census TIGER/Line
const STATES_DATA: StatePolygon[] = [
    {
        code: 'TX',
        name: 'Texas',
        polygon: [[
            [36.5, -106.5], [36.5, -100.0], [34.5, -100.0], [34.0, -94.0], [29.5, -93.5],
            [26.0, -97.0], [29.0, -106.0], [32.0, -106.5], [36.5, -106.5]
        ]]
    },
    {
        code: 'OK',
        name: 'Oklahoma',
        polygon: [[
            [37.0, -103.0], [37.0, -94.5], [34.0, -94.5], [34.0, -100.0], [36.5, -100.0], [36.5, -103.0], [37.0, -103.0]
        ]]
    },
    {
        code: 'KS',
        name: 'Kansas',
        polygon: [[
            [40.0, -102.0], [40.0, -94.5], [37.0, -94.5], [37.0, -102.0], [40.0, -102.0]
        ]]
    }
    // ... add more or load from file
];

/**
 * Checks if a point is inside a polygon using ray-casting
 */
function isPointInPolygon(lat: number, lng: number, polygon: [number, number][][]): boolean {
    let inside = false;
    // Iterate through rings
    for (const ring of polygon) {
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const xi = ring[i][0], yi = ring[i][1];
            const xj = ring[j][0], yj = ring[j][1];

            const intersect = ((yi > lng) !== (yj > lng))
                && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
    }
    return inside;
}

export function detectState(lat: number, lng: number): string | null {
    for (const state of STATES_DATA) {
        if (isPointInPolygon(lat, lng, state.polygon)) {
            return state.code;
        }
    }
    return null;
}

/**
 * Calculates distance between two points in miles (Haversine)
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3958.8; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Decodes Google Polyline
 */
export function decodePolyline(encoded: string): [number, number][] {
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;
    const points: [number, number][] = [];

    while (index < len) {
        let b, shift = 0, result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += dlat;

        shift = 0;
        result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += dlng;

        points.push([lat / 1e5, lng / 1e5]);
    }
    return points;
}
