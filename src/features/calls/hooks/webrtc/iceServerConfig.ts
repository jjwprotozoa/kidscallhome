// src/features/calls/hooks/webrtc/iceServerConfig.ts
// ICE server configuration building logic for STUN/TURN servers

import { safeLog } from "@/utils/security";
import type {
  CloudflareTurnCredentials,
  IceServerConfig,
  IceServerOptions,
  TurnCredentialsApiResponse,
} from "./types";

/**
 * Default STUN servers for NAT discovery
 * These are always included regardless of TURN configuration
 */
export const DEFAULT_STUN_SERVERS: IceServerConfig[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

/**
 * Free public TURN servers for development/testing only
 * WARNING: These are not reliable for production use
 */
export const FALLBACK_PUBLIC_TURN_SERVERS: IceServerConfig[] = [
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

/**
 * Fetches TURN credentials from Cloudflare's API via our backend proxy
 * @returns The Cloudflare TURN configuration or null if fetch fails
 */
export async function fetchCloudflareTurnCredentials(): Promise<CloudflareTurnCredentials | null> {
  try {
    safeLog.log("🌐 [ICE CONFIG] Fetching Cloudflare TURN credentials...");

    const response = await fetch("/api/turn-credentials", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to fetch TURN credentials: ${response.status} - ${
          (errorData as { message?: string }).message || "Unknown error"
        }`
      );
    }

    const data: TurnCredentialsApiResponse = await response.json();

    // Cloudflare returns: { iceServers: { urls: [...], username: "...", credential: "..." } }
    // Handle both array and object formats for compatibility
    let cloudflareConfig: CloudflareTurnCredentials | undefined;
    
    if (data.iceServers) {
      if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
        // Array format: [{ urls, username, credential }]
        cloudflareConfig = data.iceServers[0];
      } else if (
        typeof data.iceServers === "object" &&
        !Array.isArray(data.iceServers) &&
        data.iceServers.urls
      ) {
        // Object format: { urls, username, credential }
        cloudflareConfig = data.iceServers;
      }
    }

    if (
      cloudflareConfig &&
      cloudflareConfig.urls &&
      cloudflareConfig.username &&
      cloudflareConfig.credential
    ) {
      safeLog.log("✅ [ICE CONFIG] Cloudflare TURN credentials obtained", {
        serverCount: Array.isArray(cloudflareConfig.urls)
          ? cloudflareConfig.urls.length
          : 1,
        hasCredentials: true,
      });
      return cloudflareConfig;
    }

    throw new Error(
      "Invalid credentials format from Cloudflare API - missing urls, username, or credential"
    );
  } catch (error) {
    safeLog.error(
      "❌ [ICE CONFIG] Failed to get Cloudflare TURN credentials:",
      error
    );
    return null;
  }
}

/**
 * Parses TURN servers from comma-separated environment variable
 * @param turnUrls - Comma-separated TURN server URLs
 * @param username - TURN server username
 * @param credential - TURN server credential
 * @returns Array of ICE server configurations
 */
export function parseEnvTurnServers(
  turnUrls: string,
  username: string,
  credential: string
): IceServerConfig[] {
  const turnUrlList = turnUrls
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  return turnUrlList.map((url) => ({
    urls: url,
    username,
    credential,
  }));
}

/**
 * Builds the complete ICE server configuration array
 * Priority: Cloudflare TURN (dynamic) > Environment variables > Default fallback servers
 * 
 * @param options - Configuration options for ICE servers
 * @returns Promise resolving to array of ICE server configurations
 */
export async function buildIceServers(
  options: IceServerOptions
): Promise<RTCIceServer[]> {
  const {
    useCloudflareTurn,
    turnServersEnv,
    turnUsernameEnv,
    turnCredentialEnv,
    isProduction,
  } = options;

  // Start with default STUN servers
  let iceServers: RTCIceServer[] = [...DEFAULT_STUN_SERVERS];

  // Try Cloudflare TURN if enabled
  if (useCloudflareTurn) {
    const cloudflareConfig = await fetchCloudflareTurnCredentials();
    
    if (cloudflareConfig) {
      iceServers.push({
        urls: Array.isArray(cloudflareConfig.urls)
          ? cloudflareConfig.urls
          : [cloudflareConfig.urls],
        username: cloudflareConfig.username,
        credential: cloudflareConfig.credential,
      });

      safeLog.log("✅ [ICE CONFIG] Using Cloudflare TURN servers", {
        serverCount: Array.isArray(cloudflareConfig.urls)
          ? cloudflareConfig.urls.length
          : 1,
        urls: cloudflareConfig.urls,
      });

      return iceServers;
    }

    safeLog.log("⚠️ [ICE CONFIG] Falling back to default TURN configuration");
  }

  // Fallback: Add TURN servers from environment variables if available
  if (turnServersEnv && turnUsernameEnv && turnCredentialEnv) {
    const envServers = parseEnvTurnServers(
      turnServersEnv,
      turnUsernameEnv,
      turnCredentialEnv
    );
    
    iceServers.push(...envServers);
    
    safeLog.log(
      "🌐 [ICE CONFIG] Using production TURN servers from environment variables",
      {
        serverCount: envServers.length,
      }
    );
    
    return iceServers;
  }

  // Final fallback: Free public TURN servers (development/testing only)
  iceServers.push(...FALLBACK_PUBLIC_TURN_SERVERS);

  if (isProduction) {
    safeLog.error(
      "⚠️ [ICE CONFIG] WARNING: Using free public TURN servers in production! " +
        "Set VITE_USE_CLOUDFLARE_TURN=true or configure VITE_TURN_SERVERS environment variables " +
        "for reliable production calls."
    );
  } else {
    safeLog.log(
      "🌐 [ICE CONFIG] Using free public TURN servers (development mode)"
    );
  }

  return iceServers;
}

/**
 * Counts TURN servers in an ICE server configuration array
 * Useful for diagnostics and warnings
 */
export function countTurnServers(iceServers: RTCIceServer[]): number {
  return iceServers.filter((server) => {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    return urls.some((url) => url?.includes("turn:"));
  }).length;
}

/**
 * Checks if TURN servers are properly configured
 * @param turnServerCount - Number of TURN servers in config
 * @param options - ICE server options used
 * @returns Whether TURN is properly configured for production
 */
export function hasTurnConfigured(
  turnServerCount: number,
  options: Partial<IceServerOptions>
): boolean {
  return (
    turnServerCount > 0 ||
    !!(options.turnServersEnv && options.turnUsernameEnv && options.turnCredentialEnv) ||
    !!options.useCloudflareTurn
  );
}

