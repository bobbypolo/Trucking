# LoadPilot API Setup - Quick Action Checklist

**Date:** 2026-01-14  
**Status:** ✅ Most APIs Configured | ⚠️ Weather API Needed

---

## ✅ COMPLETED - APIs Already Set Up

### 1. Firebase Authentication & Storage
- ✅ API Key configured
- ✅ Project ID: `gen-lang-client-0535844903`
- ✅ Service account file present
- ✅ All required environment variables set

**Status:** OPERATIONAL

### 2. Google Maps API
- ✅ API Key configured: `AIzaSyCDjsoBjx9cPhadcW5PfIXdFjmbiwbnVF8`
- ✅ Key is valid and accessible
- ✅ Environment variable set

**Status:** OPERATIONAL

**⚠️ IMPORTANT NEXT STEPS:**
You still need to verify these settings in Google Cloud Console:

1. **Enable Required APIs** (if not already done):
   - Go to: https://console.cloud.google.com/google/maps-apis/api-list
   - Enable these APIs:
     - ✅ Maps JavaScript API
     - ✅ Roads API
     - ✅ Distance Matrix API

2. **Set API Restrictions** (for security):
   - Go to: https://console.cloud.google.com/google/maps-apis/credentials
   - Click on your API key
   - Under "Application restrictions":
     - Select "HTTP referrers (web sites)"
     - Add these patterns:
       ```
       http://localhost:3000/*
       http://localhost:5173/*
       https://gen-lang-client-0535844903.web.app/*
       https://gen-lang-client-0535844903-849a7.web.app/*
       ```
   - Under "API restrictions":
     - Select "Restrict key"
     - Choose: Maps JavaScript API, Roads API, Distance Matrix API

### 3. Database Configuration
- ✅ MySQL connection configured
- ✅ Host: localhost
- ✅ Database: trucklogix
- ✅ Credentials set

**Status:** CONFIGURED

**⚠️ NOTE:** MySQL service was not detected running. You may need to start it.

---

## ⚠️ TODO - APIs That Need Configuration

### 1. Weather API (HIGH PRIORITY)
The live map's weather features are currently disabled.

**Option A: Azure Maps (Recommended)**
1. Go to: https://portal.azure.com
2. Create an Azure Maps account
3. Get your Subscription Key
4. Add to `.env`:
   ```env
   VITE_WEATHER_API_KEY=your_azure_maps_subscription_key_here
   ```

**Option B: OpenWeatherMap (Alternative)**
1. Go to: https://openweathermap.org/api
2. Sign up and get an API key
3. Add to `.env`:
   ```env
   VITE_OPENWEATHER_API_KEY=your_openweather_api_key_here
   ```

**After adding the key:**
- Restart the Vite dev server: `npm.cmd run dev`
- Weather widget will appear in the top-right of the live map

---

## 🚀 Quick Start Commands

### Start the Application
```powershell
# Terminal 1 - Backend Server
cd "c:\Users\User\OneDrive - info@asset-transportation.com\Apps\KCI TruckLogix Pro"
npm.cmd run server

# Terminal 2 - Frontend Server
cd "c:\Users\User\OneDrive - info@asset-transportation.com\Apps\KCI TruckLogix Pro"
npm.cmd run dev
```

### Verify APIs
```powershell
# Run the verification script
node verify_apis.cjs
```

### Test Database Connection
```powershell
cd server
node check_db.js
```

### Seed Database (if needed)
```powershell
cd server
node seed_firebase_auth.cjs
node seed_realistic_profiles.cjs
node seed_full_flow.cjs
```

---

## 🧪 Testing Your Setup

### 1. Test Backend
Visit: http://localhost:5000/api/health  
**Expected:** `{"status":"ok","message":"LoadPilot API is running"}`

### 2. Test Frontend
Visit: http://localhost:3000  
**Expected:** Login page should load

### 3. Test Google Maps
1. Log in with: `admin@loadpilot.com` / `admin123`
2. Press `Ctrl+K` to open Intelligence Hub
3. Click "COMMAND" tab
4. You should see the enhanced map with vehicle markers

**To verify in browser console (F12):**
```javascript
// Check if Google Maps loaded
typeof window.google !== 'undefined' 
  ? "✅ Google Maps loaded" 
  : "❌ Google Maps not loaded";
```

### 4. Test Firebase
If you can log in successfully, Firebase is working correctly.

---

## 🔍 Troubleshooting

### Map Not Loading
**Symptom:** Dark grid pattern instead of map tiles  
**Fix:**
1. Hard reload: `Ctrl+F5`
2. Check you're in Intelligence Hub → COMMAND tab
3. Verify API key in `.env`
4. Check browser console for errors

### "InvalidKeyMapError"
**Symptom:** Map shows "Oops! Something went wrong"  
**Fix:**
1. Go to Google Cloud Console
2. Enable "Maps JavaScript API"
3. Add `http://localhost:*` to allowed referrers

### Backend Not Running
**Symptom:** "Connection Refused" or login fails  
**Fix:**
```powershell
# Kill any hung processes
Taskkill /F /IM node.exe

# Restart backend
cd "c:\Users\User\OneDrive - info@asset-transportation.com\Apps\KCI TruckLogix Pro"
npm.cmd run server
```

### MySQL Not Running
**Symptom:** Backend fails to start or database errors  
**Fix:**
```powershell
# Check if MySQL is running
netstat -ano | findstr :3306

# If using XAMPP, start MySQL from control panel
# Or run: C:\xampp\mysql_start.bat
```

---

## 📊 Current Status Summary

| Component | Status | Action Required |
|-----------|--------|-----------------|
| Firebase | ✅ Working | None |
| Google Maps API | ✅ Working | Verify restrictions in console |
| Weather API | ❌ Missing | Add Azure Maps or OpenWeather key |
| MySQL Database | ⚠️ Unknown | Verify service is running |
| Backend Server | ⚠️ Unknown | Check if running on port 5000 |
| Frontend Server | ✅ Running | None (port 3000 active) |

---

## 📝 Priority Action Items

### High Priority (Do Now)
1. ✅ **Verify Google Maps API settings** in Google Cloud Console
   - Enable required APIs
   - Set referrer restrictions
   
2. ⚠️ **Start MySQL** (if not running)
   - Check service status
   - Start from XAMPP or service manager

3. ⚠️ **Start Backend Server** (if not running)
   - Run `npm.cmd run server`
   - Verify health endpoint

### Medium Priority (Do Soon)
4. ⚠️ **Add Weather API**
   - Choose Azure Maps or OpenWeather
   - Add key to `.env`
   - Restart dev server

### Low Priority (Optional)
5. 📊 **Set up monitoring**
   - Monitor Google Maps API usage
   - Set billing alerts
   - Review Firebase usage

---

## 📞 Need Help?

- **Full Documentation:** See `API_CONFIGURATION_AUDIT.md`
- **Knowledge Base:** `kci_trucklogix_pro_technical_reference` artifacts
- **Verification Script:** Run `node verify_apis.cjs`

---

**Last Updated:** 2026-01-14  
**Next Review:** After completing action items
