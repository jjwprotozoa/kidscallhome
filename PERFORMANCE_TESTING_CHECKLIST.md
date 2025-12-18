# Performance Testing Checklist - Weak Network Conditions

**Date:** 2025-01-09  
**Purpose:** Comprehensive testing guide for validating performance optimizations on weak networks (LTE/2G)  
**Status:** 📋 **READY FOR TESTING**

---

## Overview

This checklist provides step-by-step instructions for testing the performance optimizations implemented for weak network conditions. The goal is to verify that Time to Interactive (TTI) is reduced from ~12s to <6s on first visit, and <2s on repeat visits.

---

## Prerequisites

### Tools Required:
- Chrome DevTools (latest version)
- Lighthouse (built into Chrome DevTools)
- WebPageTest (optional, for external testing)
- Mobile device with real 2G/3G connection (optional)
- Network throttling capability

### Test Environment:
- Production build (`npm run build`)
- Local server or deployed staging environment
- Clean browser state (clear cache/cookies between tests)

---

## Test 1: Chrome DevTools Network Throttling

### Objective:
Verify app performance under simulated weak network conditions.

### Steps:

#### 1.1: Test "Slow 3G" Preset
1. Open Chrome DevTools (F12)
2. Navigate to **Network** tab
3. Click throttling dropdown (default: "No throttling")
4. Select **"Slow 3G"** preset:
   - RTT: 400ms
   - Download: 400 KB/s
   - Upload: 400 KB/s
5. Open application in new tab
6. Record metrics:
   - Total load time
   - Time to Interactive (TTI)
   - Total bytes transferred
   - Number of requests

**Expected Results:**
- ✅ App loads successfully
- ✅ TTI < 8 seconds
- ✅ Vendor chunks load in parallel
- ✅ No blocking requests

---

#### 1.2: Test "2G" Custom Throttling
1. In Network tab, select **"Custom"** from throttling dropdown
2. Configure custom profile:
   - **Name:** "2G Weak Network"
   - **RTT:** 2000ms (2 seconds)
   - **Download:** 50 KB/s
   - **Upload:** 20 KB/s
3. Open application in new tab
4. Record metrics:
   - Total load time
   - Time to Interactive (TTI)
   - Total bytes transferred
   - Number of requests
   - First Contentful Paint (FCP)
   - Largest Contentful Paint (LCP)

**Expected Results:**
- ✅ App loads successfully (may take longer)
- ✅ TTI < 6 seconds (first visit)
- ✅ Vendor chunks cached for repeat visits
- ✅ Progressive loading visible

---

#### 1.3: Measure Lighthouse Performance Score
1. Open Chrome DevTools
2. Navigate to **Lighthouse** tab
3. Select:
   - **Performance** category
   - **Mobile** device
   - **Throttling:** "Simulated throttling" or "Apply throttling"
4. Click **"Analyze page load"**
5. Record scores:
   - Performance score (before/after)
   - Time to Interactive
   - First Contentful Paint
   - Largest Contentful Paint
   - Total Blocking Time
   - Cumulative Layout Shift

**Expected Results:**
- ✅ Performance score > 70 (on 2G)
- ✅ TTI < 6 seconds
- ✅ FCP < 2 seconds
- ✅ LCP < 4 seconds

**Comparison:**
| Metric | Before Optimization | After Optimization | Target |
|--------|---------------------|---------------------|--------|
| Performance Score | ~40-50 | >70 | >70 |
| TTI | ~12s | <6s | <6s |
| FCP | ~4s | <2s | <2s |
| LCP | ~8s | <4s | <4s |

---

## Test 2: Service Worker Verification

### Objective:
Verify service worker is registered and caching correctly.

### Steps:

#### 2.1: Verify Service Worker Registration
1. Open Chrome DevTools (F12)
2. Navigate to **Application** tab
3. Click **"Service Workers"** in left sidebar
4. Verify:
   - Service worker status: **"activated and is running"**
   - Source: `sw.js` or `workbox-*.js`
   - Scope: `/` (root)
   - **"Update on reload"** checkbox (for testing)

**Expected Results:**
- ✅ Service worker registered successfully
- ✅ Status shows "activated and is running"
- ✅ No errors in console

---

#### 2.2: Verify Cache Creation
1. In **Application** tab, click **"Cache Storage"** in left sidebar
2. Verify caches created:
   - `kidscallhome-v1-precache` (or similar)
   - `vendor-cache` (for vendor chunks)
   - `app-cache` (for app bundle)
   - `chunks-cache` (for other chunks)
   - `static-assets` (for CSS, images, etc.)

