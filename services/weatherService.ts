/**
 * Weather Service for LoadPilot
 * 
 * Fetches real-time weather data using Azure Maps (primary) or OpenWeatherMap (fallback).
 * REQUIRES a valid API key to be configured in .env
 */

export interface WeatherData {
    temp: number;
    condition: string;
    icon: string;
    windSpeed: number;
    humidity: number;
    location: string;
}

/**
 * Fetch weather data for a location
 * @param lat Latitude
 * @param lng Longitude
 * @returns Weather data
 * @throws Error if no API key is configured
 */
export const fetchWeatherData = async (lat: number, lng: number): Promise<WeatherData> => {
    // Check if we have real API keys
    const azureMapsKey = import.meta.env.VITE_WEATHER_API_KEY;
    const openWeatherKey = import.meta.env.VITE_OPENWEATHER_API_KEY;

    // PRODUCTION STRATEGY: Azure Maps (azureMapsKey) is the recommended provider for production.
    // OpenWeatherMap serves as the development/fallback provider when Azure Maps is not configured.
    // Set VITE_WEATHER_API_KEY (Azure Maps) in .env for production; VITE_OPENWEATHER_API_KEY for dev fallback.

    // Try Azure Maps Weather API first (recommended for production)
    if (azureMapsKey && azureMapsKey !== 'your_azure_maps_subscription_key_here') {
        try {
            const response = await fetch(
                `https://atlas.microsoft.com/weather/currentConditions/json?api-version=1.0&query=${lat},${lng}&subscription-key=${azureMapsKey}`
            );

            if (response.ok) {
                const data = await response.json();
                return parseAzureMapsWeather(data);
            } else {
            }
        } catch (error) {
        }
    }

    // Try OpenWeatherMap API as fallback
    if (openWeatherKey && openWeatherKey !== 'your_openweather_api_key') {
        try {
            const response = await fetch(
                `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${openWeatherKey}&units=imperial`
            );

            if (response.ok) {
                const data = await response.json();
                return parseOpenWeatherData(data);
            } else {
            }
        } catch (error) {
        }
    }

    // No API key configured or all APIs failed
    throw new Error(
        'Weather API not configured. Please add VITE_WEATHER_API_KEY (Azure Maps) or VITE_OPENWEATHER_API_KEY (OpenWeatherMap) to your .env file. See WEATHER_API_SETUP.md for instructions.'
    );
};

/**
 * Parse Azure Maps Weather API response
 */
const parseAzureMapsWeather = (data: any): WeatherData => {
    const current = data.results?.[0];
    return {
        temp: Math.round(current?.temperature?.value || 70),
        condition: current?.phrase || 'Unknown',
        icon: current?.iconCode || 'unknown',
        windSpeed: Math.round(current?.wind?.speed?.value || 0),
        humidity: current?.relativeHumidity || 50,
        location: 'Current Location'
    };
};

/**
 * Parse OpenWeatherMap API response
 */
const parseOpenWeatherData = (data: any): WeatherData => {
    return {
        temp: Math.round(data.main?.temp || 70),
        condition: data.weather?.[0]?.description || 'Unknown',
        icon: data.weather?.[0]?.icon || 'unknown',
        windSpeed: Math.round(data.wind?.speed || 0),
        humidity: data.main?.humidity || 50,
        location: data.name || 'Current Location'
    };
};

/**
 * Get weather icon component name based on condition
 */
export const getWeatherIconName = (condition: string): string => {
    const lower = condition.toLowerCase();
    if (lower.includes('rain') || lower.includes('drizzle')) return 'rain';
    if (lower.includes('snow') || lower.includes('sleet')) return 'snow';
    if (lower.includes('clear') || lower.includes('sunny')) return 'sunny';
    if (lower.includes('cloud')) return 'cloudy';
    if (lower.includes('thunder') || lower.includes('storm')) return 'storm';
    if (lower.includes('fog') || lower.includes('mist')) return 'fog';
    return 'partly-cloudy';
};

/**
 * Format temperature with unit
 */
export const formatTemperature = (temp: number, unit: 'F' | 'C' = 'F'): string => {
    return `${Math.round(temp)}°${unit}`;
};

/**
 * Get weather alert level based on conditions
 */
export const getWeatherAlertLevel = (weather: WeatherData): 'none' | 'caution' | 'warning' | 'severe' => {
    const condition = weather.condition.toLowerCase();

    if (condition.includes('severe') || condition.includes('tornado') || condition.includes('hurricane')) {
        return 'severe';
    }
    if (condition.includes('thunder') || condition.includes('heavy') || weather.windSpeed > 30) {
        return 'warning';
    }
    if (condition.includes('rain') || condition.includes('snow') || weather.windSpeed > 20) {
        return 'caution';
    }
    return 'none';
};
