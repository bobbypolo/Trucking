# Weather API - Development Setup (OpenWeatherMap)

**Date:** 2026-01-14  
**Current Setup:** OpenWeatherMap (FREE for development)  
**Production Plan:** Switch to Azure Maps before launch

---

## 🎯 Development Strategy

**For Development (NOW):**
- ✅ Use **OpenWeatherMap** (free, 1M calls/month)
- ✅ No credit card required
- ✅ No charges during development
- ✅ Very generous free tier

**For Production (LATER):**
- 🔄 Switch to **Azure Maps** (professional-grade)
- 🔄 Better for commercial/logistics use
- 🔄 More accurate data for route planning

---

## 🚀 Quick Setup - OpenWeatherMap (5 minutes)

### Step 1: Create Free Account
1. Go to: https://openweathermap.org/api
2. Click **"Sign Up"** (top right)
3. Fill in:
   - Email address
   - Username
   - Password
4. Check your email and verify your account

### Step 2: Get Your API Key
1. After verification, log in to: https://home.openweathermap.org/api_keys
2. You'll see a **default API key** already created
3. Copy the API key (it looks like: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)

**⚠️ Note:** It may take 10-15 minutes for the API key to activate after creation.

### Step 3: Add to Your .env File
1. Open: `c:\Users\User\OneDrive - info@asset-transportation.com\Apps\KCI TruckLogix Pro\.env`
2. Add this line:
   ```env
   # OpenWeatherMap API (FREE - for development only)
   # TODO: Switch to Azure Maps (VITE_WEATHER_API_KEY) before production launch
   VITE_OPENWEATHER_API_KEY=your_api_key_here
   ```
3. Replace `your_api_key_here` with your actual API key
4. Save the file

### Step 4: Restart Dev Server
**CRITICAL:** Vite only loads environment variables at startup.

```powershell
# Stop the current dev server (Ctrl+C in the terminal)
# Then restart:
cd "c:\Users\User\OneDrive - info@asset-transportation.com\Apps\KCI TruckLogix Pro"
npm.cmd run dev
```

---

## 🧪 Test Your Setup

### Test 1: Verify API Key Loaded
```powershell
node verify_apis.cjs
```
**Expected:** `✅ VITE_OPENWEATHER_API_KEY: Configured`

### Test 2: Test in App
1. Visit: http://localhost:3000
2. Login: `admin@loadpilot.com` / `admin123`
3. Press `Ctrl+K` to open Intelligence Hub
4. Click **"COMMAND"** tab
5. Look for weather widget in top-right corner
6. Should show **real weather data** (not an error)

### Test 3: Browser Console Check
Open DevTools (F12):
- ✅ **Good:** No weather API errors
- ✅ **Good:** Weather data loads
- ❌ **Bad:** "OpenWeatherMap API error" - key might not be activated yet (wait 10-15 min)

---

## 📊 OpenWeatherMap Free Tier

### What You Get FREE:
- ✅ **60 API calls per minute**
- ✅ **1,000,000 calls per month**
- ✅ Current weather data
- ✅ No credit card required
- ✅ No automatic charges

### What This Means for Development:
- **More than enough** for development and testing
- Even with 100 developers testing all day, you won't hit the limit
- Perfect for your current stage

---

## 🔄 Production Migration Plan

When you're ready to launch, switch to Azure Maps:

### Why Switch to Azure Maps?
- ✅ Professional-grade weather data
- ✅ Better accuracy for logistics
- ✅ More detailed wind/condition data
- ✅ Better for route safety planning
- ✅ Microsoft ecosystem integration

### How to Switch (Later):
1. Create Azure Maps account: https://portal.azure.com
2. Get Azure Maps Primary Key
3. Add to `.env`: `VITE_WEATHER_API_KEY=your_azure_key`
4. Remove or comment out `VITE_OPENWEATHER_API_KEY`
5. Restart dev server

