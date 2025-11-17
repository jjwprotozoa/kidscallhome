# Subscription System

## Overview

The subscription system tracks subscription tiers and allowed children limits for family accounts. Subscriptions are **platform-agnostic** - stored in the database and accessible from both PWA and native apps.

## Cross-Platform Subscription Sync

✅ **Subscriptions work across all platforms:**

- Subscribe on PWA → Visible in Play Store app
- Subscribe on Play Store → Visible in PWA
- Subscribe on App Store → Visible in PWA

**How it works:**
- Subscriptions are stored in the `parents` table in the database
- Tied to parent account (email/user ID), not platform
- Both PWA and native apps read from the same database
- When you log in with the same account on any platform, your subscription is visible

## Database Migration

**CRITICAL**: Run this migration before using subscriptions:

```sql
-- File: supabase/migrations/20250122000007_add_subscription_system.sql
```

The migration adds:
- `allowed_children` column (default: 1)
- `subscription_type` column (default: 'free')
- `subscription_status` column
- `subscription_started_at`, `subscription_expires_at` columns
- `can_add_child()` function to check limits
- `upgrade_family_subscription()` function to upgrade accounts

## Subscription Tiers

### Free Tier (Default)
- 1 child allowed
- No payment required

### Additional Kid Monthly
- $2.99/month
- Adds 1 child to existing limit
- Quantity selectable

### Additional Kid Annual
- $29.99/year (save 17% vs monthly)
- Adds 1 child to existing limit
- Quantity selectable

### Family Bundle Monthly
- $14.99/month
- Up to 5 children total
- Fixed plan (no quantity)

### Annual Family Plan (Recommended)
- $99/year
- Unlimited children (999+)
- Best value option

## Platform-Specific Behavior

### PWA (Progressive Web App)
- Shows Stripe payment links
- Upgrade page visible
- Payment handled through Stripe checkout

### Native Apps (Play Store / App Store)
- Upgrade button hidden (uses in-app purchases)
- Shows message directing to app store
- Payment handled through platform's in-app purchase system

**Note**: Native apps should sync subscription status from the app store and call `upgrade_family_subscription()` with the appropriate parameters when a purchase is confirmed.

## Error Handling

The code gracefully handles missing migrations:
- Detects column doesn't exist errors (code 42703)
- Shows helpful error messages
- Falls back to defaults (free tier, 1 child)
- Won't crash the app if migration hasn't been run

## Subscription Limit Enforcement

- `can_add_child()` function checks if parent can add more children
- Enforced in `AddChildDialog` before allowing child addition
- "Add Child" button disabled when limit reached
- Warning card shown when at limit

## Testing Cross-Platform Sync

1. Subscribe on PWA with account `parent@example.com`
2. Log into Play Store app with same account
3. Verify subscription shows as active
4. Verify `allowed_children` limit is correct
5. Try adding children - should respect limit from PWA subscription

