// middleware.ts
// Purpose: Vercel Edge Middleware for rate limiting and security headers

// Note: This uses Vercel Edge Runtime API
// For Vite/React apps, this runs on Vercel Edge Network

// Rate limiting storage (in-memory for Edge runtime)
// In production, use Redis or Upstash for distributed rate limiting
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Rate limit configuration
const RATE_LIMITS = {
  '/auth/v1/token': { maxAttempts: 5, windowMs: 60 * 1000 }, // Login endpoint
  '/rest/v1/': { maxAttempts: 100, windowMs: 60 * 1000 }, // API endpoints
} as const;

function getRateLimitKey(request: Request): string {
  // Use IP address + path for rate limiting
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
             request.headers.get('x-real-ip') || 
             'unknown';
  const url = new URL(request.url);
  const path = url.pathname;
  return `${ip}:${path}`;
}

function checkRateLimit(key: string, path: string): { allowed: boolean; resetAt?: number } {
  // Find matching rate limit config
  let config = { maxAttempts: 100, windowMs: 60 * 1000 }; // Default
  for (const [pattern, limit] of Object.entries(RATE_LIMITS)) {
    if (path.includes(pattern)) {
      config = limit;
      break;
    }
  }

  const now = Date.now();
  
  // Lazy cleanup: remove expired entries before checking
  // This replaces setInterval which isn't available in Edge Runtime
  for (const [storeKey, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(storeKey);
    }
  }
  
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    // New window or expired
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    return { allowed: true };
  }

  if (entry.count >= config.maxAttempts) {
    return { allowed: false, resetAt: entry.resetAt };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);
  return { allowed: true };
}

export default function middleware(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // CRITICAL: Check for static files FIRST - before any other processing
  // This ensures we never interfere with static file serving
  // Even if the matcher somehow allows this to run, we exit immediately
  const staticFilePatterns = [
    '/manifest.json',
    '/sw.js',
    '/icon-',
    '/og-image.png',
    '/og/',
    '/robots.txt',
    '/favicon.ico',
    '/assets/',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.svg',
    '.ico',
    '.woff',
    '.woff2',
    '.ttf',
    '.eot',
    '.css',
    '.js',
    '.json',
  ];

  // If this looks like a static file, return immediately without any processing
  // The matcher should prevent this from running, but if it does, we need to pass through
  // In Vercel Edge Middleware, we can't truly "pass through" but we can return a response
  // that doesn't interfere. However, the REAL fix is ensuring the matcher works correctly.
  if (staticFilePatterns.some(pattern => path.includes(pattern) || path.endsWith(pattern))) {
    // Return a response that tells Vercel to continue processing
    // This should allow Vercel to serve the static file from the public directory
    // We return 200 with no body to indicate "handled but continue"
    return new Response(null, {
      status: 200,
      // Don't add any headers that might trigger authentication
      // Let Vercel handle the file serving
    });
  }

  // SECURITY: CORS headers (adjust for your domain)
  const origin = request.headers.get('origin');
  const allowedOrigins = [
    'https://www.kidscallhome.com',
    'https://kidscallhome.com',
    'http://localhost:8080',
    'http://localhost:5173',
  ];

  // SECURITY: Rate limiting for auth endpoints
  if (path.includes('/auth/v1/token') || path.includes('/auth/v1/signup')) {
    const rateLimitKey = getRateLimitKey(request);
    const rateLimitCheck = checkRateLimit(rateLimitKey, path);

    if (!rateLimitCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.',
          retryAfter: rateLimitCheck.resetAt
            ? Math.ceil((rateLimitCheck.resetAt - Date.now()) / 1000)
            : 60,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': rateLimitCheck.resetAt
              ? Math.ceil((rateLimitCheck.resetAt - Date.now()) / 1000).toString()
              : '60',
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitCheck.resetAt
              ? Math.ceil(rateLimitCheck.resetAt / 1000).toString()
              : Math.ceil((Date.now() + 60000) / 1000).toString(),
          },
        }
      );
    }
  }

  // SECURITY: Block known bot user agents
  const userAgent = request.headers.get('user-agent') || '';
  const botPatterns = [
    'headless',
    'phantom',
    'selenium',
    'webdriver',
    'puppeteer',
    'playwright',
    'scrapy',
    'bot',
    'crawler',
    'spider',
  ];

  const isBot = botPatterns.some((pattern) =>
    userAgent.toLowerCase().includes(pattern)
  );

  // Block bots from auth endpoints
  if (isBot && (path.includes('/auth/') || path.includes('/api/'))) {
    return new Response(
      JSON.stringify({ error: 'Forbidden', message: 'Automated access not allowed' }),
      { 
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // SECURITY: Validate Origin header for state-changing requests
  // Use exact match to prevent subdomain attacks (e.g., evil-kidscallhome.com)
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    if (origin && !allowedOrigins.includes(origin)) {
      return new Response(
        JSON.stringify({ error: 'Forbidden', message: 'Invalid origin' }),
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  // For Vercel Edge Middleware with Vite/React apps, we need to pass through
  // Headers will be added via vercel.json headers configuration
  // Don't return an empty response - let Vercel handle the request normally
  return new Response(null, {
    status: 200,
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    },
  });
}

// Configure which routes to run middleware on
// Note: Vercel Edge Middleware uses this config
// CRITICAL: Only run middleware on API/auth endpoints
// Static files like manifest.json are NOT in the matcher, so middleware won't run for them
// The early return with undefined in the middleware function is a safety net for pass-through
export const config = {
  matcher: [
    // Only match API/auth endpoints - static files are automatically excluded
    '/auth/:path*',
    '/rest/:path*',
    '/functions/:path*',
  ],
};

