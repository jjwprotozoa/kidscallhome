# Cloudflare CSP Violations Fix

## Problem

Cloudflare is injecting a restrictive CSP header (`script-src 'none'`) that blocks its own challenge scripts, causing CSP violations and preventing Turnstile from working.

## Symptoms

- Console errors: `script-src 'none'` violations
- Cloudflare challenge scripts blocked
- Turnstile widget crashes
- CSP violations logged (report-only mode)

## Root Cause

Cloudflare's **Transform Rules** or **Page Rules** may be adding CSP headers that override your application's CSP configuration.

## Solution

### Step 1: Disable Cloudflare CSP Transformation

1. **Go to Cloudflare Dashboard:**

   - Navigate to: **Rules** → **Transform Rules** → **Modify Response Header**
   - Or: **Rules** → **Page Rules**

2. **Check for CSP Rules:**

   - Look for any rules that modify `Content-Security-Policy` header
   - Look for rules that add security headers

3. **Disable or Delete:**
   - Disable any rules that modify CSP headers
   - Or delete them if not needed

### Step 2: Check Cloudflare Security Settings

1. **Go to Security → Settings:**

   - **Security Level**: Set to "Medium" (not "High" or "I'm Under Attack")
   - **Challenge Passage**: Ensure it's not too restrictive

2. **Check Bot Fight Mode:**
   - Go to **Security** → **Bots**
   - If "Bot Fight Mode" is enabled, consider disabling it
   - It can interfere with Turnstile

### Step 3: Verify CSP Headers

After disabling Cloudflare CSP transformation, verify your CSP is being applied:

1. **Check Response Headers:**

   ```bash
   curl -I https://www.kidscallhome.com
   ```

2. **Look for:**
   - `Content-Security-Policy` header should match your `vercel.json` configuration
   - Should NOT have `script-src 'none'`
   - Should include Cloudflare domains

### Step 4: Alternative - Use Cloudflare Workers (Advanced)

If you need Cloudflare to manage CSP, create a Worker that merges CSP headers instead of replacing them:

```javascript
addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const response = await fetch(request);

  // Get existing CSP from origin
  const existingCSP = response.headers.get("Content-Security-Policy") || "";

  // Merge with Cloudflare requirements
  const mergedCSP = existingCSP + "; script-src https://*.cloudflare.com blob:";

  // Clone response and update headers
  const newResponse = new Response(response.body, response);
  newResponse.headers.set("Content-Security-Policy", mergedCSP);

  return newResponse;
}
```

## Updated CSP Configuration

The `vercel.json` CSP has been updated to include:

- `blob:` in `script-src` (for Cloudflare challenge workers)
- `https://www.kidscallhome.com` in `script-src` (for challenge scripts)
- `blob:` in `worker-src` (for Cloudflare workers)
- `https://*.cloudflare.com` in `worker-src`

## Verification

After applying fixes:

1. **Clear browser cache**
2. **Reload page**
3. **Check console** - CSP violations should be gone
4. **Test Turnstile** - Should work without errors

## Important Notes

- **Report-Only Mode**: The violations you're seeing are in "report-only" mode, meaning they're logged but not blocking functionality yet
- **Cloudflare Override**: Cloudflare can override headers at the edge, so disabling transformation is critical
- **Multiple CSP Headers**: If multiple CSP headers exist, browsers use the most restrictive one

## Still Having Issues?

1. Check Cloudflare **Transform Rules** for CSP modifications
2. Check **Page Rules** for header modifications
3. Check **Workers** for CSP modifications
4. Verify **Security Level** isn't too high
5. Check **Bot Fight Mode** settings
