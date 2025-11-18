// src/utils/userAgentParser.ts
// Purpose: Parse user agent strings to extract browser and OS information

export interface BrowserInfo {
  name: string;
  version: string | null;
  fullName: string;
}

export interface OSInfo {
  name: string;
  version: string | null;
  fullName: string;
}

export interface DeviceInfo {
  browser: BrowserInfo;
  os: OSInfo;
  deviceModel: string | null;
}

/**
 * Parse user agent string to extract browser information
 */
export function parseBrowser(userAgent: string): BrowserInfo {
  const ua = userAgent.toLowerCase();

  // Chrome (including Edge Chromium)
  if (ua.includes('edg/')) {
    const match = userAgent.match(/edg\/([\d.]+)/i);
    return {
      name: 'Edge',
      version: match ? match[1] : null,
      fullName: match ? `Edge ${match[1]}` : 'Edge',
    };
  }

  if (ua.includes('chrome/') && !ua.includes('edg/')) {
    const match = userAgent.match(/chrome\/([\d.]+)/i);
    return {
      name: 'Chrome',
      version: match ? match[1] : null,
      fullName: match ? `Chrome ${match[1]}` : 'Chrome',
    };
  }

  // Safari (but not Chrome-based browsers)
  if (ua.includes('safari/') && !ua.includes('chrome/')) {
    const match = userAgent.match(/version\/([\d.]+).*safari/i);
    return {
      name: 'Safari',
      version: match ? match[1] : null,
      fullName: match ? `Safari ${match[1]}` : 'Safari',
    };
  }

  // Firefox
  if (ua.includes('firefox/')) {
    const match = userAgent.match(/firefox\/([\d.]+)/i);
    return {
      name: 'Firefox',
      version: match ? match[1] : null,
      fullName: match ? `Firefox ${match[1]}` : 'Firefox',
    };
  }

  // Opera
  if (ua.includes('opera/') || ua.includes('opr/')) {
    const match = userAgent.match(/(?:opera|opr)\/([\d.]+)/i);
    return {
      name: 'Opera',
      version: match ? match[1] : null,
      fullName: match ? `Opera ${match[1]}` : 'Opera',
    };
  }

  // Samsung Internet
  if (ua.includes('samsungbrowser/')) {
    const match = userAgent.match(/samsungbrowser\/([\d.]+)/i);
    return {
      name: 'Samsung Internet',
      version: match ? match[1] : null,
      fullName: match ? `Samsung Internet ${match[1]}` : 'Samsung Internet',
    };
  }

  // UC Browser
  if (ua.includes('ucbrowser/')) {
    const match = userAgent.match(/ucbrowser\/([\d.]+)/i);
    return {
      name: 'UC Browser',
      version: match ? match[1] : null,
      fullName: match ? `UC Browser ${match[1]}` : 'UC Browser',
    };
  }

  // Default fallback
  return {
    name: 'Unknown Browser',
    version: null,
    fullName: 'Unknown Browser',
  };
}

/**
 * Parse user agent string to extract OS information
 */
export function parseOS(userAgent: string): OSInfo {
  const ua = userAgent.toLowerCase();

  // iOS
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) {
    const match = userAgent.match(/os ([\d_]+)/i);
    if (match) {
      const version = match[1].replace(/_/g, '.');
      return {
        name: 'iOS',
        version,
        fullName: `iOS ${version}`,
      };
    }
    return {
      name: 'iOS',
      version: null,
      fullName: 'iOS',
    };
  }

  // Android
  if (ua.includes('android')) {
    const match = userAgent.match(/android ([\d.]+)/i);
    if (match) {
      return {
        name: 'Android',
        version: match[1],
        fullName: `Android ${match[1]}`,
      };
    }
    return {
      name: 'Android',
      version: null,
      fullName: 'Android',
    };
  }

  // Windows
  if (ua.includes('windows')) {
    if (ua.includes('windows nt 10.0')) {
      return {
        name: 'Windows',
        version: '10/11',
        fullName: 'Windows 10/11',
      };
    }
    if (ua.includes('windows nt 6.3')) {
      return {
        name: 'Windows',
        version: '8.1',
        fullName: 'Windows 8.1',
      };
    }
    if (ua.includes('windows nt 6.2')) {
      return {
        name: 'Windows',
        version: '8',
        fullName: 'Windows 8',
      };
    }
    if (ua.includes('windows nt 6.1')) {
      return {
        name: 'Windows',
        version: '7',
        fullName: 'Windows 7',
      };
    }
    const match = userAgent.match(/windows nt ([\d.]+)/i);
    if (match) {
      return {
        name: 'Windows',
        version: match[1],
        fullName: `Windows NT ${match[1]}`,
      };
    }
    return {
      name: 'Windows',
      version: null,
      fullName: 'Windows',
    };
  }

  // macOS
  if (ua.includes('mac os x') || ua.includes('macintosh')) {
    const match = userAgent.match(/mac os x ([\d_]+)/i);
    if (match) {
      const version = match[1].replace(/_/g, '.');
      return {
        name: 'macOS',
        version,
        fullName: `macOS ${version}`,
      };
    }
    return {
      name: 'macOS',
      version: null,
      fullName: 'macOS',
    };
  }

  // Linux
  if (ua.includes('linux')) {
    return {
      name: 'Linux',
      version: null,
      fullName: 'Linux',
    };
  }

  // Default fallback
  return {
    name: 'Unknown OS',
    version: null,
    fullName: 'Unknown OS',
  };
}

/**
 * Extract device model from user agent
 */
export function extractDeviceModel(userAgent: string): string | null {
  const ua = userAgent;

  // iPhone
  if (ua.includes('iPhone')) {
    // Try to extract iPhone model (e.g., iPhone14,2)
    const match = ua.match(/iPhone(\d+,\d+)/i);
    if (match) {
      return `iPhone ${match[1]}`;
    }
    return 'iPhone';
  }

  // iPad
  if (ua.includes('iPad')) {
    const match = ua.match(/iPad(\d+,\d+)/i);
    if (match) {
      return `iPad ${match[1]}`;
    }
    return 'iPad';
  }

  // Android devices - extract model from user agent
  if (ua.includes('Android')) {
    // Common pattern: Android 13; SM-S918B (Samsung Galaxy S23 Ultra)
    const match = ua.match(/android [\d.]+; ([^)]+)\)/i);
    if (match) {
      const model = match[1].trim();
      // Clean up common prefixes
      return model.replace(/^SM-/, 'Samsung ').replace(/^LM-/, 'LG ');
    }
  }

  // Mac
  if (ua.includes('Macintosh')) {
    return 'Mac';
  }

  return null;
}

/**
 * Parse complete device information from user agent
 */
export function parseDeviceInfo(userAgent: string | null): DeviceInfo {
  if (!userAgent) {
    return {
      browser: { name: 'Unknown', version: null, fullName: 'Unknown Browser' },
      os: { name: 'Unknown', version: null, fullName: 'Unknown OS' },
      deviceModel: null,
    };
  }

  return {
    browser: parseBrowser(userAgent),
    os: parseOS(userAgent),
    deviceModel: extractDeviceModel(userAgent),
  };
}

