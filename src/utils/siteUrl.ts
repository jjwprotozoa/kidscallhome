// src/utils/siteUrl.ts
// Purpose: Get the correct site URL for email redirects and other purposes
// Handles both localhost (development) and production environments

/**
 * Get the site URL for email redirects and other purposes.
 * 
 * Priority:
 * 1. VITE_SITE_URL environment variable (if set)
 * 2. window.location.origin (current page origin)
 * 
 * For production, VITE_SITE_URL should be set to the production domain.
 * For localhost, window.location.origin will be used (e.g., http://localhost:8080)
 * 
 * @returns The site URL (e.g., "https://www.kidscallhome.com" or "http://localhost:8080")
 */
export function getSiteUrl(): string {
  // Check for explicit site URL in environment variables
  const envSiteUrl = import.meta.env.VITE_SITE_URL;
  if (envSiteUrl) {
    return envSiteUrl;
  }

  // Fallback to current origin (works for both dev and prod)
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  // Server-side fallback (shouldn't happen in client code)
  return 'https://www.kidscallhome.com';
}

/**
 * Get the email redirect URL for a specific path.
 * 
 * @param path - The path to redirect to (e.g., "/parent/children")
 * @returns Full URL for email redirect (e.g., "https://www.kidscallhome.com/parent/children")
 */
export function getEmailRedirectUrl(path: string): string {
  const siteUrl = getSiteUrl();
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${siteUrl}${normalizedPath}`;
}

