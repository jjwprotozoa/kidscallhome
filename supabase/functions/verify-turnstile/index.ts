// supabase/functions/verify-turnstile/index.ts
// Purpose: Server-side validation of Cloudflare Turnstile tokens
// Validates tokens using Cloudflare's Siteverify API before allowing authentication

/// <reference types="../deno.d.ts" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Allowed origins for CORS
const allowedOrigins = [
  "https://www.kidscallhome.com",
  "https://kidscallhome.com",
  "http://localhost:8080", // Development only
  "http://localhost:5173", // Development only
];

// Pattern-based origin matching (for Vercel deployments, etc.)
const allowedOriginPatterns = [
  /^https:\/\/.*\.vercel\.app$/, // Vercel deployment URLs
];

// Helper function to check if origin is allowed (exact match or pattern match)
function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  
  // Check exact matches first
  if (allowedOrigins.includes(origin)) {
    return true;
  }
  
  // Check pattern matches
  return allowedOriginPatterns.some(pattern => pattern.test(origin));
}

// Helper function to get CORS headers
function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };

  if (origin && isOriginAllowed(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  return headers;
}

/**
 * Validate Turnstile token with Cloudflare Siteverify API
 * @param token - The Turnstile token to validate
 * @param secretKey - The Turnstile secret key (from environment)
 * @param remoteip - Optional: The user's IP address
 * @returns Validation result from Cloudflare
 */
async function verifyTurnstileToken(
  token: string,
  secretKey: string,
  remoteip?: string
): Promise<{
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
}> {
  const formData = new FormData();
  formData.append("secret", secretKey);
  formData.append("response", token);
  if (remoteip) {
    formData.append("remoteip", remoteip);
  }

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`Cloudflare API error: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Turnstile verification error:", error);
    throw error;
  }
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      { status: 405, headers: corsHeaders }
    );
  }

  // Require authorization header (anon key is acceptable - provided by supabase.functions.invoke())
  // This function validates Turnstile tokens before login, so user auth is not required
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ 
        code: 401,
        message: "Missing authorization header" 
      }),
      { status: 401, headers: corsHeaders }
    );
  }

  try {
    // Get Turnstile secret key from environment
    const secretKey = Deno.env.get("TURNSTILE_SECRET_KEY");
    if (!secretKey) {
      console.error("TURNSTILE_SECRET_KEY not configured");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Turnstile secret key not configured",
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Parse request body
    const body = await req.json();
    const { token, remoteip } = body;

    // Validate required fields
    if (!token || typeof token !== "string") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing or invalid token",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Verify token with Cloudflare
    const verificationResult = await verifyTurnstileToken(
      token,
      secretKey,
      remoteip
    );

    // Return verification result
    return new Response(
      JSON.stringify({
        success: verificationResult.success,
        "error-codes": verificationResult["error-codes"],
        challenge_ts: verificationResult.challenge_ts,
        hostname: verificationResult.hostname,
      }),
      {
        status: verificationResult.success ? 200 : 400,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("Turnstile verification endpoint error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});

