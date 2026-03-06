# Google Maps API - Security Fix Guide

**Issue:** Too many APIs enabled (security risk + billing confusion)  
**Solution:** Restrict to only what LoadPilot actually uses

---

## ⚠️ **Current Problem**

You have **50+ APIs enabled** including:
- Android/iOS SDKs (you're building a web app!)
- Firebase APIs (separate from Maps)
- Solar API, Pollen API, Air Quality API (not using)
- Many others you don't need

**This creates:**
- ❌ Security vulnerabilities
- ❌ Billing confusion
- ❌ Potential unexpected charges

---

## ✅ **What LoadPilot Actually Uses**

Based on code analysis of `GlobalMapViewEnhanced.tsx`:

### Currently Using:
1. ✅ **Maps JavaScript API** - Map rendering, markers, info windows, polylines

### NOT Using (Yet):
- ❌ Roads API
- ❌ Distance Matrix API
- ❌ Directions API
- ❌ Geocoding API
- ❌ All other APIs

---

## 🔧 **Fix It Now (5 Minutes)**

### Step 1: Go to API Restrictions
1. Visit: https://console.cloud.google.com/google/maps-apis/credentials
2. Click your API key: `AIzaSyCDjsoBjx9cPhadcW5PfIXdFjmbiwbnVF8`
3. Scroll to **"API restrictions"**

### Step 2: Select "Restrict key"
Click the **"Restrict key"** radio button

### Step 3: Enable ONLY This API
In the dropdown, select ONLY:
```
☑ Maps JavaScript API
```

**Uncheck everything else!**

### Step 4: Save
Click **"SAVE"** at the bottom

### Step 5: Wait
Changes take 1-2 minutes to propagate

---

## 🧪 **Test After Saving**

### Test 1: Verify API Still Works
```powershell
node verify_apis.cjs
```
**Expected:** `✅ Google Maps API: Key is valid and accessible`

### Test 2: Test in App
1. Visit: http://localhost:3000
2. Login → Press `Ctrl+K` → Click "COMMAND"
3. Map should load normally with vehicle markers

### Test 3: Check Console
Open DevTools (F12):
- ✅ **Good:** No API errors
- ❌ **Bad:** "This API key is not authorized" - wait 2 more minutes

---

## 📊 **Future API Additions**

### When You Might Need More APIs:

**If you add address search/autocomplete:**
- Enable: **Geocoding API**

**If you add route planning:**
- Enable: **Directions API**

**If you calculate ETAs:**
- Enable: **Distance Matrix API**

**Rule:** Only enable APIs when you actually implement the feature!

---

## ⚠️ **APIs You Should NEVER Enable**

These are NOT for web apps:
- ❌ Maps SDK for Android
- ❌ Maps SDK for iOS
- ❌ Maps 3D SDK for Android
- ❌ Maps 3D SDK for iOS
- ❌ Navigation SDK

These are separate services (not part of Maps):
- ❌ All Firebase APIs (managed separately)
- ❌ Google Cloud APIs (managed separately)
- ❌ Gemini API (managed separately)

These you're not using:
- ❌ Solar API
- ❌ Pollen API
- ❌ Air Quality API
- ❌ Street View APIs
- ❌ Aerial View API

---

## 🔒 **Security Best Practices**

### 1. Principle of Least Privilege
✅ Only enable APIs you're actively using  
✅ Add more only when needed  
✅ Review quarterly and remove unused APIs

### 2. Referrer Restrictions
After fixing API restrictions, also add referrer restrictions:
```
http://localhost:*
http://127.0.0.1:*
```

(Add production URLs later when deploying)

### 3. Monitor Usage
- Check usage weekly: https://console.cloud.google.com/google/maps-apis/metrics
- Set billing alerts
- Review which APIs are actually being called

---

## 📋 **Checklist**

- [ ] Went to Google Cloud Console credentials page
- [ ] Selected my API key
- [ ] Clicked "Restrict key" under API restrictions
- [ ] Selected ONLY "Maps JavaScript API"
- [ ] Unchecked all other APIs
- [ ] Clicked SAVE
- [ ] Waited 2 minutes
- [ ] Tested with `node verify_apis.cjs`
- [ ] Tested in app - map loads correctly
- [ ] No console errors

---

## 🎯 **Summary**

**Before:** 50+ APIs enabled (security risk!)  
**After:** 1 API enabled (Maps JavaScript API)  
**Result:** Secure, minimal, exactly what you need

**Remember:** Add more APIs only when you implement features that need them!

---

**Last Updated:** 2026-01-14 20:32 CST
