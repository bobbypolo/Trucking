/// <reference types="vite/client" />
/**
 * Directions Service for LoadPilot
 * 
 * Uses Google Maps Directions API to provide routes and turn-by-turn directions.
 * Now refactored to use the JS SDK to avoid CORS issues.
 */

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export interface DirectionsResult {
    points: string; // Overview polyline
    bounds: {
        northeast: { lat: number; lng: number };
        southwest: { lat: number; lng: number };
    };
    legs: any[];
}

/**
 * Get route directions between origin and destination
 */
export const getDirections = async (
    origin: { lat: number, lng: number } | string,
    destination: { lat: number, lng: number } | string,
    waypoints: ({ lat: number, lng: number } | string)[] = []
): Promise<DirectionsResult> => {
    // If google maps is loaded, use the DirectionsService to avoid CORS
    if (typeof google !== 'undefined' && google.maps) {
        return new Promise((resolve, reject) => {
            const service = new google.maps.DirectionsService();
            service.route({
                origin: typeof origin === 'string' ? origin : new google.maps.LatLng(origin.lat, origin.lng),
                destination: typeof destination === 'string' ? destination : new google.maps.LatLng(destination.lat, destination.lng),
                waypoints: waypoints.map(wp => ({
                    location: typeof wp === 'string' ? wp : new google.maps.LatLng(wp.lat, wp.lng),
                    stopover: true
                })),
                travelMode: google.maps.TravelMode.DRIVING
            }, (result, status) => {
                if (status === google.maps.DirectionsStatus.OK && result && result.routes[0]) {
                    const route = result.routes[0];
                    resolve({
                        points: route.overview_polyline as unknown as string, // In JS SDK this is the encoded string
                        bounds: {
                            northeast: { lat: route.bounds.getNorthEast().lat(), lng: route.bounds.getNorthEast().lng() },
                            southwest: { lat: route.bounds.getSouthWest().lat(), lng: route.bounds.getSouthWest().lng() }
                        },
                        legs: route.legs
                    });
                } else {
                    reject(new Error(`Directions failed: ${status}`));
                }
            });
        });
    }

    // Fallback to fetch (will likely fail due to CORS in browser)
    if (!API_KEY) throw new Error('Google Maps API key not configured');

    const originStr = typeof origin === 'string'
        ? encodeURIComponent(origin)
        : `${origin.lat},${origin.lng}`;

    const destStr = typeof destination === 'string'
        ? encodeURIComponent(destination)
        : `${destination.lat},${destination.lng}`;

    let url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destStr}&key=${API_KEY}`;

    if (waypoints.length > 0) {
        const waypointsStr = waypoints.map(wp =>
            typeof wp === 'string' ? wp : `${wp.lat},${wp.lng}`
        ).join('|');
        url += `&waypoints=${encodeURIComponent(waypointsStr)}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Directions failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.status !== 'OK') {
        throw new Error(`Google Maps API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
    }

    const route = data.routes[0];
    return {
        points: route.overview_polyline.points,
        bounds: route.bounds,
        legs: route.legs
    };
};
