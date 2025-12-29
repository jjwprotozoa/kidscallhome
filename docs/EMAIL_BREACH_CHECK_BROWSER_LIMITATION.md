# Email Breach Check - Browser Limitation

## The Issue

The Have I Been Pwned API doesn't support direct browser calls due to CORS (Cross-Origin Resource Sharing) restrictions. When the app tries to check email addresses against the breach database, you may see console errors like:

```
Access to fetch at 'https://haveibeenpwned.com/api/v3/breachedaccount/...' 
from origin 'http://localhost:8080' has been blocked by CORS policy
```

And:

```
GET https://haveibeenpwned.com/api/v3/breachedaccount/... net::ERR_FAILED 401 (Unauthorized)
```

## Why This Happens

1. **CORS Policy**: The Have I Been Pwned API doesn't allow direct browser requests for security reasons
2. **API Key Required**: The v3 API requires an API key, and even with a key, CORS is still blocked
3. **Server-Side Only**: The API is designed to be called from server-side code, not browsers

## Current Behavior

The code **gracefully handles these errors**:

- ✅ All errors are caught and handled
- ✅ Signup **never blocks** due to API failures (fail-open behavior)
- ✅ Users can complete signup normally
- ⚠️ Browser console may show CORS/401 errors (harmless, but noisy)

## Solution Options

### Option 1: Server-Side Proxy (Recommended for Production)

Create a server-side endpoint that proxies requests to Have I Been Pwned:

```typescript
// Example: Supabase Edge Function or API route
// POST /api/check-email-breach
// Body: { email: string }
// Returns: { isPwned: boolean, breachCount?: number, breaches?: Array }
```

Then update `checkEmailBreach()` to call your proxy endpoint instead of the API directly.

### Option 2: Disable in Development (Quick Fix)

If the console noise is distracting during development, you can disable email breach checking:

```typescript
// In useEmailBreachCheck.ts
if (import.meta.env.DEV) {
  // Skip breach check in development to avoid CORS errors
  return { checkingEmailBreach: false, emailBreachInfo: null };
}
```

### Option 3: Accept Console Errors (Current State)

The current implementation is **functionally correct** - it fails open and never blocks signup. The console errors are harmless but noisy. This is acceptable for development, but production should use Option 1.

## Impact on Users

**Zero impact** - The fail-open behavior ensures:
- Users can always sign up, even if the API is unavailable
- No user-facing errors are shown
- The feature simply doesn't work in browser environment (needs server-side proxy)

## Next Steps

For production deployment:
1. Create a server-side proxy endpoint (Supabase Edge Function recommended)
2. Update `checkEmailBreach()` to call the proxy instead of the API directly
3. The proxy should include the HIBP API key and handle rate limiting

For now, the console errors are expected and harmless - the feature fails gracefully.

