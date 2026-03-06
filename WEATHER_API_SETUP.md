# Weather API Setup Guide - Azure Maps (Recommended)

**Date:** 2026-01-14  
**Recommended:** Azure Maps (Microsoft Weather API)

---

## 🌤️ Why Azure Maps?

Your app is configured to use **Azure Maps as the primary weather provider** with OpenWeatherMap as a fallback.

**Azure Maps is better for LoadPilot because:**
- ✅ Professional-grade weather data
- ✅ Better for logistics and route planning
- ✅ More accurate wind and condition reporting
- ✅ Integrates well with Microsoft ecosystem
- ✅ Designed for commercial applications

---

## 📋 Setup Instructions - Azure Maps

### Step 1: Create Azure Account
1. Go to: https://portal.azure.com
2. Sign in with your Microsoft account (or create one)
3. If this is your first time, you may get $200 free credit

### Step 2: Create Azure Maps Account
1. In the Azure Portal, click **"Create a resource"**
2. Search for **"Azure Maps"**
3. Click **"Create"**

### Step 3: Configure Your Maps Account
Fill in the form:
- **Subscription:** Select your subscription
- **Resource group:** Create new or use existing (e.g., "LoadPilot-Resources")
- **Name:** Give it a name (e.g., "loadpilot-maps")
- **Pricing tier:** Select **Gen2** (pay-as-you-go, includes free tier)
- **Region:** Choose closest to your location (e.g., "East US")

Click **"Review + Create"** then **"Create"**

### Step 4: Get Your API Key
1. Once created, go to your Azure Maps resource
2. In the left menu, click **"Authentication"**
3. You'll see **"Primary Key"** and **"Secondary Key"**
4. Copy the **Primary Key** (it will look like a long string)

### Step 5: Add to Your .env File
1. Open: `c:\Users\User\OneDrive - info@asset-transportation.com\Apps\KCI TruckLogix Pro\.env`
2. Add this line (replace with your actual key):
   ```env
   VITE_WEATHER_API_KEY=your_azure_maps_primary_key_here
   ```
3. Save the file

### Step 6: Restart Your Dev Server
**IMPORTANT:** Vite only loads environment variables at startup.

```powershell
# Stop the current dev server (Ctrl+C)
# Then restart it:
cd "c:\Users\User\OneDrive - info@asset-transportation.com\Apps\KCI TruckLogix Pro"
npm.cmd run dev
```

---

## 🧪 Test Your Weather API

### Test 1: Run Verification Script
```powershell
node verify_apis.cjs
```

**Expected:** Should show "✅ VITE_WEATHER_API_KEY: Configured"

### Test 2: Check in the App
1. Visit: http://localhost:3000
2. Login with: `admin@loadpilot.com` / `admin123`
3. Press `Ctrl+K` to open Intelligence Hub
4. Click **"COMMAND"** tab
5. Look for the **weather widget** in the top-right corner of the map
6. It should show real weather data (not mock data)

### Test 3: Browser Console Check
Open DevTools (F12) and check the Console tab:
- ✅ **Good:** No weather API errors
- ❌ **Bad:** "Azure Maps Weather API error" - means key is invalid

---

## 💰 Pricing & Free Tier

### Azure Maps Free Tier (Gen2)
- **Weather API:** 1,000 transactions/month FREE
- **After free tier:** $0.50 per 1,000 transactions

**For a small business/development app, the free tier should be plenty.**

### What Counts as a Transaction?
- Each time the map loads and fetches weather = 1 transaction
- Weather updates every few minutes = additional transactions
- Typical usage: 100-500 transactions/month for development

---

## 🔄 Alternative: OpenWeatherMap (Fallback)

If you prefer OpenWeatherMap (simpler, more generous free tier):

### Setup OpenWeatherMap
1. Go to: https://openweathermap.org/api
2. Sign up for a free account
3. Go to **API keys** section
4. Copy your API key
5. Add to `.env`:
   ```env
   VITE_OPENWEATHER_API_KEY=your_openweather_api_key_here
   ```

### OpenWeatherMap Free Tier
- **60 calls/minute**
- **1,000,000 calls/month** FREE
- More generous than Azure Maps

**Your app will automatically use OpenWeatherMap if Azure Maps fails or isn't configured.**

---

## 🔍 How Your App Chooses Weather Provider

Your `weatherService.ts` uses this priority:

1. **Try Azure Maps first** (if `VITE_WEATHER_API_KEY` is set)
2. **Fall back to OpenWeatherMap** (if `VITE_OPENWEATHER_API_KEY` is set)
3. **Throw error** (if neither key is configured)

**⚠️ IMPORTANT:** Mock data has been removed. You **must** configure at least one weather API for the map to work.

**You can configure both for redundancy!**

---

## ✅ Recommendation

**For LoadPilot, I recommend:**

### Option 1: Azure Maps Only (Best for Production)
```env
VITE_WEATHER_API_KEY=your_azure_maps_key_here
```
- Professional-grade data
- Better for logistics
- Costs may apply after free tier

### Option 2: Both (Best for Reliability)
```env
VITE_WEATHER_API_KEY=your_azure_maps_key_here
VITE_OPENWEATHER_API_KEY=your_openweather_key_here
```
- Azure Maps primary
- OpenWeatherMap automatic fallback
- Maximum uptime

### Option 3: OpenWeatherMap Only (Best for Development)
```env
VITE_OPENWEATHER_API_KEY=your_openweather_key_here
```
- Simpler setup
- Very generous free tier
- Good enough for testing

---

## 🚨 Troubleshooting

### Weather Widget Not Showing
**Cause:** API key not configured or dev server not restarted  
**Fix:**
1. Verify `.env` has `VITE_WEATHER_API_KEY=...`
2. Restart dev server: `npm.cmd run dev`
3. Hard reload browser: `Ctrl+F5`

### "Azure Maps Weather API error" in Console
**Cause:** Invalid API key or wrong key format  
**Fix:**
1. Go back to Azure Portal
2. Copy the **Primary Key** from Authentication section
3. Make sure you copied the entire key (no spaces)
4. Update `.env` and restart dev server

### Weather Shows Mock Data
**Cause:** No API key configured or both APIs failed  
**Fix:**
1. Check browser console for error messages
2. Verify API key is correct
3. Check if you have billing enabled (for Azure)

---

## 📊 Current Status

Based on your verification:
- ❌ **Azure Maps:** Not configured (REQUIRED)
- ❌ **OpenWeatherMap:** Not configured (alternative)
- ⚠️ **Weather Service:** Will throw error until API key is added

**Next step:** Choose Azure Maps or OpenWeatherMap and follow the setup instructions above.

**⚠️ The live map will not work without a weather API configured.**

---

## ✅ Quick Setup Checklist

- [ ] Decided on weather provider (Azure Maps recommended)
- [ ] Created account and got API key
- [ ] Added key to `.env` file
- [ ] Restarted dev server with `npm.cmd run dev`
- [ ] Tested in app - weather widget shows real data
- [ ] No errors in browser console

---

**Need help deciding?** 
- **For production/commercial use:** Azure Maps
- **For development/testing:** OpenWeatherMap
- **For maximum reliability:** Both (Azure primary, OpenWeather fallback)

**Last Updated:** 2026-01-14 20:00 CST
