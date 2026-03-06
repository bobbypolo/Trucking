# Enhanced Live Map - Setup Guide

## 🗺️ Features

The Enhanced Live Map includes:

1. **Google Maps Integration**
   - Real-time GPS tracking with actual map rendering
   - Custom vehicle markers with directional arrows
   - Route polylines showing pickup to delivery paths
   - Interactive info windows with load details

2. **Microsoft Weather Integration**
   - Real-time weather data for map center
   - Temperature, conditions, wind speed display
   - Weather icons (sun, clouds, rain, snow)
   - Automatic updates based on map position

3. **Enhanced Load Display**
   - **Booking Loads**: Yellow indicators for pending/booked loads
   - **Active Loads**: Blue indicators for in-transit loads
   - **Driver View**: Green indicators for driver-assigned loads
   - Filterable load list with status badges
   - Click-to-view load details

## 🔑 API Keys Required

### 1. Google Maps API Key

**Get your key:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/google/maps-apis)
2. Create a new project or select existing
3. Enable the following APIs:
   - Maps JavaScript API
   - Geocoding API (optional, for address lookup)
4. Create credentials → API Key
5. Restrict the key to your domain (recommended)

**Add to `.env`:**
```bash
VITE_GOOGLE_MAPS_API_KEY=AIzaSy...your_key_here
```

### 2. Microsoft Weather API (Azure Maps)

**Get your key:**
1. Go to [Azure Portal](https://portal.azure.com)
2. Create an Azure Maps account
3. Navigate to Authentication
4. Copy the Primary Key

**Add to `.env`:**
```bash
VITE_WEATHER_API_KEY=your_azure_maps_subscription_key
```

**Alternative:** Use OpenWeatherMap API
```bash
VITE_WEATHER_API_KEY=your_openweather_api_key
```

## 📦 Installation

The required packages are already installed:
```bash
npm install @googlemaps/js-api-loader @react-google-maps/api
```

## 🚀 Usage

### Basic Setup

1. **Copy environment template:**
```bash
cp .env.example .env
```

2. **Add your API keys to `.env`:**
```bash
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_key
VITE_WEATHER_API_KEY=your_weather_api_key
```

3. **Restart the dev server:**
```bash
npm run dev
```

### Accessing the Live Map

1. Log in as dispatcher or admin
2. Navigate to **Live Map** in the sidebar
3. The map will load with:
   - All active vehicles with GPS markers
   - Weather widget in top-right
   - Load filter panel on left
   - Search functionality

### Load Filtering

Click the filter buttons to view:
- **All Loads**: Complete load list
- **Booking**: Loads in pending/booked status (yellow)
- **Active**: Loads currently in transit (blue)
- **Driver View**: Loads assigned to drivers (green)

### Vehicle Tracking

- **Blue arrows**: Active vehicles with loads
- **Gray arrows**: Offline/idle vehicles
- **Red arrows**: Vehicles with incidents
- **Pulsing effect**: Real-time GPS ping indicator

Click any vehicle marker to see:
- Driver name and safety score
- Online/offline status and speed
- Current load details
- Last ping timestamp

## 🎨 Customization

### Map Styling

Edit the `mapOptions.styles` in `GlobalMapViewEnhanced.tsx`:
```typescript
const mapOptions = {
    styles: [
        // Dark theme map styling
        // Customize colors here
    ]
};
```

### Weather Provider

To switch from Azure Maps to OpenWeatherMap:

1. Update the `fetchWeather` function:
```typescript
const response = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${WEATHER_API_KEY}&units=imperial`
);
```

2. Parse the response accordingly

### GPS Coordinates

Currently using mock GPS data. To integrate real GPS:

1. Replace the `coords` generation in `activeVehicles`:
```typescript
coords: {
    lat: vehicle.lastKnownLat || 0,
    lng: vehicle.lastKnownLng || 0
}
```

2. Update your load/driver data model to include GPS fields
3. Implement GPS tracking service (e.g., Samsara, Geotab, ELD provider)

## 🔧 Troubleshooting

### Map not loading
- Check console for API key errors
- Verify `VITE_GOOGLE_MAPS_API_KEY` is set in `.env`
- Ensure Maps JavaScript API is enabled in Google Cloud Console

### Weather not showing
- Verify `VITE_WEATHER_API_KEY` is set
- Check network tab for API errors
- Ensure Azure Maps subscription is active

### Markers not appearing
- Check that loads have valid GPS coordinates
- Verify `loads` and `users` props are passed correctly
- Open browser console for JavaScript errors

## 📊 Data Requirements

### Load Data
Loads should include:
```typescript
{
    pickup: { lat: string, lng: string, city: string },
    dropoff: { lat: string, lng: string, city: string },
    status: 'Booked' | 'Active' | 'In Transit' | 'Delivered',
    driverId: string
}
```

### User/Driver Data
Drivers should include:
```typescript
{
    role: 'driver' | 'owner_operator',
    safetyScore: number,
    // GPS tracking fields (if using real GPS)
    lastKnownLat?: number,
    lastKnownLng?: number
}
```

## 🌐 Production Deployment

### Security Best Practices

1. **Restrict API Keys:**
   - Google Maps: Restrict to your domain
   - Azure Maps: Use managed identity in production

2. **Environment Variables:**
   - Never commit `.env` to git
   - Use environment-specific configs
   - Store keys in secure vault (Azure Key Vault, AWS Secrets Manager)

3. **Rate Limiting:**
   - Monitor API usage
   - Implement caching for weather data
   - Batch GPS updates

### Performance Optimization

1. **Marker Clustering:**
```bash
npm install @googlemaps/markerclusterer
```

2. **Lazy Loading:**
   - Load map only when tab is active
   - Defer weather API calls

3. **Caching:**
   - Cache weather data for 15-30 minutes
   - Store map tiles locally

## 📝 Future Enhancements

- [ ] Real-time GPS updates via WebSocket
- [ ] Traffic layer integration
- [ ] Route optimization
- [ ] Geofencing alerts
- [ ] Historical route playback
- [ ] Multi-day weather forecast
- [ ] Driver ETA calculations
- [ ] Fuel stop recommendations

## 🆘 Support

For issues or questions:
1. Check browser console for errors
2. Verify API keys are valid
3. Review network tab for failed requests
4. Check that all required packages are installed

## 📚 Additional Resources

- [Google Maps JavaScript API Docs](https://developers.google.com/maps/documentation/javascript)
- [Azure Maps Documentation](https://docs.microsoft.com/en-us/azure/azure-maps/)
- [React Google Maps API](https://react-google-maps-api-docs.netlify.app/)
