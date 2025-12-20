# Security Tests - Deployment Notes

## Understanding Test Results

### 404 Errors (Endpoint Not Found)

If you see `⚠️ SKIP: Endpoint not found (404)`, this means:

1. **Edge Functions may not be deployed yet**

   - Deploy your Edge Functions to Supabase first
   - Run: `supabase functions deploy create-stripe-subscription`
   - Run: `supabase functions deploy stripe-webhook`
   - Run: `supabase functions deploy create-customer-portal-session`
   - Run: `supabase functions deploy send-family-member-invitation`

2. **Functions are deployed but path is different**

   - Verify the function paths in Supabase dashboard
   - Update `FUNCTION_BASE` if needed
   - Check Supabase project settings

3. **Functions require different authentication**
   - Some functions may need service role key instead of anon key
   - Check function configuration in Supabase

### Expected Results After Deployment

Once Edge Functions are deployed, you should see:

- ✅ **CORS Tests:** 200/401 for allowed origins, 403 for disallowed
- ✅ **Content-Type Tests:** 200/401 for valid, 400 for invalid
- ✅ **Input Validation:** 200/401 for valid, 400 for invalid quantity
- ✅ **Security Headers:** Headers present in responses

### Testing Without Deployed Functions

You can still test:

1. **Security Headers** - Test on your deployed frontend URL:

   ```powershell
   $env:BASE_URL = "https://www.kidscallhome.com"
   .\scripts\security-tests.ps1 headers
   ```

2. **Manual Testing** - Use browser DevTools or Postman:
   - Test CORS by sending requests with different Origin headers
   - Test Content-Type validation
   - Test input validation

## Deploying Edge Functions

### Prerequisites

1. Install Supabase CLI:

   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:

   ```bash
   supabase login
   ```

3. Link your project:
   ```bash
   supabase link --project-ref itmhojbjfacocrpmslmt
   ```

### Deploy Functions

```bash
# Deploy all functions
supabase functions deploy create-stripe-subscription
supabase functions deploy stripe-webhook
supabase functions deploy create-customer-portal-session
supabase functions deploy send-family-member-invitation
```

### Verify Deployment

1. Check Supabase Dashboard → Edge Functions
2. Test endpoints manually:
   ```powershell
   Invoke-WebRequest -Uri "https://itmhojbjfacocrpmslmt.supabase.co/functions/v1/create-stripe-subscription" -Method OPTIONS
   ```

## Alternative: Test on Staging/Production

If functions are deployed to a different environment:

```powershell
# Use your deployed URL
$env:BASE_URL = "https://your-deployed-app.vercel.app"
$env:FUNCTION_BASE = "https://itmhojbjfacocrpmslmt.supabase.co/functions/v1"

.\scripts\security-tests.ps1 all
```

## Next Steps

1. ✅ Deploy Edge Functions (if not already deployed)
2. ✅ Re-run security tests
3. ✅ Verify all tests pass
4. ✅ Document any issues found
5. ✅ Fix and re-test









