# Verify Edge Function Deployment

## Quick Verification Steps

### 1. Check Function Exists in Dashboard

1. Go to: <https://supabase.com/dashboard/project/itmhojbjfacocrpmslmt/edge-functions>
2. Look for a function named exactly: `create-customer-portal-session`
3. Verify it shows as **"Active"** or **"Deployed"** (not "Draft" or "Inactive")

### 2. Test Function Directly

Open your browser console and run:

```javascript
// Test if function exists (OPTIONS request)
fetch('https://itmhojbjfacocrpmslmt.supabase.co/functions/v1/create-customer-portal-session', {
  method: 'OPTIONS'
})
.then(r => {
  console.log('Status:', r.status);
  console.log('Function exists:', r.status !== 404);
  return r.text();
})
.then(text => console.log('Response:', text))
.catch(err => console.error('Error:', err));
```

**Expected Result:**

- Status: `200` or `204` = Function exists ✅
- Status: `404` = Function not found ❌

### 3. Common Issues

#### Issue: Function name mismatch

- **Problem**: Function deployed as `create_customer_portal_session` (underscores) or `createCustomerPortalSession` (camelCase)
- **Solution**: Function name MUST be exactly `create-customer-portal-session` (with hyphens)

#### Issue: Function not activated

- **Problem**: Function saved but not deployed/activated
- **Solution**: Click "Deploy" or "Activate" button in dashboard

#### Issue: Wrong project

- **Problem**: Function deployed to different Supabase project
- **Solution**: Verify you're in project `itmhojbjfacocrpmslmt`

#### Issue: Function code has errors

- **Problem**: Function deployed but has runtime errors
- **Solution**: Check function logs in dashboard → Logs tab

### 4. Redeploy Function

If function doesn't exist or has issues:

1. **Delete existing function** (if it exists with wrong name)
2. **Create new function** with exact name: `create-customer-portal-session`
3. **Copy code** from: `supabase/functions/create-customer-portal-session/index.ts`
4. **Paste into dashboard editor**
5. **Click "Deploy"**
6. **Verify** it shows as "Active"

### 5. Verify Environment Variables

Go to: **Project Settings** → **Edge Functions** → **Secrets**

Ensure these are set:

- `STRIPE_SECRET_KEY` (required for this function)
- `SUPABASE_URL` (usually auto-set)
- `SUPABASE_ANON_KEY` (usually auto-set)

### 6. Check Function Logs

1. Go to Edge Functions → `create-customer-portal-session`
2. Click **"Logs"** tab
3. Look for errors or deployment issues
4. Try invoking the function and check logs for runtime errors

## After Verification

Once the function is deployed and active, the 404 error should be resolved. The improved error handling will show a clearer message if there are other issues.

