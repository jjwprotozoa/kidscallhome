// src/utils/routeUtils.ts
// Utility functions for route detection and conditional loading

/**
 * Check if the current route is a marketing route
 * Marketing routes should not load Supabase, analytics, or app-specific CSS
 */
export function isMarketingRoute(pathname?: string): boolean {
  const path = pathname || (typeof window !== 'undefined' ? window.location.pathname : '');
  return path === '/' || path === '/info';
}

/**
 * Check if the current route is an app route (requires Supabase)
 */
export function isAppRoute(pathname?: string): boolean {
  return !isMarketingRoute(pathname);
}







