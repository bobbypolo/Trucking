# LoadPilot - Production Deployment Checklist

**Last Updated:** 2026-01-14  
**Status:** Development Phase

---

## ⚠️ BEFORE PRODUCTION LAUNCH

This checklist ensures all development configurations are switched to production-ready settings.

---

## 🌤️ 1. Weather API Migration

**Current (Development):**
- ✅ Using OpenWeatherMap (free tier)
- ✅ No charges during development

**Required for Production:**
- [ ] Create Azure Maps account: https://portal.azure.com
- [ ] Create Azure Maps resource (Gen2 pricing tier)
- [ ] Copy Primary Key from Authentication section
- [ ] Update `.env`:
  ```env
  # Azure Maps (Primary - Production)
  VITE_WEATHER_API_KEY=your_azure_maps_primary_key_here
  
  # OpenWeatherMap (Fallback - Optional)
  VITE_OPENWEATHER_API_KEY=keep_for_redundancy
  ```
- [ ] Test weather data in production environment
- [ ] Set up billing alerts in Azure Portal
- [ ] Monitor usage for first week

**Why:** Azure Maps provides professional-grade weather data better suited for commercial logistics applications.

**Reference:** See `WEATHER_API_SETUP.md` for migration instructions

---

## 🔐 2. API Security Hardening

### Google Maps API
- [ ] Update referrer restrictions to include production URLs:
  ```
  https://your-production-domain.com/*
  https://gen-lang-client-0535844903.web.app/*
  ```
- [ ] Remove `localhost:*` from production key (or use separate keys)
- [ ] Set up billing alerts in Google Cloud Console
- [ ] Monitor usage daily for first week

### Firebase
- [ ] Review Firestore security rules
- [ ] Ensure rules are set to backend-only access
- [ ] Review Firebase Auth settings
- [ ] Set up Firebase billing alerts
- [ ] Review authorized domains list

---

## 🗄️ 3. Database Configuration

### MySQL/Production Database
- [ ] Change default passwords
- [ ] Use strong, unique passwords
- [ ] Restrict database access to application server only
- [ ] Set up automated backups
- [ ] Test backup restoration process
- [ ] Configure connection pooling limits

### Environment Variables
- [ ] Update `DB_PASSWORD` to production password
- [ ] Update `JWT_SECRET` to production secret (use strong random string)
- [ ] Remove any development-only variables
- [ ] Verify all production URLs are correct

---

## 🔑 4. Secrets Management

- [ ] Rotate all API keys from development
- [ ] Use environment-specific keys (dev vs prod)
- [ ] Never commit `.env` to version control
- [ ] Use Firebase Functions config for backend secrets
- [ ] Document all required environment variables

---

## 🚀 5. Performance Optimization

- [ ] Run production build: `npm run build`
- [ ] Test production bundle
- [ ] Optimize images and assets
- [ ] Enable compression
- [ ] Set up CDN if needed
- [ ] Test load times

---

## 📊 6. Monitoring & Alerts

### Set Up Monitoring For:
- [ ] Google Maps API usage and costs
- [ ] Azure Maps API usage and costs
- [ ] Firebase usage (Auth, Firestore, Storage)
- [ ] Database connection pool status
- [ ] Application error rates
- [ ] API response times

### Billing Alerts:
- [ ] Google Cloud: Set alert at $50, $100, $200
- [ ] Azure: Set alert at $25, $50, $100
- [ ] Firebase: Set alert at $25, $50, $100

---

## 🧪 7. Testing

- [ ] Test all critical user flows in production environment
- [ ] Verify login/authentication
- [ ] Test live map with real weather data
- [ ] Verify all API integrations
- [ ] Test on multiple devices/browsers
- [ ] Load testing with expected user volume

---

## 📝 8. Documentation

- [ ] Update README with production setup instructions
- [ ] Document all environment variables
- [ ] Create runbook for common issues
- [ ] Document backup/restore procedures
- [ ] Create incident response plan

---

## ✅ 9. Final Checks

- [ ] All TODO comments in code reviewed
- [ ] No console.log statements in production code
- [ ] Error handling is production-ready
- [ ] All development flags removed
- [ ] Version number updated
- [ ] Changelog updated

---

## 🎯 Priority Order

### Critical (Must Do):
1. ✅ Weather API migration to Azure Maps
2. ✅ Update all passwords and secrets
3. ✅ Configure API security restrictions
4. ✅ Set up billing alerts

### High Priority (Should Do):
5. ✅ Set up monitoring
6. ✅ Test in production environment
7. ✅ Configure backups

### Medium Priority (Nice to Have):
8. ✅ Performance optimization
9. ✅ Documentation updates

---

## 📞 Emergency Contacts

**If something goes wrong:**
- Google Cloud Support: https://cloud.google.com/support
- Azure Support: https://portal.azure.com/#blade/Microsoft_Azure_Support/HelpAndSupportBlade
- Firebase Support: https://firebase.google.com/support

---

## 🔄 Post-Launch Monitoring (First Week)

### Daily Checks:
- [ ] Review API usage and costs
- [ ] Check error logs
- [ ] Monitor user feedback
- [ ] Review performance metrics

### Weekly Checks:
- [ ] Review all billing statements
- [ ] Analyze usage patterns
- [ ] Optimize based on real usage
- [ ] Update documentation based on issues found

---

**Status:** 🟡 Development Phase  
**Target Launch Date:** TBD  
**Last Review:** 2026-01-14
