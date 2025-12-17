// Supabase Edge Function: Verify Native Purchase
// Purpose: Verify purchases from Google Play Store and Apple App Store and activate subscriptions

/// <reference types="../deno.d.ts" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Allowed origins for CORS
const allowedOrigins = [
  "https://www.kidscallhome.com",
  "https://kidscallhome.com",
  "http://localhost:8080",
  "http://localhost:5173",
];

// Plan ID to subscription type mapping
const PLAN_TO_SUBSCRIPTION_TYPE: Record<string, string> = {
  "additional-kid-monthly": "additional-kid-monthly",
  "additional-kid-annual": "additional-kid-annual",
  "family-bundle-monthly": "family-bundle-monthly",
  "family-bundle-annual": "family-bundle-annual",
  "annual-family-plan": "annual-family-plan",
};

// Plan ID to allowed children mapping
const PLAN_TO_CHILDREN_LIMIT: Record<string, number> = {
  "additional-kid-monthly": 1, // Adds 1 to existing
  "additional-kid-annual": 1, // Adds 1 to existing
  "family-bundle-monthly": 5,
  "family-bundle-annual": 5,
  "annual-family-plan": 10,
};

// Helper function to get CORS headers
function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };

  if (origin && allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  return headers;
}

/**
 * Verify Google Play purchase
 * 
 * NOTE: For production, consider using Google Auth Library:
 * import { GoogleAuth } from "npm:google-auth-library";
 * 
 * const auth = new GoogleAuth({
 *   credentials: JSON.parse(googleServiceAccountKey),
 *   scopes: ['https://www.googleapis.com/auth/androidpublisher']
 * });
 * const client = await auth.getClient();
 */
async function verifyGooglePlayPurchase(
  purchaseToken: string,
  productId: string,
  packageName: string = "com.kidscallhome.app"
): Promise<{ valid: boolean; expiryTime?: number }> {
  try {
    const googleServiceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    
    if (!googleServiceAccountKey) {
      console.error("GOOGLE_SERVICE_ACCOUNT_KEY not configured");
      return { valid: false };
    }

    // Parse service account key
    const serviceAccount = JSON.parse(googleServiceAccountKey);
    
    // TODO: Implement proper JWT generation or use Google Auth Library
    // For now, this is a placeholder that needs implementation
    // See: https://cloud.google.com/iam/docs/create-short-lived-credentials-service-account
    
    // Get access token for Google Play Developer API
    // Option 1: Use Google Auth Library (recommended)
    // Option 2: Generate JWT manually (requires JWT library)
    const tokenResponse = await fetch(
      `https://oauth2.googleapis.com/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion: await generateJWT(serviceAccount),
        }),
      }
    );

    if (!tokenResponse.ok) {
      console.error("Failed to get Google access token");
      return { valid: false };
    }

    const { access_token } = await tokenResponse.json();

    // Verify purchase with Google Play Developer API
    const verifyUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`;
    
    const verifyResponse = await fetch(verifyUrl, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (!verifyResponse.ok) {
      console.error("Google Play verification failed:", await verifyResponse.text());
      return { valid: false };
    }

    const purchaseData = await verifyResponse.json();
    
    // Check if purchase is valid
    const expiryTime = parseInt(purchaseData.expiryTimeMillis || "0", 10);
    const currentTime = Date.now();
    
    return {
      valid: expiryTime > currentTime,
      expiryTime: expiryTime,
    };
  } catch (error) {
    console.error("Google Play verification error:", error);
    return { valid: false };
  }
}

/**
 * Generate JWT for Google Service Account
 * 
 * NOTE: This requires a JWT library. Install via:
 * deno add npm:jose
 * 
 * Or use the Google Auth Library:
 * import { GoogleAuth } from "https://deno.land/x/google_auth@v1.0.0/mod.ts";
 */
async function generateJWT(serviceAccount: any): Promise<string> {
  // For now, use Google Auth Library approach
  // In production, you should use the Google Auth Library or jose library
  
  // Simplified approach: Use Google Auth Library
  // Install: deno add npm:@google-cloud/local-auth npm:google-auth-library
  
  // For now, return a placeholder - implement with proper JWT library
  // See: https://cloud.google.com/iam/docs/create-short-lived-credentials-service-account#using-service-account-credentials-directly
  
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // 1 hour
  
  // This is a placeholder - implement proper JWT signing
  // You'll need to use a JWT library like 'jose' or 'google-auth-library'
  throw new Error(
    "JWT generation requires a JWT library. " +
    "Install: deno add npm:jose " +
    "Or use Google Auth Library: deno add npm:google-auth-library"
  );
}

/**
 * Verify App Store purchase
 */
async function verifyAppStorePurchase(
  transactionReceipt: string,
  productId: string
): Promise<{ valid: boolean; expiryTime?: number }> {
  try {
    const appStoreSharedSecret = Deno.env.get("APP_STORE_SHARED_SECRET");
    const isProduction = Deno.env.get("APP_STORE_PRODUCTION") === "true";
    
    if (!appStoreSharedSecret) {
      console.error("APP_STORE_SHARED_SECRET not configured");
      return { valid: false };
    }

    // Verify with App Store Server API (App Store Server Notifications v2)
    // For receipt validation, use the verifyReceipt endpoint
    const verifyUrl = isProduction
      ? "https://buy.itunes.apple.com/verifyReceipt"
      : "https://sandbox.itunes.apple.com/verifyReceipt";

    const verifyResponse = await fetch(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "receipt-data": transactionReceipt,
        password: appStoreSharedSecret,
        "exclude-old-transactions": true,
      }),
    });

    if (!verifyResponse.ok) {
      console.error("App Store verification failed:", await verifyResponse.text());
      return { valid: false };
    }

    const receiptData = await verifyResponse.json();
    
    if (receiptData.status !== 0) {
      console.error("App Store receipt invalid, status:", receiptData.status);
      return { valid: false };
    }

    // Find the subscription in the receipt
    const latestReceiptInfo = receiptData.latest_receipt_info || [];
    const subscription = latestReceiptInfo.find(
      (item: any) => item.product_id === productId
    );

    if (!subscription) {
      return { valid: false };
    }

    // Check expiration
    const expiryTime = parseInt(subscription.expires_date_ms || "0", 10);
    const currentTime = Date.now();

    return {
      valid: expiryTime > currentTime,
      expiryTime: expiryTime,
    };
  } catch (error) {
    console.error("App Store verification error:", error);
    return { valid: false };
  }
}

