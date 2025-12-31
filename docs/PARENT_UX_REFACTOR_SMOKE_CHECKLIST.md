# Parent UX Refactor - Smoke Checklist

## Overview
This document provides manual testing steps for the parent UX consolidation refactor.

## Changes Summary
1. ✅ ParentHome redirects to /parent/children
2. ✅ ParentChildrenList uses compact 1-row contact-list layout
3. ✅ ChildActionsSheet component added with More/kebab button
4. ✅ Navigation menu "Dashboard" renamed to "Family"
5. ✅ Route paths unchanged (backwards compatible)

---

## Manual Smoke Tests

### 1. Routing & Navigation
- [ ] Navigate to `/parent` → Should automatically redirect to `/parent/children` (no UI flash, minimal loader only)
- [ ] Navigate to `/parent/children` → Should load children list directly
- [ ] Navigate to `/parent/dashboard` → Should still work (backwards compatibility)
- [ ] Menu item "Family" → Should navigate to `/parent/dashboard` (label changed, route unchanged)
- [ ] Menu ordering → Should be: Home, Children, Family, Connections, Safety, More (Devices/Settings)

### 2. ParentChildrenList - Compact Layout
- [ ] Children list displays in compact 1-row format
- [ ] Each child card shows:
  - [ ] Avatar (left)
  - [ ] Child name + status dot (left)
  - [ ] Call button (right)
  - [ ] Message button with unread badge (right)
  - [ ] More/kebab button (right)
- [ ] Layout is responsive on mobile and desktop
- [ ] Loading skeleton matches final layout structure

### 3. ChildActionsSheet
- [ ] Click More/kebab button → Opens bottom sheet
- [ ] Bottom sheet shows:
  - [ ] Child name in header
  - [ ] Login code (masked by default with eye icon to reveal)
  - [ ] Copy Code button
  - [ ] Copy Link button
  - [ ] View QR button
  - [ ] Print button
  - [ ] Remove Child button (danger zone)
- [ ] Click "View QR" → Opens QR code dialog
- [ ] Click "Print" → Opens print view dialog
- [ ] Click "Remove Child" → Shows confirmation dialog
- [ ] Confirm removal → Child is deleted and list refreshes

### 4. Call & Message Actions
- [ ] Click Call button → Navigates to `/parent/call/{childId}` and call starts
- [ ] Click Message button → Opens chat with conversation resolved
- [ ] Unread message badge shows correct count
- [ ] Badge is invisible when count is 0 (prevents layout shift)

### 5. Code Management Actions
- [ ] Copy Code → Code copied to clipboard, toast shown
- [ ] Copy Link → Magic link copied to clipboard, toast shown
- [ ] View QR → QR code dialog opens with correct code
- [ ] Print → Print view opens with correct code and QR

### 6. ParentDashboard (Admin Hub)
- [ ] Navigate to `/parent/dashboard` → Still loads correctly
- [ ] All tabs work: Children, Family, Connections, Safety, Setup, Referrals
- [ ] Family Code display still works
- [ ] Child management functions still work from dashboard
- [ ] No duplicate subscription controls (should only be in Account Settings)

### 7. Account Settings
- [ ] Navigate to `/parent/settings` → Subscription management still works
- [ ] No subscription controls added to dashboard

### 8. Backwards Compatibility
- [ ] Old bookmarks to `/parent` still work (redirects)
- [ ] Old bookmarks to `/parent/dashboard` still work
- [ ] Navigate to `/parent/dashboard?tab=safety` → Should redirect to `/parent/safety` (replace: true)
- [ ] Navigate to `/parent/dashboard?tab=connections` → Should redirect to `/parent/connections` (replace: true)
- [ ] Menu links match destinations:
  - [ ] "Children" menu item → Routes to `/parent/children`
  - [ ] "Family" menu item → Routes to `/parent/dashboard`
  - [ ] "Connections" menu item → Routes to `/parent/connections`
  - [ ] "Safety" menu item → Routes to `/parent/safety`
- [ ] No broken links or 404 errors

---

## Test Commands

### Check for TypeScript errors
```bash
npm run type-check
```

### Check for linting errors
```bash
npm run lint
```

### Run build (if applicable)
```bash
npm run build
```

---

## Known Issues / Notes
- None currently

---

## Files Modified
- `src/pages/ParentHome.tsx` - Added redirect to /parent/children
- `src/pages/ParentChildrenList.tsx` - Refactored to compact layout, integrated ChildActionsSheet
- `src/components/ChildActionsSheet.tsx` - New component for child actions
- `src/components/Navigation.tsx` - Renamed "Dashboard" to "Family" in menu

## Files Created
- `src/components/ChildActionsSheet.tsx` - Bottom sheet for child actions
- `docs/PARENT_UX_REFACTOR_SMOKE_CHECKLIST.md` - This checklist