**Expected Results:**
- ✅ All 5 cache types created
- ✅ Cache names match configuration
- ✅ No duplicate caches

---

#### 2.3: Check Precache Entries
1. In **Application** tab → **Cache Storage**
2. Click on precache (e.g., `kidscallhome-v1-precache`)
3. Verify entries:
   - **Total entries:** 78 items
   - **Total size:** ~1214 KB
   - Vendor chunks included:
     - `react-vendor-*.js`
     - `supabase-vendor-*.js`
     - `radix-vendor-*.js`
     - `query-vendor-*.js`
     - `capacitor-vendor-*.js`

**Expected Results:**
- ✅ 78 precache entries
- ✅ All vendor chunks precached
- ✅ Main app bundle precached
- ✅ Static assets precached

---

#### 2.4: Test Offline Functionality
1. In **Application** tab → **Service Workers**
2. Check **"Offline"** checkbox (top of DevTools)
3. Reload the page (F5)
4. Verify:
   - App loads from cache
   - No network errors for cached resources
   - Navigation works (cached routes)
   - Offline indicator visible (if implemented)

**Expected Results:**
- ✅ App loads completely offline
- ✅ Cached routes accessible
- ✅ Vendor chunks served from cache
- ✅ No "Failed to fetch" errors for cached resources

**Test Scenarios:**
- [ ] Home page loads offline
- [ ] Cached routes navigate offline
- [ ] API calls fail gracefully (expected)
- [ ] Error messages shown for network-dependent features

---

## Test 3: Cache Hit Rate Testing

### Objective:
Verify vendor chunks are cached and not re-downloaded on repeat visits.

### Steps:

#### 3.1: First Visit (Cold Cache)
1. **Clear all cache and storage:**
   - DevTools → **Application** → **Clear storage**
   - Check all boxes
   - Click **"Clear site data"**
2. **Open Network tab** in DevTools
3. **Enable throttling:** "2G" custom (2000ms RTT, 50 KB/s)
4. **Load application** (first visit)
5. **Record metrics:**
   - Total bytes downloaded
   - Vendor chunk sizes:
     - `react-vendor-*.js`: ~164 KB
     - `supabase-vendor-*.js`: ~176 KB
     - `radix-vendor-*.js`: ~130 KB
     - `query-vendor-*.js`: ~23 KB
     - `capacitor-vendor-*.js`: ~10 KB
   - Total vendor chunks: ~503 KB
   - Main bundle: ~144 KB
   - **Total first visit:** ~647 KB

**Expected Results:**
- ✅ All vendor chunks downloaded
- ✅ Main bundle downloaded
- ✅ Total ~647 KB transferred
- ✅ Load time: <6 seconds

---

#### 3.2: Second Visit (Warm Cache)
1. **Keep Network tab open** (same session)
2. **Reload page** (F5 or Ctrl+R)
3. **Verify in Network tab:**
   - Vendor chunks show **"from ServiceWorker"** or **"from disk cache"**
   - Status: **200 (from cache)** or **304 (Not Modified)**
4. **Record metrics:**
   - Total bytes downloaded (should be much less)
   - Vendor chunks: **0 KB** (served from cache)
   - Main bundle: May be re-downloaded (NetworkFirst strategy)
   - **Total second visit:** ~144 KB (main bundle only)

**Expected Results:**
- ✅ Vendor chunks served from cache (0 KB downloaded)
- ✅ Main bundle may be re-downloaded (NetworkFirst)
- ✅ Total ~144 KB transferred (76% reduction)
- ✅ Load time: <2 seconds

**Cache Savings:**
| Resource | First Visit | Second Visit | Saved |
|----------|-------------|--------------|-------|
| Vendor Chunks | 503 KB | 0 KB | 503 KB |
| Main Bundle | 144 KB | 144 KB | 0 KB |
| Other Chunks | ~50 KB | ~50 KB | 0 KB |
| **Total** | **~697 KB** | **~194 KB** | **~503 KB (72%)** |

---

#### 3.3: Verify Cache Headers
1. In **Network tab**, click on a vendor chunk (e.g., `react-vendor-*.js`)
2. Check **Headers** tab:
   - **Response Headers:**
     - `Cache-Control` (if present)
     - `ETag` (if present)
   - **Request Headers:**
     - Verify request was made
3. On second visit, verify:
   - Status: **200 (from ServiceWorker)** or **304**
   - No network request made (served from cache)

