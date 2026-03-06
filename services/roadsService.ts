/// <reference types="vite/client" />
/**
 * Roads Service for LoadPilot
 * 
 * Uses Google Maps Roads API to snap GPS coordinates to roads and get speed limits.
 */

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export interface SnappedPoint {
    location: {
        latitude: number;
        longitude: number;
    };
    originalIndex?: number;
    placeId: string;
}

/**
 * Snap a path of coordinates to the nearest roads
 */
export const snapToRoads = async (path: { lat: number, lng: number }[]): Promise<SnappedPoint[]> => {
    if (!API_KEY) throw new Error('Google Maps API key not configured');

    const pathStr = path.map(p => `${p.lat},${p.lng}`).join('|');
    const response = await fetch(
        `https://roads.googleapis.com/v1/snapToRoads?path=${pathStr}&interpolate=true&key=${API_KEY}`
    );

    if (!response.ok) {
        throw new Error(`SnapToRoads failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
        throw new Error(`Roads API error: ${data.error.message}`);
    }

    return data.snappedPoints;
};

/**
 * Get speed limits for a set of place IDs or coordinates
 */
export const getSpeedLimits = async (path: { lat: number, lng: number }[]): Promise<any[]> => {
    if (!API_KEY) throw new Error('Google Maps API key not configured');

    const pathStr = path.map(p => `${p.lat},${p.lng}`).join('|');
    const response = await fetch(
        `https://roads.googleapis.com/v1/speedLimits?path=${pathStr}&key=${API_KEY}`
    );

    if (!response.ok) {
        throw new Error(`SpeedLimits failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
        throw new Error(`Roads API error: ${data.error.message}`);
    }

    return data.speedLimits;
};
