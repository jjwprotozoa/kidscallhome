# Subscription Limits Explained

## How Subscription Limits Work

Subscription limits control **the number of children that can be added to a family account**, NOT device usage or login restrictions.

## Subscription Tiers & Limits

### Free Tier (1 Child)
- ✅ Can add **1 child total**
- ✅ That 1 child can log in on **any device** (unlimited devices)
- ✅ That 1 child can log in on **multiple devices simultaneously**
- ❌ Cannot add a 2nd child (blocked by `can_add_child()` function)
- ❌ Cannot have multiple children log in (only 1 child exists)

### Family Bundle Monthly (5 Children)
- ✅ Can add **up to 5 children total**
- ✅ All 5 children can log in on **any device** (unlimited devices)
- ✅ All 5 children can log in on **multiple devices simultaneously**
- ✅ All children share the same family code
- ❌ Cannot add a 6th child (blocked by `can_add_child()` function)

### Annual Family Plan (Unlimited)
- ✅ Can add **unlimited children** (999+)
- ✅ All children can log in on **any device** (unlimited devices)
- ✅ All children can log in on **multiple devices simultaneously**
- ✅ No restrictions on number of children

## How It Works

### Adding Children (Restricted by Subscription)
- When parent clicks "Add Child", system checks `can_add_child()` function
- Function compares `current_children_count` vs `allowed_children`
- If at limit, "Add Child" button is disabled and shows warning
- If under limit, child can be added successfully

### Child Login (NOT Restricted by Subscription)
- Child login only verifies the login code exists in database
- **No subscription check** during login
- Children can log in on:
  - Same device (multiple children can use same tablet)
  - Different devices (each child has their own device)
  - Multiple devices simultaneously (same child on multiple devices)
- Device tracking is separate and doesn't restrict logins

## Device Tracking vs Subscription Limits

### Device Tracking
- Purpose: Security and monitoring
- Tracks which devices are used
- Allows device authorization (skip family code on trusted devices)
- **Does NOT restrict based on subscription**

### Subscription Limits
- Purpose: Control number of children per account
- Checks `allowed_children` vs `current_children_count`
- Only enforced when **adding** children
- **Does NOT restrict device usage or logins**

## Example Scenarios

### Scenario 1: Free Tier (1 Child)
- Parent adds 1 child: "Emma"
- Emma can log in on:
  - iPad at home ✅
  - Tablet at school ✅
  - Phone at friend's house ✅
  - All devices simultaneously ✅
- Parent tries to add 2nd child: "Lucas"
  - ❌ Blocked: "Subscription Limit Reached"
  - Must upgrade to add Lucas

### Scenario 2: Family Bundle (5 Children)
- Parent adds 5 children: Emma, Lucas, Mia, Noah, Ava
- All 5 children can log in on:
  - Same tablet (taking turns) ✅
  - Different devices (each has their own) ✅
  - Multiple devices each ✅
- Parent tries to add 6th child: "Oliver"
  - ❌ Blocked: "Subscription Limit Reached"
  - Must upgrade to Annual Family Plan

### Scenario 3: Unlimited Plan
- Parent can add unlimited children
- All children can log in on any devices
- No restrictions

## Database Function: `can_add_child()`

```sql
-- Returns TRUE if parent can add more children
-- Returns FALSE if at limit

-- Free tier: current_children < 1
-- Paid plans: current_children < allowed_children
-- Unlimited: Always TRUE (allowed_children >= 999)
```

## Enforcement Points

### ✅ Enforced:
1. **AddChildDialog** - Checks `can_add_child()` before allowing child addition
2. **ParentDashboard** - Disables "Add Child" button when at limit
3. **Database** - `can_add_child()` function enforces limits

### ❌ NOT Enforced:
1. **ChildLogin** - No subscription check (children can always log in)
2. **Device Usage** - No device limits based on subscription
3. **Multiple Devices** - No restrictions on number of devices

## Summary

- **Subscription = Number of children you can ADD**
- **NOT = Device restrictions or login restrictions**
- Children can log in on unlimited devices
- Multiple children can share devices
- Same child can use multiple devices
- Only restriction: Number of children that can be added to account

