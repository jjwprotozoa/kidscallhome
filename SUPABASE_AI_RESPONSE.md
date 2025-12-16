# Response for Supabase AI

## Testing the Health Check Function

**URL I'm using:** `https://itmhojbjfacocrpmslmt.supabase.co/functions/v1/health-check`

**Preferred approach:** Use the anon key for testing (read-only, safe for health checks)

I'll test with the anon key using this format:

```powershell
$env:SUPABASE_ANON_KEY = "your-anon-key-here"
Invoke-WebRequest -Uri "https://itmhojbjfacocrpmslmt.supabase.co/functions/v1/health-check" -Headers @{ "Authorization" = "Bearer $env:SUPABASE_ANON_KEY" }
```

**No need to redeploy** - The current setup is fine. Health checks with anon key authentication are appropriate for this use case since:

1. It's a read-only endpoint
2. The anon key is safe to use in client-side code
3. It provides basic access control while remaining accessible

**If you want to test it yourself:**

- The function is already deployed
- Use the curl example with your anon key
- Or use the PowerShell command above

The health check function is working as expected - the 401 just means we need to include the Authorization header with the anon key, which is the correct behavior.





