# Safe-Area Verification Report

**Date:** 2025-01-XX  
**Baseline Tags:** `v0.9-safe-area-stable`, `calls-safe-area-guardian-baseline`  
**Commit:** `137f61b`

## Code Verification Results ✅

### 1. SafeAreaLayout at Root
- ✅ `src/App.tsx` wraps `<BrowserRouter>` with `<SafeAreaLayout>` (line 41-64)
- ✅ `SafeAreaLayout` uses `min-h-[100dvh]` (not `h-screen`) (line 23)

### 2. Safe-Area CSS Contract
- ✅ `src/index.css` defines all required CSS variables:
  - `--safe-area-inset-top` (line 8)
  - `--safe-area-inset-right` (line 9)
  - `--safe-area-inset-bottom` (line 10)
  - `--safe-area-inset-left` (line 11)
- ✅ Required classes exist:
  - `.safe-area-layout` (line 14)
  - `.safe-area-top` (line 21)
  - `.safe-area-bottom` (line 25)

### 3. Navigation
- ✅ `src/components/Navigation.tsx` uses `safe-area-top` on nav containers (lines 114, 149)

### 4. Bottom Elements
- ✅ `src/features/onboarding/HelpBubble.tsx` respects bottom safe area:
  - Uses `safe-area-bottom` class (line 42)
  - Uses `calc(1rem + var(--safe-area-inset-bottom))` for positioning (line 44)
- ✅ `src/features/calls/components/CallControls.tsx` respects bottom safe area:
  - Uses `calc(2rem + var(--safe-area-inset-bottom))` for positioning (line 25)

### 5. Page Heights
- ✅ All full-screen pages use `min-h-[100dvh]` (verified in 15+ page files)
- ✅ No instances of `h-screen` or `100vh` found in full-screen layouts

### 6. Viewport Meta
- ✅ `index.html` has `viewport-fit=cover` in viewport meta tag (line 5)

## Manual Testing Required

The following visual tests should be performed on actual devices or accurate simulators:

### iPhone 15 Pro Max Testing
- [ ] **Portrait:** Header/nav not under Dynamic Island
- [ ] **Landscape:** Header/nav not under Dynamic Island
- [ ] Call controls don't overlap home indicator
- [ ] Bottom CTA buttons (HelpBubble) are clickable and visible

### Android Hole-Punch Testing
- [ ] **Samsung Galaxy S10+** or similar: No content clipped around camera cutout
- [ ] Navigation respects top safe area
- [ ] Bottom elements respect bottom safe area

### Non-Notch Device Testing
- [ ] No unintended scrollbars
- [ ] No double padding at top/bottom
- [ ] Layout looks normal on standard rectangular screens

## Testing Instructions

1. **Browser Dev Tools:**
   - Open Chrome/Firefox DevTools
   - Toggle device toolbar (Ctrl+Shift+M / Cmd+Shift+M)
   - Select "iPhone 15 Pro Max" device
   - Test both portrait and landscape orientations
   - Verify nav bar positioning relative to Dynamic Island

2. **Android Testing:**
   - Use Chrome DevTools device emulation
   - Select "Samsung Galaxy S10+" or similar hole-punch device
   - Verify no content clipping around camera cutout

3. **Call Screen Testing:**
   - Navigate to a call screen (`/call/:childId`)
   - Verify call controls don't overlap home indicator
   - Test on both iOS and Android devices

4. **Help Bubble Testing:**
   - Navigate to any page with HelpBubble (dashboard pages)
   - Verify bottom button is clickable and visible
   - Test on notched devices

## Files Verified

- `src/App.tsx` - SafeAreaLayout wrapper
- `src/index.css` - CSS variables and classes
- `src/components/layout/SafeAreaLayout.tsx` - Layout component
- `src/components/Navigation.tsx` - Top navigation
- `src/features/onboarding/HelpBubble.tsx` - Bottom FAB
- `src/features/calls/components/CallControls.tsx` - Call controls
- `index.html` - Viewport meta tag
- All page components using `min-h-[100dvh]`

## Next Steps

1. Perform manual device testing using the checklist above
2. Update `docs/SAFE_AREA_REGRESSION.md` with test results
3. Document any issues found
4. Create fixes if needed and re-tag baseline

---

**Note:** This baseline represents a code-verified state. Manual device testing is recommended before production deployment.

