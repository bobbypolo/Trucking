import { reverseGeocodeState } from "./services/geocoding.service";

export interface StatePolygon {
    code: string;
    name: string;
    polygon: number[][][][];
}

export function isPointInPolygon(lat: number, lng: number, polygon: number[][][]): boolean {
    let inside = false;
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

/**
 * Detect the US state or Canadian province for a GPS coordinate.
 *
 * Uses Google Maps Reverse Geocoding API with aggressive caching
 * (~5.5km grid cells, cached forever). No hardcoded state boundaries.
 *
 * @returns 2-letter state/province code (e.g., "TX", "ON") or null
 *          if the coordinate cannot be resolved.
 */
export async function detectState(lat: number, lng: number): Promise<string | null> {
    return reverseGeocodeState(lat, lng);
}

export function isWithinGeofence(
    driverLat: number,
    driverLng: number,
    facilityLat: number,
    facilityLng: number,
    radiusMiles: number = 0.5
): boolean {
    return calculateDistance(driverLat, driverLng, facilityLat, facilityLng) <= radiusMiles;
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3958.8;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
