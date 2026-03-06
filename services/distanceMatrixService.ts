/// <reference types="vite/client" />
/**
 * Distance Matrix Service for LoadPilot
 * 
 * Uses Google Maps Distance Matrix API to calculate distance and duration between points.
 */

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export interface DistanceMatrixResult {
    distance: {
        text: string;
        value: number; // in meters
    };
    duration: {
        text: string;
        value: number; // in seconds
    };
}

/**
 * Get distance and travel time between origin and destination
 */
export const getDistanceMatrix = async (
    origin: { lat: number, lng: number } | string,
    destination: { lat: number, lng: number } | string
): Promise<DistanceMatrixResult> => {
    if (!API_KEY) throw new Error('Google Maps API key not configured');

    const originStr = typeof origin === 'string'
        ? encodeURIComponent(origin)
        : `${origin.lat},${origin.lng}`;

    const destStr = typeof destination === 'string'
        ? encodeURIComponent(destination)
        : `${destination.lat},${destination.lng}`;

    const response = await fetch(
        `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originStr}&destinations=${destStr}&key=${API_KEY}`
    );

    if (!response.ok) {
        throw new Error(`Distance Matrix failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.status !== 'OK') {
        throw new Error(`Google Maps API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
    }

    const element = data.rows[0].elements[0];

    if (element.status !== 'OK') {
        throw new Error(`Distance Matrix element error: ${element.status}`);
    }

    return {
        distance: element.distance,
        duration: element.duration
    };
};
