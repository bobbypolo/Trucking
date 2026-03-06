# Google Maps APIs - Implementation Guide

**Date:** 2026-01-14  
**Status:** Ready to implement and test

---

## 🎯 **Why These APIs Matter for Dispatch**

### **1. Geocoding API** 📍
**What it does:** Converts addresses to GPS coordinates (and vice versa)

**Use cases:**
- Customer gives you "123 Main St, Chicago, IL" → Convert to lat/lng for routing
- Show human-readable address from GPS coordinates
- Validate addresses before creating loads
- Auto-complete address entry

**Example:**
```typescript
const geocodeAddress = async (address: string) => {
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`
  );
  const data = await response.json();
  return data.results[0].geometry.location; // { lat, lng }
};
```

---

### **2. Distance Matrix API** ⚡
**What it does:** Calculates actual driving distance and time between multiple points

**Use cases:**
- Calculate accurate ETAs for pickups/deliveries
- Determine which driver is closest to a pickup
- Estimate fuel costs based on actual miles
- Compare multiple route options

**Example:**
```typescript
const getETA = async (origin: {lat, lng}, destination: {lat, lng}) => {
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}&destinations=${destination.lat},${destination.lng}&key=${API_KEY}`
  );
  const data = await response.json();
  return {
    distance: data.rows[0].elements[0].distance.text, // "92.4 mi"
    duration: data.rows[0].elements[0].duration.text  // "1 hour 32 mins"
  };
};
```

---

### **3. Directions API** 🧭
**What it does:** Provides turn-by-turn directions and optimal routes

**Use cases:**
- Show drivers the best route to take
- Avoid tolls or highways if needed
- Get alternative routes
- Calculate waypoints for multi-stop loads

**Example:**
```typescript
const getDirections = async (origin: {lat, lng}, destination: {lat, lng}) => {
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&mode=driving&key=${API_KEY}`
  );
  const data = await response.json();
  return data.routes[0]; // Full route with steps
};
```

---

### **4. Roads API** 🛣️
**What it does:** Snaps GPS coordinates to actual roads, gets speed limits

**Use cases:**
- Fix inaccurate GPS readings (driver shows "off road" but they're on the highway)
- Snap vehicle positions to nearest road for accurate tracking
- Get speed limits for safety monitoring
- Improve route accuracy

**Example:**
```typescript
const snapToRoad = async (coordinates: {lat, lng}[]) => {
  const path = coordinates.map(c => `${c.lat},${c.lng}`).join('|');
  const response = await fetch(
    `https://roads.googleapis.com/v1/snapToRoads?path=${path}&interpolate=true&key=${API_KEY}`
  );
  const data = await response.json();
  return data.snappedPoints; // Corrected coordinates on actual roads
};
```

---

## 🚀 **How to Test**

### Step 1: Enable APIs in Google Cloud Console
1. Go to: https://console.cloud.google.com/google/maps-apis/credentials
2. Click your API key: `AIzaSyCDjsoBjx9cPhadcW5PfIXdFjmbiwbnVF8`
3. Under **API restrictions** → Enable:
   ```
   ☑ Maps JavaScript API
   ☑ Geocoding API
   ☑ Distance Matrix API
   ☑ Directions API
   ☑ Roads API
   ```
4. Click **SAVE**

### Step 2: Test in LoadPilot
1. Login to LoadPilot
2. In the sidebar, go to **ENTERPRISE** → **API Tester**
3. Click **"Run All API Tests"**
4. Watch the results appear in real-time

**Expected results:**
- ✅ Geocoding API: Converts address to coordinates
- ✅ Distance Matrix API: Shows distance and time
- ✅ Directions API: Returns turn-by-turn directions
- ✅ Roads API: Snaps GPS to nearest road

---

## 💰 **Pricing**

### Free Tier (Monthly)
- **Geocoding:** $200 credit = ~40,000 requests
- **Distance Matrix:** $200 credit = ~40,000 elements
- **Directions:** $200 credit = ~40,000 requests
- **Roads (Snap to Roads):** $200 credit = ~40,000 requests

### After Free Tier
- **Geocoding:** $5.00 per 1,000 requests
- **Distance Matrix:** $5.00 per 1,000 elements
- **Directions:** $5.00 per 1,000 requests
- **Roads:** $10.00 per 1,000 requests

**For a small dispatch operation:**
- ~100-500 loads/month = well within free tier
- Even 1,000 loads/month would only be ~$5-10/month

---

## 📝 **Implementation Recommendations**

### Priority 1: Geocoding API
**Implement first** - Essential for address entry
- Add to quote intake form
- Auto-complete addresses
- Validate customer addresses

### Priority 2: Distance Matrix API
**Implement second** - Critical for ETAs
- Show accurate delivery times
- Calculate driver assignments
- Estimate fuel costs

### Priority 3: Directions API
**Implement third** - Helpful for drivers
- Show route on map
- Provide turn-by-turn directions
- Calculate waypoints

### Priority 4: Roads API
**Implement last** - Nice to have
- Improve GPS accuracy
- Snap vehicle markers to roads
- Monitor speed limits

---

## 🔧 **Next Steps**

1. ✅ **Test APIs** - Use the API Tester (ENTERPRISE → API Tester)
2. ✅ **Enable APIs** - Add to Google Cloud Console
3. ⏭️ **Implement Geocoding** - Start with address lookup
4. ⏭️ **Implement Distance Matrix** - Add ETA calculations
5. ⏭️ **Implement Directions** - Show routes on map
6. ⏭️ **Implement Roads** - Improve GPS accuracy

---

## 🎯 **Current Status**

**Implemented:**
- ✅ Maps JavaScript API (basic map rendering)
- ✅ Markers and polylines
- ✅ Info windows

**Not Yet Implemented:**
- ❌ Geocoding API (address lookup)
- ❌ Distance Matrix API (ETA calculations)
- ❌ Directions API (turn-by-turn)
- ❌ Roads API (GPS snapping)

**Ready to Test:**
- ✅ API Tester component created
- ✅ Route added to sidebar (ENTERPRISE → API Tester)
- ✅ All 4 APIs ready to test

---

**Last Updated:** 2026-01-14 21:45 CST  
**Created By:** Antigravity AI Assistant
