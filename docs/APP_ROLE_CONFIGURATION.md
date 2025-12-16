# App Role Configuration

## Overview

The KidsCallHome app has three distinct user roles, each with their own isolated pages and dashboards:

1. **Parent** - Primary account holder who manages the family
2. **Family Member** - Extended family (grandparents, aunts, uncles, etc.) with subroles
3. **Child/Kid** - Children who use login codes

## Current Database Schema

### Primary Role Tables

#### `adult_profiles` (Canonical Source of Truth)
- **Purpose**: Unified table for both parents and family members
- **Key Fields**:
  - `user_id`: References `auth.users(id)`
  - `family_id`: References the family grouping
  - `role`: `'parent'` | `'family_member'` (CHECK constraint)
  - `relationship_type`: `'grandparent'` | `'aunt'` | `'uncle'` | `'cousin'` | `'other'` (for family members)
  - `name`, `email`, `avatar_url`
- **Unique Constraint**: `(user_id, family_id, role)` - allows one profile per user per family per role
- **Indexes**: Optimized for `user_id`, `role`, `family_id` lookups

#### Legacy Tables (Still Used, But Being Phased Out)

1. **`parents`** - Legacy table for parents
   - `id` references `auth.users(id)`
   - Contains parent-specific data (family_code, subscription info, etc.)

2. **`family_members`** - Legacy table for family members
   - `id` references `auth.users(id)` (nullable initially)
   - `parent_id` references `parents(id)`
   - `status`: `'pending'` | `'active'` | `'suspended'`
   - `relationship`: `'grandparent'` | `'aunt'` | `'uncle'` | `'cousin'` | `'other'`

### Child Tables

- **`children`** - Child accounts with login codes
- **`child_profiles`** - Profile table for conversations (matches `children.id`)

## Current App Structure

### Route Organization

```
/                    → Index (landing page)
/parent/*            → Parent routes (protected from family members)
  /parent/auth       → Parent/Family member login (shared)
  /parent            → Parent home
  /parent/children   → Parent children list
  /parent/dashboard  → Parent dashboard
  /parent/call/:id   → Parent call screen
  /parent/devices    → Device management
  /parent/settings   → Account settings
  /parent/upgrade    → Subscription upgrade

/family-member/*     → Family member routes (protected from parents)
  /family-member/auth        → Family member login
  /family-member             → Family member dashboard
  /family-member/dashboard   → Family member dashboard (alias)
  /family-member/call/:id    → Family member call screen
  /family-member/invite/:token → Invitation acceptance

/child/*             → Child routes
  /child/login       → Child login
  /child             → Child home
  /child/dashboard   → Child dashboard
  /child/parents     → Child parents list
  /child/call/:id    → Child call screen
```

### Role Detection Flow

**Primary Method**: Check `adult_profiles` table
```typescript
// src/utils/userRole.ts
getUserRole(userId) → 'parent' | 'family_member' | null
```

**Fallback Method**: If `adult_profiles` fails, check legacy tables:
1. Check `family_members` table (for family members)
2. Check `parents` table (for parents)

### Authentication Flow

1. **Login** (`/parent/auth`):
   - Both parents and family members use the same login page
   - After successful login, `authHandlers.ts` checks role via `getUserRole()`
   - If `family_member` → redirect to `/family-member`
   - If `parent` → redirect to `/parent/children`

2. **Route Protection**:
   - All `/parent/*` routes use `useFamilyMemberRedirect()` hook
   - If family member detected → redirect to `/family-member`
   - All `/family-member/*` routes should check for parent role (future enhancement)

3. **Navigation Component**:
   - Detects user type from route path and auth session
   - Shows appropriate navigation based on role

## Current Issues & Solutions

### Issue: Family Members Routed to Parent Pages

**Root Cause**: Role detection was using `family_members` table first, which can have RLS issues or missing records.

**Solution**: 
- Created `getUserRole()` utility that checks `adult_profiles` first (canonical source)
- Updated all role checks to use this utility
- Added `useFamilyMemberRedirect()` hook to all parent routes

### Issue: Inconsistent Role Detection

**Root Cause**: Multiple places checking roles differently (some use `family_members`, some use `adult_profiles`).

**Solution**:
- Centralized role detection in `src/utils/userRole.ts`
- All components now use `getUserRole()` function
- Consistent fallback logic across the app

## Recommended Architecture

### Role Separation

Each role should be completely isolated:

1. **Parent Container** (`/parent/*`)
   - Own pages, dashboards, components
   - Cannot access family member or child pages
   - Manages family, children, subscriptions

2. **Family Member Container** (`/family-member/*`)
   - Own pages, dashboards, components
   - Cannot access parent or child pages
   - Can only view/call children in their family
   - Subroles: grandparent, aunt, uncle, cousin, other

3. **Child Container** (`/child/*`)
   - Own pages, dashboards, components
   - Cannot access parent or family member pages
   - Uses login codes (no auth.users)

### Shared Components

Components that can be reused across roles:
- `Navigation` - Adapts based on user role
- `VideoCallUI` - Works for all roles
- `StatusIndicator` - Shows online/offline status
- UI components (buttons, cards, etc.)

### Data Access Patterns

1. **Use `adult_profiles` for role detection** (primary)
2. **Use `adult_profiles.id` for conversations** (not `auth.uid()`)
3. **Use `family_members` table for family member management** (legacy, but still needed)
4. **Use `parents` table for parent-specific data** (subscriptions, family_code, etc.)

## Migration Path

### Current State
- `adult_profiles` table exists and is populated
- Legacy tables (`parents`, `family_members`) still used
- Role detection now uses `adult_profiles` first

### Future State
- Fully migrate to `adult_profiles` as single source of truth
- Keep legacy tables for backward compatibility
- All role checks use `getUserRole()` utility
- All routes properly protected with role checks

## Testing Checklist

- [ ] Parent login → routes to `/parent/children`
- [ ] Family member login → routes to `/family-member`
- [ ] Family member cannot access `/parent/*` routes
- [ ] Parent cannot access `/family-member/*` routes
- [ ] Child cannot access adult routes
- [ ] Role detection works for users with `adult_profiles` records
- [ ] Role detection falls back to legacy tables if needed
- [ ] Navigation shows correct menu for each role

