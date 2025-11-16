# Safe-Area Regression Checklist

Quick sanity check for safe-area behavior across devices.

## Device Testing Checklist

**Code Verification (2025-01-XX):** ✅ All safe-area code patterns verified
**Manual Testing Required:**

- [ ] Header/nav not under Dynamic Island on iPhone 15 Pro Max (portrait & landscape)
- [ ] Call controls not overlapping home indicator
- [ ] Bottom CTA buttons are clickable and visible on notched devices
- [ ] No content clipped on Android with hole-punch displays
- [ ] No unintended scrollbars or double padding at top/bottom on non-notch devices

**Testing Instructions:**

1. Open app in browser dev tools
2. Set device to iPhone 15 Pro Max (portrait & landscape)
3. Verify nav bar respects Dynamic Island area
4. Verify call controls don't overlap home indicator
5. Switch to Android device with hole-punch (e.g., Samsung Galaxy S10+)
6. Verify no content clipping
7. Test on non-notch device to ensure no double padding

## Core Requirements

### ✅ SafeAreaLayout at Root

- `src/App.tsx` wraps `<BrowserRouter>` with `<SafeAreaLayout>`
- `SafeAreaLayout` uses `min-h-[100dvh]` (not `h-screen`)

### ✅ Safe-Area CSS Variables

- `src/index.css` defines:
  - `--safe-area-inset-top`
  - `--safe-area-inset-right`
  - `--safe-area-inset-bottom`
  - `--safe-area-inset-left`
- Classes `.safe-area-layout`, `.safe-area-top`, `.safe-area-bottom` exist

### ✅ Navigation

- `src/components/Navigation.tsx` uses `safe-area-top` on nav containers

### ✅ Bottom Elements

- `src/features/onboarding/HelpBubble.tsx` respects bottom safe area
- `src/features/calls/components/CallControls.tsx` respects bottom safe area

### ✅ Viewport Meta

- `index.html` has `viewport-fit=cover` in viewport meta tag

## Last Updated

- **2025-01-XX**: Initial checklist created
- **2025-01-XX**: Code verification complete - all safe-area patterns confirmed in codebase

---

**Note**: Update this doc only when behavior changes, not for trivial CSS tweaks.
