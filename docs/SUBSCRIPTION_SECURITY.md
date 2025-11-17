# Subscription Security & Anti-Fraud Measures

## Overview

The subscription system includes multiple layers of security to prevent:
- Subscription sharing across multiple accounts
- Duplicate payment usage
- Unauthorized account upgrades

## Security Measures

### 1. **Email Verification**
- ✅ Email must match authenticated user's account
- ✅ Frontend locks email to authenticated user
- ✅ Backend function verifies `auth.uid()` matches email
- ✅ Prevents users from upgrading other accounts

### 2. **Duplicate Payment Prevention**
- ✅ `stripe_checkout_sessions` table tracks all used checkout sessions
- ✅ Each Stripe checkout session can only be used once
- ✅ Prevents reusing the same payment for multiple accounts
- ✅ Database constraint ensures uniqueness

### 3. **Authentication Required**
- ✅ All upgrade operations require authenticated session
- ✅ Function checks `auth.uid()` before processing
- ✅ Returns error if user is not authenticated

### 4. **Row Level Security (RLS)**
- ✅ Parents can only view their own checkout sessions
- ✅ RLS policies enforce data isolation
- ✅ Prevents cross-account data access

## Implementation Details

### Database Function Security

The `upgrade_family_subscription()` function includes:

```sql
-- 1. Verify authentication
v_authenticated_user_id := auth.uid();
IF v_authenticated_user_id IS NULL THEN
  RETURN error: 'Authentication required'
END IF;

-- 2. Verify email matches authenticated user
IF v_parent_id != v_authenticated_user_id THEN
  RETURN error: 'You can only upgrade your own account'
END IF;

-- 3. Check for duplicate checkout sessions
IF checkout_session_already_used THEN
  RETURN error: 'This payment has already been processed'
END IF;
```

### Frontend Security

1. **Email Auto-Fill & Lock**
   - Email is automatically set to authenticated user's email
   - Email field is read-only/locked
   - Prevents manual email entry

2. **Pre-Submit Verification**
   - Frontend verifies email matches authenticated user before submitting
   - Shows error if mismatch detected

3. **Backend Verification**
   - Even if frontend is bypassed, backend verifies email match
   - Double layer of security

## Device-Based Restrictions (Future Enhancement)

While not currently implemented, device-based restrictions could be added:

### Option 1: Device Limit Per Subscription
- Track devices per subscription
- Limit number of devices that can use a subscription
- Useful for preventing account sharing

### Option 2: Device Fingerprinting
- Use device tracking system to identify unique devices
- Flag suspicious activity (many devices, different locations)
- Alert admin for review

### Option 3: IP-Based Restrictions
- Track IP addresses for subscription usage
- Flag rapid IP changes as suspicious
- Could indicate account sharing

## Current Protection Level

✅ **Protected Against:**
- Using one subscription for multiple accounts (email verification)
- Reusing same payment multiple times (checkout session tracking)
- Upgrading someone else's account (authentication + email match)
- Unauthenticated upgrades (auth.uid() check)

⚠️ **Not Protected Against (Requires Additional Implementation):**
- Account sharing on same device (would need device limits)
- Rapid account switching (would need rate limiting)
- Subscription reselling (would need device/IP tracking)

## Recommendations

### For Production:

1. **Stripe Webhook Integration**
   - Use Stripe webhooks to verify payments server-side
   - Pass actual checkout session ID from Stripe
   - Verify payment status before upgrading

2. **Rate Limiting**
   - Limit upgrade attempts per account
   - Prevent rapid subscription changes
   - Add cooldown period between upgrades

3. **Audit Logging**
   - Log all subscription changes
   - Track who upgraded when
   - Monitor for suspicious patterns

4. **Device Tracking** (Optional)
   - Track devices per subscription
   - Set reasonable device limits
   - Alert on excessive device usage

## Testing Security

To test the security measures:

1. **Email Mismatch Test**
   - Try upgrading with different email
   - Should fail with "You can only upgrade your own account"

2. **Duplicate Payment Test**
   - Use same checkout session ID twice
   - Second attempt should fail with "payment already processed"

3. **Unauthenticated Test**
   - Try upgrading without authentication
   - Should fail with "Authentication required"

4. **Cross-Account Test**
   - Log in as User A
   - Try to upgrade User B's account
   - Should fail with email verification error

