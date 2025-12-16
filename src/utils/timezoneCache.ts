// src/utils/timezoneCache.ts
// Purpose: Cache timezone names to avoid repeated database queries
// This addresses the 0% cache hit rate issue with pg_timezone_names queries

import { supabase } from '@/integrations/supabase/client';
import { safeLog } from './security';

/**
 * Cached timezone names list
 * This is populated once and reused to avoid repeated pg_timezone_names queries
 */
let cachedTimezones: string[] | null = null;
let cachePromise: Promise<string[]> | null = null;

/**
 * Get all timezone names, using cache if available
 * This prevents repeated queries to pg_timezone_names which has 0% cache hit rate
 * 
 * @returns Promise<string[]> Array of timezone names
 */
export async function getTimezoneNames(): Promise<string[]> {
  // Return cached value if available
  if (cachedTimezones !== null) {
    return cachedTimezones;
  }

  // If a fetch is already in progress, return that promise
  if (cachePromise !== null) {
    return cachePromise;
  }

  // Fetch timezone names from database (only once)
  cachePromise = (async () => {
    try {
      // Use Supabase RPC to get timezone names via cached function
      // The database function is marked as STABLE, enabling query result caching
      const { data, error } = await supabase.rpc('get_timezone_names');

      if (error) {
        // Fallback: Use a static list of common timezones if RPC fails
        safeLog.warn('⚠️ [TIMEZONE CACHE] Failed to fetch timezones, using fallback list:', error);
        return getFallbackTimezones();
      }

      // Extract timezone names from the result array
      // The RPC returns an array of objects with 'name' property
      cachedTimezones = Array.isArray(data) 
        ? data.map((item: { name: string }) => item.name)
        : getFallbackTimezones();
      
      safeLog.log('✅ [TIMEZONE CACHE] Loaded timezone names:', cachedTimezones.length);
      return cachedTimezones;
    } catch (error) {
      safeLog.error('❌ [TIMEZONE CACHE] Error loading timezones:', error);
      return getFallbackTimezones();
    } finally {
      // Clear the promise so we can retry if needed
      cachePromise = null;
    }
  })();

  return cachePromise;
}

/**
 * Fallback timezone list if database query fails
 * Includes common timezones used in the application
 */
function getFallbackTimezones(): string[] {
  return [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Phoenix',
    'America/Anchorage',
    'America/Honolulu',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Rome',
    'Europe/Madrid',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Hong_Kong',
    'Asia/Dubai',
    'Australia/Sydney',
    'Australia/Melbourne',
    'Pacific/Auckland',
  ];
}

/**
 * Clear the timezone cache (useful for testing or forced refresh)
 */
export function clearTimezoneCache(): void {
  cachedTimezones = null;
  cachePromise = null;
  safeLog.log('🔄 [TIMEZONE CACHE] Cache cleared');
}

/**
 * Preload timezone names (call this at app startup)
 * This ensures timezones are cached before they're needed
 */
export async function preloadTimezones(): Promise<void> {
  try {
    await getTimezoneNames();
    safeLog.log('✅ [TIMEZONE CACHE] Preloaded timezone names');
  } catch (error) {
    safeLog.error('❌ [TIMEZONE CACHE] Failed to preload timezones:', error);
  }
}