/**
 * Update subscription in database
 */
async function updateSubscription(
  supabaseAdmin: any,
  userId: string,
  planId: string,
  expiryTime: number
): Promise<{ success: boolean; message?: string }> {
  try {
    const subscriptionType = PLAN_TO_SUBSCRIPTION_TYPE[planId];
    const childrenLimit = PLAN_TO_CHILDREN_LIMIT[planId];

    if (!subscriptionType) {
      return {
        success: false,
        message: `Unknown plan ID: ${planId}`,
      };
    }

    // Call the upgrade function
    const { data, error } = await supabaseAdmin.rpc(
      "upgrade_family_subscription",
      {
        p_parent_id: userId,
        p_subscription_type: subscriptionType,
        p_allowed_children: childrenLimit,
        p_checkout_session_id: `native-${Date.now()}`, // Unique ID for native purchases
      }
    );

    if (error) {
      console.error("Database update error:", error);
      return {
        success: false,
        message: `Failed to update subscription: ${error.message}`,
      };
    }

    // Update expiry time
    const expiryDate = new Date(expiryTime).toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("parents")
      .update({
        subscription_expires_at: expiryDate,
        subscription_status: "active",
      })
      .eq("id", userId);

    if (updateError) {
      console.error("Failed to update expiry:", updateError);
      // Don't fail the whole operation if expiry update fails
    }

    return {
      success: true,
      message: "Subscription activated successfully",
    };
  } catch (error) {
    console.error("Update subscription error:", error);
    return {
      success: false,
      message: `Update failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    // Get auth header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Parse request body
    const body = await req.json();
    const {
      platform,
      planId,
      userId,
      purchaseToken, // Google Play
      transactionReceipt, // App Store
      transactionId,
      productId,
    } = body;

    // Validate required fields
    if (!platform || !planId || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Verify user matches authenticated user
    if (userId !== user.id) {
      return new Response(
        JSON.stringify({ error: "User ID mismatch" }),
        { status: 403, headers: corsHeaders }
      );
    }

    // Verify purchase based on platform
    let verificationResult: { valid: boolean; expiryTime?: number };

    if (platform === "android") {
      if (!purchaseToken || !productId) {
        return new Response(
          JSON.stringify({ error: "Missing purchase token or product ID" }),
          { status: 400, headers: corsHeaders }
        );
      }
      verificationResult = await verifyGooglePlayPurchase(
        purchaseToken,
        productId
      );
    } else if (platform === "ios") {
      if (!transactionReceipt || !productId) {
        return new Response(
          JSON.stringify({ error: "Missing transaction receipt or product ID" }),
          { status: 400, headers: corsHeaders }
        );
      }
      verificationResult = await verifyAppStorePurchase(
        transactionReceipt,
        productId
      );
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid platform" }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!verificationResult.valid) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Purchase verification failed",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Update subscription in database
    const updateResult = await updateSubscription(
      supabaseAdmin,
      userId,
      planId,
      verificationResult.expiryTime || Date.now() + 365 * 24 * 60 * 60 * 1000 // Default to 1 year if no expiry
    );

    if (!updateResult.success) {
      return new Response(
        JSON.stringify(updateResult),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: updateResult.message || "Purchase verified and subscription activated",
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Verify native purchase error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});

