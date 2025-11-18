// src/utils/ipGeolocation.ts
// Purpose: Get country information from IP address using geolocation services

export interface IPGeolocationResult {
  country: string | null;
  countryCode: string | null;
  countryFlag: string | null;
  city: string | null;
  region: string | null;
}

/**
 * Convert ISO country code to flag emoji
 * Uses Unicode Regional Indicator Symbols
 */
export function countryCodeToFlag(countryCode: string | null): string | null {
  if (!countryCode || countryCode.length !== 2) {
    return null;
  }

  // Convert country code to flag emoji
  // Each letter is converted to Regional Indicator Symbol (U+1F1E6 to U+1F1FF)
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 0x1f1e6 + (char.charCodeAt(0) - 0x41));

  return String.fromCodePoint(...codePoints);
}

/**
 * Get geolocation information from IP address
 * Uses ip-api.com (free tier: 45 requests/minute)
 * Falls back to ipapi.co if needed
 */
export async function getIPGeolocation(ipAddress: string | null): Promise<IPGeolocationResult> {
  if (!ipAddress) {
    return {
      country: null,
      countryCode: null,
      countryFlag: null,
      city: null,
      region: null,
    };
  }

  try {
    // Try ip-api.com first (free, no API key needed, 45 req/min)
    // Format: http://ip-api.com/json/{ip}?fields=status,message,country,countryCode,city,regionName
    const response = await fetch(
      `http://ip-api.com/json/${ipAddress}?fields=status,message,country,countryCode,city,regionName`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      
      if (data.status === 'success') {
        const countryCode = data.countryCode || null;
        return {
          country: data.country || null,
          countryCode,
          countryFlag: countryCodeToFlag(countryCode),
          city: data.city || null,
          region: data.regionName || null,
        };
      }
    }
  } catch (error) {
    console.warn('ip-api.com geolocation failed, trying fallback:', error);
  }

  // Fallback to ipapi.co (free tier: 1000 requests/day)
  try {
    const response = await fetch(`https://ipapi.co/${ipAddress}/json/`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      
      if (data.country_code && !data.error) {
        const countryCode = data.country_code || null;
        return {
          country: data.country_name || null,
          countryCode,
          countryFlag: countryCodeToFlag(countryCode),
          city: data.city || null,
          region: data.region || null,
        };
      }
    }
  } catch (error) {
    console.warn('ipapi.co geolocation failed:', error);
  }

  // Return empty result if all services fail
  return {
    country: null,
    countryCode: null,
    countryFlag: null,
    city: null,
    region: null,
  };
}

/**
 * Get country code and flag from IP address (simplified version)
 * Returns just country code and flag for quick lookups
 */
export async function getCountryFromIP(ipAddress: string | null): Promise<{
  countryCode: string | null;
  countryFlag: string | null;
  country: string | null;
}> {
  const geo = await getIPGeolocation(ipAddress);
  return {
    countryCode: geo.countryCode,
    countryFlag: geo.countryFlag,
    country: geo.country,
  };
}