**Your app will automatically use Azure Maps** (it's checked first in the code).

---

## 💡 Best Practice: Use Both for Redundancy

You can configure **both** APIs for maximum reliability:

```env
# Azure Maps (Primary - for production)
VITE_WEATHER_API_KEY=your_azure_maps_key_here

# OpenWeatherMap (Fallback - if Azure fails)
VITE_OPENWEATHER_API_KEY=your_openweather_key_here
```

**How it works:**
1. App tries Azure Maps first
2. If Azure fails → falls back to OpenWeatherMap
3. If both fail → throws error

**This gives you 99.99% uptime!**

---

## 📝 .env File Template

Here's what your `.env` should look like for development:

```env
# Firebase Frontend Configuration (Vite)
VITE_FIREBASE_API_KEY=AIzaSyCMlIojm-CjTPU-wnmCzrdF_af2tMga8Jo
VITE_FIREBASE_AUTH_DOMAIN=gen-lang-client-0535844903.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=gen-lang-client-0535844903
VITE_FIREBASE_STORAGE_BUCKET=gen-lang-client-0535844903.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=944619417175
VITE_FIREBASE_APP_ID=1:944619417175:web:68997f26977b611969bd12
VITE_FIREBASE_MEASUREMENT_ID=G-EHY4CD3H13

# Google Maps API Key
VITE_GOOGLE_MAPS_API_KEY=AIzaSyCDjsoBjx9cPhadcW5PfIXdFjmbiwbnVF8

# Weather API - Development Setup
# TODO: Switch to Azure Maps (VITE_WEATHER_API_KEY) before production
VITE_OPENWEATHER_API_KEY=your_openweather_api_key_here

# Backend Configuration
PORT=5000
JWT_SECRET=loadpilot-secret-2026
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=admin
DB_NAME=trucklogix
```

---

## 🚨 Troubleshooting

### "OpenWeatherMap API error: 401"
**Cause:** API key not activated yet or invalid  
**Fix:**
- Wait 10-15 minutes after creating the key
- Check you copied the entire key (no spaces)
- Verify key at: https://home.openweathermap.org/api_keys

### Weather Widget Not Showing
**Cause:** Dev server not restarted  
**Fix:**
1. Stop dev server (Ctrl+C)
2. Restart: `npm.cmd run dev`
3. Hard reload browser: `Ctrl+F5`

### "Weather API not configured" Error
**Cause:** Environment variable not loaded  
**Fix:**
1. Check `.env` has `VITE_OPENWEATHER_API_KEY=...`
2. Make sure there are no typos
3. Restart dev server
4. Run `node verify_apis.cjs` to confirm

---

## ✅ Checklist

**Setup:**
- [ ] Created OpenWeatherMap account
- [ ] Verified email
- [ ] Copied API key
- [ ] Added to `.env` as `VITE_OPENWEATHER_API_KEY`
- [ ] Added TODO comment to switch to Azure later
- [ ] Restarted dev server

**Testing:**
- [ ] Ran `node verify_apis.cjs` - shows configured
- [ ] Opened app and logged in
- [ ] Weather widget shows real data
- [ ] No errors in browser console

**Production Planning:**
- [ ] Noted to switch to Azure Maps before launch
- [ ] Documented in project notes/README
- [ ] Added to deployment checklist

---

## 📌 Important Reminders

### For Development (Now):
✅ OpenWeatherMap is perfect  
✅ Free and unlimited for your needs  
✅ No charges, no credit card needed

### Before Production Launch:
⚠️ Switch to Azure Maps  
⚠️ Update `.env` with `VITE_WEATHER_API_KEY`  
⚠️ Test thoroughly with production data  
⚠️ Consider keeping OpenWeatherMap as fallback

---

## 🔗 Quick Links

- **OpenWeatherMap Dashboard:** https://home.openweathermap.org/
- **API Keys:** https://home.openweathermap.org/api_keys
- **Usage Stats:** https://home.openweathermap.org/statistics
- **Documentation:** https://openweathermap.org/api

---

**Last Updated:** 2026-01-14 20:16 CST  
**Status:** Development setup with free tier  
**Next Review:** Before production deployment
