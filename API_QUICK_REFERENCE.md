# LoadPilot API Setup - Quick Reference Card

**Last Updated:** 2026-01-14 20:00 CST

---

## 📋 What You Need to Do

### ✅ Already Configured
- Firebase (authentication)
- Google Maps API (key is valid)
- Database credentials
- Frontend server (running)

### ⚠️ Action Required

#### 1. Start Backend Server (CRITICAL)
```powershell
cd "c:\Users\User\OneDrive - info@asset-transportation.com\Apps\KCI TruckLogix Pro"
npm.cmd run server
```
**Why:** Required for login and all data operations

#### 2. Verify MySQL Running (CRITICAL)
```powershell
netstat -ano | findstr :3306
```
**If empty:** Start MySQL from XAMPP Control Panel

#### 3. Set Up Weather API (REQUIRED)
**Mock data has been removed. You MUST configure a weather API.**

**Option A - Azure Maps (Recommended):**
- Go to: https://portal.azure.com
- Create Azure Maps resource
- Copy Primary Key
- Add to `.env`: `VITE_WEATHER_API_KEY=your_key`
- Restart: `npm.cmd run dev`

**Option B - OpenWeatherMap (Simpler):**
- Go to: https://openweathermap.org/api
- Get free API key
- Add to `.env`: `VITE_OPENWEATHER_API_KEY=your_key`
- Restart: `npm.cmd run dev`

**⚠️ The live map will not work without a weather API configured.**

**See:** `WEATHER_API_SETUP.md` for details

#### 4. Add Google Maps Security (IMPORTANT)
- Go to: https://console.cloud.google.com/google/maps-apis/credentials
- Click your key: `AIzaSyCDjsoBjx9cPhadcW5PfIXdFjmbiwbnVF8`
- Add referrers: `http://localhost:*`
- Restrict to: Maps JavaScript API, Roads API, Distance Matrix API
- Save

**See:** `GOOGLE_MAPS_SECURITY_SETUP.md` for step-by-step

---

## 🎯 Your API Keys

### Firebase
- **Project:** gen-lang-client-0535844903
- **Status:** ✅ Configured
- **Console:** https://console.firebase.google.com/project/gen-lang-client-0535844903

### Google Maps
- **Key:** AIzaSyCDjsoBjx9cPhadcW5PfIXdFjmbiwbnVF8
- **Status:** ✅ Valid, ⚠️ Needs security restrictions
- **Console:** https://console.cloud.google.com/google/maps-apis

### Weather API
- **Azure Maps:** ❌ Not configured (REQUIRED)
- **OpenWeatherMap:** ❌ Not configured (alternative)
- **Status:** ⚠️ Live map will not work until configured
- **Mock Data:** Removed - real API required

### Database
- **Host:** localhost:3306
- **Database:** trucklogix
- **Status:** ⚠️ Need to verify running

---

## 🧪 Quick Tests

### Test Backend
```powershell
curl http://localhost:5000/api/health
```
**Expected:** `{"status":"ok"}`

### Test APIs
```powershell
node verify_apis.cjs
```

### Test Login
1. Visit: http://localhost:3000
2. Login: `admin@loadpilot.com` / `admin123`
3. Press `Ctrl+K` for Intelligence Hub
4. Click "COMMAND" tab
5. Verify map loads

---

## 📚 Documentation

1. **API_STATUS_SUMMARY.md** - Start here (overview)
2. **WEATHER_API_SETUP.md** - Weather API setup guide
3. **GOOGLE_MAPS_SECURITY_SETUP.md** - Maps security guide
4. **API_CONFIGURATION_AUDIT.md** - Complete reference
5. **verify_apis.cjs** - Automated checker

---

## 🚨 Common Issues

**"Connection Refused"**
→ Backend not running: `npm.cmd run server`

**"Invalid Credentials"**
→ Backend not running or DB not seeded

**Map shows dark grid**
→ Hard reload: `Ctrl+F5`
→ Check you're in Intelligence Hub → COMMAND

**Weather error or map fails to load**
→ Weather API not configured (REQUIRED)
→ Add weather API key to `.env`
→ Restart dev server: `npm.cmd run dev`

---

## ⚡ Quick Commands

```powershell
# Start backend
npm.cmd run server

# Start frontend
npm.cmd run dev

# Verify APIs
node verify_apis.cjs

# Check ports
netstat -ano | findstr ":3000 :5000 :3306"

# Kill hung processes
Taskkill /F /IM node.exe
```

---

## 🎓 Important Notes

### About OAuth
- ❌ You do NOT need OAuth for Google Maps
- ✅ You only need an API Key (which you have)
- OAuth is only for accessing user data (Gmail, Calendar, etc.)

### About Firebase URL
- If `gen-lang-client-0535844903.web.app` is assigned to another app, that's OK
- For now, just restrict Google Maps to `localhost:*`
- Add production URLs later when you deploy

### About MySQL vs Firebase
- Your app uses BOTH (this is correct!)
- **Firebase:** User authentication (login)
- **MySQL:** Operational data (loads, trucks, etc.)
- This is the "hybrid architecture" design

### About Weather API
- Your app supports BOTH Azure Maps and OpenWeatherMap
- Priority: Azure Maps → OpenWeatherMap → Error
- You can configure both for redundancy
- **⚠️ REQUIRED:** Mock data has been removed - you must configure at least one
- **Recommended:** Azure Maps for production quality

---

**Need Help?** See the detailed guides or run `node verify_apis.cjs`