**Expected Results:**
- ✅ First visit: Full download (200 OK)
- ✅ Second visit: Served from cache (no network request)
- ✅ Service worker intercepts requests

---

## Test 4: Time to Interactive Measurement

### Objective:
Measure and verify TTI improvements on weak networks.

### Steps:

#### 4.1: Lighthouse TTI Measurement (2G)
1. Open Chrome DevTools
2. Navigate to **Lighthouse** tab
3. Configure:
   - **Categories:** Performance only
   - **Device:** Mobile
   - **Throttling:** Apply throttling (2G preset)
4. Click **"Analyze page load"**
5. Record **Time to Interactive (TTI)** from report

**Expected Results:**
- ✅ TTI < 6 seconds (first visit)
- ✅ TTI < 2 seconds (repeat visit)
- ✅ Improvement: 50%+ reduction from baseline

---

#### 4.2: WebPageTest (Optional)
1. Navigate to [WebPageTest.org](https://www.webpagetest.org)
2. Enter application URL
3. Configure test:
   - **Location:** Select location with 2G/3G
   - **Browser:** Chrome
   - **Connection:** 2G (2000ms RTT, 50 KB/s)
4. Run test
5. Record metrics:
   - Time to Interactive
   - First Contentful Paint
   - Speed Index
   - Total Load Time

**Expected Results:**
- ✅ TTI < 6 seconds
- ✅ FCP < 2 seconds
- ✅ Speed Index < 5 seconds

---

#### 4.3: Performance API Measurement
1. Open Chrome DevTools Console
2. Run performance measurement:
```javascript
// Measure Time to Interactive
window.addEventListener('load', () => {
  setTimeout(() => {
    const perfData = performance.getEntriesByType('navigation')[0];
    const tti = perfData.domInteractive - perfData.fetchStart;
    console.log('Time to Interactive:', tti, 'ms');
    console.log('Total Load Time:', perfData.loadEventEnd - perfData.fetchStart, 'ms');
  }, 0);
});
```

**Expected Results:**
- ✅ TTI < 6000ms (6 seconds)
- ✅ Total load time < 8000ms (8 seconds)

---

## Test 5: Real Device Testing

### Objective:
Verify performance on actual mobile devices with real network conditions.

### Steps:

#### 5.1: Setup Remote Debugging
1. **Android:**
   - Enable USB debugging on device
   - Connect via USB
   - Chrome → `chrome://inspect` → Select device
2. **iOS:**
   - Connect via USB
   - Safari → Develop → Select device
3. **Verify connection:**
   - DevTools opens for mobile device
   - Network tab accessible

---

#### 5.2: Test on Real 2G/3G Connection
1. **Disable WiFi** on device
2. **Use cellular data** (2G/3G if available)
3. **Open application** on device
4. **Monitor in DevTools:**
   - Network tab (throttling not needed - real network)
   - Performance tab
   - Application tab (service worker)
5. **Record metrics:**
   - Actual load time
   - TTI on real network
   - Cache behavior
   - User experience

**Expected Results:**
- ✅ App loads successfully on real 2G/3G
- ✅ TTI acceptable (<6s first visit, <2s repeat)
- ✅ Service worker registers
- ✅ Caching works correctly

---

#### 5.3: Verify Prefetch During Idle
1. **Open DevTools** on mobile device
2. **Navigate to Network tab**
3. **Load application** (first visit)
4. **Wait 5-10 seconds** (idle time)
5. **Check Network tab:**
   - Look for prefetch requests
   - Verify critical route chunks prefetched:
     - `ParentHome-*.js`
     - `ChildHome-*.js`
     - `ParentCallScreen-*.js`
     - `ChildCallScreen-*.js`

**Expected Results:**
- ✅ Prefetch requests appear after initial load
- ✅ Critical route chunks prefetched
- ✅ Prefetch happens during idle time
- ✅ No blocking of main thread

---

## Test 6: Modulepreload Verification

### Objective:
Verify modulepreload links are present and working.

### Steps:

#### 6.1: Check HTML for Modulepreload Links
1. **View page source** (Ctrl+U or Right-click → View Page Source)
2. **Search for** `modulepreload`
3. **Verify links present:**
   ```html
   <link rel="modulepreload" crossorigin href="/assets/react-vendor-*.js">
   <link rel="modulepreload" crossorigin href="/assets/supabase-vendor-*.js">
   <link rel="modulepreload" crossorigin href="/assets/radix-vendor-*.js">
   <link rel="modulepreload" crossorigin href="/assets/query-vendor-*.js">
   <link rel="modulepreload" crossorigin href="/assets/capacitor-vendor-*.js">
   ```

**Expected Results:**
- ✅ All 5 vendor chunks have modulepreload links
- ✅ Links appear in `<head>` section
- ✅ `crossorigin` attribute present
- ✅ Correct paths (matching actual chunk filenames)

---

#### 6.2: Verify Preload in Network Tab
1. **Open Network tab** in DevTools
2. **Filter by** "JS" or search for vendor chunks
3. **Load application**
4. **Check vendor chunk requests:**
   - **Initiator:** Should show "Other" or "parser"
   - **Priority:** Should be "High" (for modulepreload)
   - **Timing:** Should start early (before main bundle)

**Expected Results:**
- ✅ Vendor chunks load early
- ✅ High priority assigned
- ✅ Parallel loading with main bundle
- ✅ No blocking dependencies

---

## Test 7: Resource Hints Verification

### Objective:
Verify DNS prefetch and preconnect hints are working.

### Steps:

#### 7.1: Check HTML for Resource Hints
1. **View page source**
2. **Search for** `dns-prefetch` and `preconnect`
3. **Verify present:**
   ```html
   <link rel="dns-prefetch" href="https://*.supabase.co" />
   <link rel="preconnect" href="https://*.supabase.co" crossorigin />
   ```

**Expected Results:**
- ✅ DNS prefetch link present
- ✅ Preconnect link present
- ✅ Both point to Supabase domain
- ✅ Preconnect has `crossorigin` attribute

---

#### 7.2: Verify Early Connection
1. **Open Network tab** in DevTools
2. **Load application**
3. **Check Supabase API requests:**
   - Look for requests to `*.supabase.co`
   - Check **Connection Start** timing
   - Verify connection established early

**Expected Results:**
- ✅ Supabase requests start early
- ✅ DNS resolved before first API call
- ✅ Connection established proactively
- ✅ Reduced latency on first API request

---

## Test 8: Route Prefetching Verification

### Objective:
Verify critical routes are prefetched during idle time.

### Steps:

#### 8.1: Monitor Prefetch Requests
1. **Open Network tab** in DevTools
2. **Load application** (first visit)
3. **Wait 3-5 seconds** (idle time)
4. **Check for prefetch requests:**
   - Filter by "JS" or search for route chunks
   - Look for:
     - `ParentHome-*.js`
     - `ChildHome-*.js`
     - `ParentCallScreen-*.js`
     - `ChildCallScreen-*.js`

**Expected Results:**
- ✅ Prefetch requests appear after initial load
- ✅ Critical route chunks prefetched
- ✅ Prefetch happens during idle (non-blocking)
- ✅ No impact on initial load performance

---

#### 8.2: Verify Prefetch Timing
1. **Open Performance tab** in DevTools
2. **Start recording**
3. **Load application**
4. **Wait 5 seconds**
5. **Stop recording**
6. **Analyze timeline:**
   - Initial load complete
   - Idle period
   - Prefetch requests during idle

**Expected Results:**
- ✅ Prefetch happens after initial load
- ✅ Prefetch during idle time (not blocking)
- ✅ Main thread not blocked
- ✅ Prefetch completes before user navigates

---

## Test 9: Cache Expiration Testing

### Objective:
Verify cache expiration and refresh behavior.

### Steps:

#### 9.1: Test Vendor Cache (30 days)
1. **Load application** (first visit)
2. **Verify vendor chunks cached**
3. **Simulate 30+ days:**
   - DevTools → Application → Cache Storage
   - Manually expire cache (or wait 30 days)
4. **Reload application**
5. **Verify:**
   - Vendor chunks re-downloaded
   - New cache created
   - Old cache cleaned up

**Expected Results:**
- ✅ Cache expires after 30 days
- ✅ Vendor chunks re-downloaded
- ✅ Old cache cleaned up automatically
- ✅ New cache created

---

#### 9.2: Test App Bundle Cache (7 days, NetworkFirst)
1. **Load application**
2. **Verify app bundle cached**
3. **Simulate network failure:**
   - DevTools → Network → Offline
4. **Reload application**
5. **Verify:**
   - App bundle served from cache
   - No network errors
   - App functions offline

**Expected Results:**
- ✅ NetworkFirst falls back to cache
   - ✅ App works offline
   - ✅ Cache used when network fails
   - ✅ Cache updated when network available

---

## Test 10: Performance Comparison

### Objective:
Compare performance before and after optimizations.

### Steps:

#### 10.1: Baseline Measurement (Before)
1. **Disable service worker** (if testing before/after)
2. **Disable vendor chunk splitting** (if possible)
3. **Run Lighthouse** on 2G throttling
4. **Record baseline metrics:**
   - Performance score
   - TTI
   - FCP
   - LCP
   - Total bytes

---

#### 10.2: Optimized Measurement (After)
1. **Enable all optimizations**
2. **Run Lighthouse** on 2G throttling
3. **Record optimized metrics**
4. **Compare with baseline**

**Expected Improvements:**
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Performance Score | ~40-50 | >70 | +40-60% |
| TTI (First Visit) | ~12s | <6s | 50%+ |
| TTI (Repeat Visit) | ~12s | <2s | 83%+ |
| Total Bytes (First) | ~700 KB | ~650 KB | 7% |
| Total Bytes (Repeat) | ~700 KB | ~200 KB | 71% |
| FCP | ~4s | <2s | 50%+ |
| LCP | ~8s | <4s | 50%+ |

---

## Test Results Template

### Test Execution Log

**Date:** _______________  
**Tester:** _______________  
**Environment:** _______________  
**Build Version:** _______________

#### Network Throttling Tests:
- [ ] Slow 3G: TTI = _____ seconds
- [ ] 2G Custom: TTI = _____ seconds
- [ ] Lighthouse Score: _____ / 100

#### Service Worker Tests:
- [ ] Service worker registered: ✅ / ❌
- [ ] Cache created: ✅ / ❌
- [ ] Precache entries: _____ / 78
- [ ] Offline functionality: ✅ / ❌

#### Cache Hit Rate:
- [ ] First visit: _____ KB downloaded
- [ ] Second visit: _____ KB downloaded
- [ ] Cache savings: _____ KB (_____%)

#### Time to Interactive:
- [ ] First visit TTI: _____ seconds
- [ ] Repeat visit TTI: _____ seconds
- [ ] Target met: ✅ / ❌

#### Real Device Testing:
- [ ] Tested on: _______________
- [ ] Network type: _______________
- [ ] TTI: _____ seconds
- [ ] Service worker: ✅ / ❌

#### Issues Found:
1. _______________________________________
2. _______________________________________
3. _______________________________________

---

## Success Criteria

### Must Pass (Critical):
- ✅ Service worker registers successfully
- ✅ Vendor chunks cached (30 days)
- ✅ TTI < 6 seconds on first visit (2G)
- ✅ TTI < 2 seconds on repeat visit (2G)
- ✅ Offline functionality works
- ✅ Modulepreload links present

### Should Pass (High Priority):
- ✅ Cache hit rate > 70% on repeat visits
- ✅ Lighthouse performance score > 70
- ✅ FCP < 2 seconds
- ✅ LCP < 4 seconds
- ✅ Prefetch works during idle

### Nice to Have (Medium Priority):
- ✅ Real device testing successful
- ✅ Performance score > 80
- ✅ No console errors
- ✅ Smooth user experience

---

## Troubleshooting

### Service Worker Not Registering:
1. Check HTTPS (required for service workers)
2. Verify `sw.js` file exists in `dist/`
3. Check browser console for errors
4. Verify `registerSW.js` is loaded

### Cache Not Working:
1. Check cache storage in DevTools
2. Verify cache names match configuration
3. Check service worker status
4. Clear cache and retry

### TTI Not Meeting Target:
1. Check bundle sizes (should be <150 KB main)
2. Verify vendor chunks are separate
3. Check for blocking requests
4. Verify modulepreload links present

### Prefetch Not Working:
1. Check browser support for `requestIdleCallback`
2. Verify RoutePrefetcher component loaded
3. Check Network tab for prefetch requests
4. Verify routes are lazy-loaded

---

## Reporting Issues

When reporting performance issues:

1. **Document:**
   - Test environment (browser, device, network)
   - Throttling settings used
   - Actual metrics vs expected
   - Screenshots of DevTools
   - Lighthouse report (export JSON)

2. **Include:**
   - Network tab screenshot
   - Service worker status
   - Cache storage contents
   - Console errors (if any)
   - Performance timeline

3. **Categorize:**
   - 🔴 **Critical:** Blocks core functionality
   - 🟡 **High:** Major performance issue
   - 🟢 **Medium:** Minor optimization opportunity

---

**Checklist Created:** 2025-01-09  
**Status:** ✅ **READY FOR TESTING**  
**Next Step:** Execute tests and document results








