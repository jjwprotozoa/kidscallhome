# Function Name Verification Checklist

## ✅ Code Verification

### Function Name in Code

- **File**: `src/pages/AccountSettings.tsx` line 165
- **Name**: `"create-customer-portal-session"` ✅
- **Folder**: `supabase/functions/create-customer-portal-session/` ✅

### Function Invocation

```typescript
const { data, error } = await supabase.functions.invoke(
  "create-customer-portal-session",  // ✅ Correct
  {
    body: {
      returnUrl: `${window.location.origin}/parent/settings`,
    },
  }
);
```

### Comparison with Working Function

**Working function** (`create-stripe-subscription`):

- Invoked as: `"create-stripe-subscription"` ✅
- Folder: `supabase/functions/create-stripe-subscription/` ✅

**Your function** (`create-customer-portal-session`):

- Invoked as: `"create-customer-portal-session"` ✅
- Folder: `supabase/functions/create-customer-portal-session/` ✅

## 🔍 Dashboard Verification Steps

### Step 1: Check Exact Function Name

1. Go to: <https://supabase.com/dashboard/project/itmhojbjfacocrpmslmt/edge-functions>
2. Look at the function list
3. **CRITICAL**: The function name must be EXACTLY: `create-customer-portal-session`
   - ✅ Correct: `create-customer-portal-session` (hyphens)
   - ❌ Wrong: `create_customer_portal_session` (underscores)
   - ❌ Wrong: `createCustomerPortalSession` (camelCase)
   - ❌ Wrong: `create-customer-portal` (missing `-session`)

### Step 2: Check Function Status

- Must show: **"Active"** or **"Deployed"**
- ❌ If shows: **"Draft"** or **"Inactive"** → Click "Deploy" or "Activate"

### Step 3: Verify Function Code

Open the function in dashboard and verify:

1. First line should be: `// Supabase Edge Function: Create Stripe Customer Portal Session`
2. Should have: `import { serve } from "https://deno.land/std@0.168.0/http/server.ts";`
3. Should have: `serve(async (req) => {` around line 69

### Step 4: Test Function Directly

Run this in browser console:

```javascript
// Test OPTIONS (CORS preflight)
fetch('https://itmhojbjfacocrpmslmt.supabase.co/functions/v1/create-customer-portal-session', {
  method: 'OPTIONS'
})
.then(r => {
  console.log('Status:', r.status);
  console.log('Function exists:', r.status !== 404);
  if (r.status === 404) {
    console.error('❌ Function NOT FOUND - Check name in dashboard!');
  } else {
    console.log('✅ Function exists');
  }
});
```

## 🐛 Common Issues

### Issue 1: Function Name Mismatch

**Symptom**: 404 error
**Solution**:

- Delete function with wrong name
- Create new function with EXACT name: `create-customer-portal-session`
- Copy code from `supabase/functions/create-customer-portal-session/index.ts`

### Issue 2: Function Not Active

**Symptom**: 404 error
**Solution**:

- Click "Deploy" or "Activate" button in dashboard
- Wait for deployment to complete
- Verify status shows "Active"

### Issue 3: Wrong Project

**Symptom**: 404 error
**Solution**:

- Verify you're in project: `itmhojbjfacocrpmslmt`
- Check URL: `https://supabase.com/dashboard/project/itmhojbjfacocrpmslmt`

### Issue 4: Function Code Has Errors

**Symptom**: Function exists but returns errors
**Solution**:

- Check function logs in dashboard
- Look for runtime errors
- Verify environment variables are set

## 📋 Quick Fix Checklist

- [ ] Function name in dashboard: `create-customer-portal-session` (exact match)
- [ ] Function status: "Active" or "Deployed"
- [ ] Function is in project: `itmhojbjfacocrpmslmt`
- [ ] Function code matches: `supabase/functions/create-customer-portal-session/index.ts`
- [ ] No `@/` imports in function code
- [ ] Environment variable `STRIPE_SECRET_KEY` is set
- [ ] Test OPTIONS request returns 200/204 (not 404)
