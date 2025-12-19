// src/utils/turnstileValidation.ts
// Purpose: Client-side utility for validating Cloudflare Turnstile tokens server-side

import { supabase } from "@/integrations/supabase/client";

/**
 * Validate a Turnstile token with the server
 * @param token - The Turnstile token to validate
 * @param remoteip - Optional: The user's IP address
 * @returns Validation result
 */
export async function validateTurnstileToken(
  token: string,
  remoteip?: string
): Promise<{
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
  error?: string;
}> {
  try {
    // Call Supabase Edge Function to validate token
    const { data, error } = await supabase.functions.invoke("verify-turnstile", {
      body: { token, remoteip },
    });

    if (error) {
      console.error("Turnstile validation error:", error);
      return {
        success: false,
        error: error.message || "Validation failed",
      };
    }

    return data as {
      success: boolean;
      "error-codes"?: string[];
      challenge_ts?: string;
      hostname?: string;
    };
  } catch (error) {
    console.error("Turnstile validation exception:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Validation failed",
    };
  }
}

