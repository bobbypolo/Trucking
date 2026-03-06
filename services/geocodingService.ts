/// <reference types="vite/client" />
/**
 * Geocoding Service for LoadPilot
 * 
 * Uses Google Maps Geocoding API to convert between addresses and coordinates.
 */

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export interface GeocodeResult {
    lat: number;
    lng: number;
    formattedAddress: string;
}

/**
 * Geocode an address string to coordinates
 */
export const geocodeAddress = async (address: string): Promise<GeocodeResult> => {
    if (!API_KEY) throw new Error('Google Maps API key not configured');

    const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`
    );

    if (!response.ok) {
        throw new Error(`Geocoding failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.status === 'ZERO_RESULTS') {
        throw new Error('No coordinates found for this address');
    }

    if (data.status !== 'OK') {
        throw new Error(`Google Maps API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
    }

    const result = data.results[0];
    return {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        formattedAddress: result.formatted_address
    };
};

/**
 * Reverse geocode coordinates to a human-readable address
 */
export const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    if (!API_KEY) throw new Error('Google Maps API key not configured');

    const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${API_KEY}`
    );

    if (!response.ok) {
        throw new Error(`Reverse geocoding failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.status === 'ZERO_RESULTS') {
        return 'Unknown Location';
    }

    if (data.status !== 'OK') {
        throw new Error(`Google Maps API error: ${data.status}`);
    }

    return data.results[0].formatted_address;
};
