// src/services/betaService.ts
// Purpose: Service layer for beta testing signup and feedback functionality

import { supabase } from "@/integrations/supabase/client";
import { safeLog, sanitizeError } from "@/utils/security";

export interface BetaSignupPayload {
  email?: string;
  platform: "ios" | "android" | "web";
  app_version?: string;
  device_model?: string;
  timezone?: string;
  use_case?: string;
  consent: boolean;
}

export interface BetaFeedbackPayload {
  category: "bug" | "ux" | "feature" | "other";
  rating?: number;
  message: string;
  meta?: Record<string, unknown>;
}

export interface BetaSignup {
  id: string;
  user_id: string;
  email: string | null;
  platform: "ios" | "android" | "web" | null;
  app_version: string | null;
  device_model: string | null;
  timezone: string | null;
  use_case: string | null;
  consent: boolean;
  consent_at: string | null;
  status: "invited" | "active" | "paused" | "exited";
  created_at: string;
  updated_at: string;
}

export interface BetaFeedback {
  id: string;
  user_id: string;
  category: "bug" | "ux" | "feature" | "other";
  rating: number | null;
  message: string;
  meta: Record<string, unknown>;
  created_at: string;
}

/**
 * Get the current user's beta signup record
 * Returns null if user is not in beta
 */
export async function getBetaSignup(): Promise<BetaSignup | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const { data, error } = await supabase
      .from("beta_signups" as never)
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (error) {
      safeLog.error("Error fetching beta signup:", sanitizeError(error));
      throw error;
    }

    return data;
  } catch (error) {
    safeLog.error("Error in getBetaSignup:", sanitizeError(error));
    throw error;
  }
}

/**
 * Check if user is a beta tester (has active beta signup)
 * Computed check - safer than modifying profiles table
 */
export async function isBetaUser(): Promise<boolean> {
  try {
    const signup = await getBetaSignup();
    return signup !== null && signup.status === "active";
  } catch (error) {
    safeLog.error("Error checking beta status:", sanitizeError(error));
    return false;
  }
}

/**
 * Join beta testing program
 */
export async function joinBeta(
  payload: BetaSignupPayload
): Promise<BetaSignup> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("User must be authenticated to join beta");
    }

    if (!payload.consent) {
      throw new Error("Consent is required to join beta");
    }

    // Check if user already has an active signup
    const existing = await getBetaSignup();
    if (existing) {
      // Update existing signup instead of creating duplicate
      const { data, error } = await supabase
        .from("beta_signups" as never)
        .update({
          email: payload.email || user.email || null,
          platform: payload.platform,
          app_version: payload.app_version || null,
          device_model: payload.device_model || null,
          timezone: payload.timezone || null,
          use_case: payload.use_case || null,
          consent: payload.consent,
          consent_at: payload.consent ? new Date().toISOString() : null,
          status: "active",
        } as never)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) {
        safeLog.error("Error updating beta signup:", sanitizeError(error));
        throw error;
      }

      // Send confirmation email for updated signup (non-blocking)
      try {
        const userEmail = payload.email || user.email;
        if (userEmail) {
          const userName =
            user.user_metadata?.name ||
            user.user_metadata?.full_name ||
            userEmail.split("@")[0];

          await supabase.functions.invoke("send-beta-signup-confirmation", {
            body: {
              email: userEmail,
              platform: payload.platform,
              appVersion: payload.app_version || undefined,
              userName: userName,
            },
          });
        }
      } catch (emailError) {
        // Log but don't fail - email is nice to have but not critical
        safeLog.warn(
          "Failed to send beta signup confirmation email:",
          sanitizeError(emailError)
        );
      }

      return data as BetaSignup;
    }

    // Create new signup
    const { data, error } = await supabase
      .from("beta_signups" as never)
      .insert({
        user_id: user.id,
        email: payload.email || user.email || null,
        platform: payload.platform,
        app_version: payload.app_version || null,
        device_model: payload.device_model || null,
        timezone: payload.timezone || null,
        use_case: payload.use_case || null,
        consent: payload.consent,
        consent_at: payload.consent ? new Date().toISOString() : null,
        status: "active",
      } as never)
      .select()
      .single();

    if (error) {
      safeLog.error("Error creating beta signup:", sanitizeError(error));
      throw error;
    }

    // Send confirmation email (non-blocking - don't fail if email fails)
    try {
      const userEmail = payload.email || user.email;
      if (userEmail) {
        // Get user's name from metadata or email
        const userName =
          user.user_metadata?.name ||
          user.user_metadata?.full_name ||
          userEmail.split("@")[0];

        await supabase.functions.invoke("send-beta-signup-confirmation", {
          body: {
            email: userEmail,
            platform: payload.platform,
            appVersion: payload.app_version || undefined,
            userName: userName,
          },
        });
      }
    } catch (emailError) {
      // Log but don't fail - email is nice to have but not critical
      safeLog.warn(
        "Failed to send beta signup confirmation email:",
        sanitizeError(emailError)
      );
    }

    return data;
  } catch (error) {
    safeLog.error("Error in joinBeta:", sanitizeError(error));
    throw error;
  }
}

/**
 * Submit beta feedback
 */
export async function submitFeedback(
  payload: BetaFeedbackPayload
): Promise<BetaFeedback> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("User must be authenticated to submit feedback");
    }

    if (!payload.message || payload.message.trim().length === 0) {
      throw new Error("Feedback message is required");
    }

    // Validate rating if provided
    if (
      payload.rating !== undefined &&
      (payload.rating < 1 || payload.rating > 5)
    ) {
      throw new Error("Rating must be between 1 and 5");
    }

    const { data, error } = await supabase
      .from("beta_feedback" as never)
      .insert({
        user_id: user.id,
        category: payload.category,
        rating: payload.rating || null,
        message: payload.message.trim(),
        meta: payload.meta || {},
      } as never)
      .select()
      .single();

    if (error) {
      safeLog.error("Error submitting feedback:", sanitizeError(error));
      throw error;
    }

    return data;
  } catch (error) {
    safeLog.error("Error in submitFeedback:", sanitizeError(error));
    throw error;
  }
}
