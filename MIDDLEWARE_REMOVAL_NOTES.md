# Middleware Removal Notes

## What Was Removed

The `middleware.ts` file was removed because it was intercepting requests in a Vite/React static deployment, causing 401 errors on static files like `manifest.json`.

## Security Headers (Now in vercel.json)

All security headers have been moved to `vercel.json`:
- Content-Security-Policy
- Cross-Origin-Embedder-Policy
- X-Content-Type-Options
- X-Frame-Options (set to DENY)
- X-XSS-Protection
- Referrer-Policy
- Permissions-Policy

## Functionality That Needs to Be Moved to API Layer

The following features from the middleware need to be implemented at the API layer:

### 1. Rate Limiting
- **Location**: Supabase Edge Functions or Vercel Edge Functions
- **Endpoints to protect**: `/auth/v1/token`, `/auth/v1/signup`, `/rest/v1/*`
- **Implementation**: Use Upstash Redis or similar for distributed rate limiting

### 2. Bot Detection
- **Location**: Supabase Edge Functions or API endpoints
- **User-Agent patterns to block**: headless, phantom, selenium, webdriver, puppeteer, playwright, scrapy, bot, crawler, spider
- **Endpoints to protect**: `/auth/*`, `/api/*`

### 3. Origin Validation
- **Location**: Supabase Edge Functions or API endpoints
- **Allowed origins**: 
  - https://www.kidscallhome.com
  - https://kidscallhome.com
  - http://localhost:8080
  - http://localhost:5173
- **Methods to validate**: POST, PUT, DELETE, PATCH

## Recommended Implementation

### Option 1: Supabase Edge Functions (Recommended)
- Create Edge Functions for sensitive endpoints
- Implement rate limiting using Upstash Redis
- Add bot detection and origin validation in the Edge Functions

### Option 2: Vercel Edge Functions
- Create `/api/*` Edge Functions
- Implement rate limiting and validation there
- Route sensitive calls through `/api/*` instead of direct Supabase calls

## Why This Approach is Better

1. **Static files are untouched** - No middleware intercepting manifest.json or other static assets
2. **Proper separation** - Security logic lives at the API layer where it belongs
3. **No 401 errors** - Static files are served directly by Vercel without interference
4. **Better performance** - No middleware overhead for static file requests
5. **Scalable** - Rate limiting can use distributed storage (Redis) instead of in-memory maps

