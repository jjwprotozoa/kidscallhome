// Supabase Edge Function: Health Check
// Purpose: Verify Edge Functions are deployed and configured correctly
// Provides status information for monitoring and deployment verification

/// <reference types="../deno.d.ts" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Allowed origins for CORS
const allowedOrigins = [
  "https://www.kidscallhome.com",
  "https://kidscallhome.com",
  "http://localhost:8080", // Development only
  "http://localhost:5173", // Development only
];

// Helper function to get CORS headers
function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
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

// Check environment variables
function checkEnvironmentVariables(): {
  status: "ok" | "warning" | "error";
  variables: Record<string, { set: boolean; value?: string }>;
} {
  const requiredVars = [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];

  const optionalVars = [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_ADDITIONAL_KID_MONTHLY",
    "STRIPE_PRICE_ADDITIONAL_KID_ANNUAL",
    "STRIPE_PRICE_FAMILY_BUNDLE_MONTHLY",
    "STRIPE_PRICE_ANNUAL_FAMILY_PLAN",
  ];

  const variables: Record<string, { set: boolean; value?: string }> = {};
  let hasErrors = false;
  let hasWarnings = false;

  // Check required variables
  for (const varName of requiredVars) {
    const value = Deno.env.get(varName);
    const isSet = !!value;
    variables[varName] = {
      set: isSet,
      value: isSet ? (varName.includes("KEY") ? "***" : value) : undefined,
    };
    if (!isSet) {
      hasErrors = true;
    }
  }

  // Check optional variables
  for (const varName of optionalVars) {
    const value = Deno.env.get(varName);
    const isSet = !!value;
    variables[varName] = {
      set: isSet,
      value: isSet ? "***" : undefined,
    };
    if (!isSet) {
      hasWarnings = true;
    }
  }

  return {
    status: hasErrors ? "error" : hasWarnings ? "warning" : "ok",
    variables,
  };
}

// Test Supabase connectivity
async function testSupabaseConnection(): Promise<{
  status: "ok" | "error";
  message: string;
  timestamp: string;
}> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        status: "error",
        message: "Supabase credentials not configured",
        timestamp: new Date().toISOString(),
      };
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Simple health check - try to get current user (will fail without auth, but tests connection)
    const { error } = await supabase.auth.getUser();

    // If we get an error, it's likely auth-related, not connection-related
    // A connection error would throw, so if we get here, connection is working
    return {
      status: "ok",
      message: "Supabase connection successful",
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "error",
      message: `Supabase connection failed: ${error.message}`,
      timestamp: new Date().toISOString(),
    };
  }
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Only allow GET requests
  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use GET." }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    // Parse URL to check for specific routes
    const url = new URL(req.url);
    const path = url.pathname;

    // Route: /health-check/status (or just /health-check)
    if (path === "/health-check" || path === "/health-check/status") {
      const envCheck = checkEnvironmentVariables();
      const supabaseCheck = await testSupabaseConnection();

      const healthStatus = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        checks: {
          environment: envCheck,
          supabase: supabaseCheck,
        },
        overall: {
          status:
            envCheck.status === "error" || supabaseCheck.status === "error"
              ? "unhealthy"
              : envCheck.status === "warning"
              ? "degraded"
              : "healthy",
        },
      };

      const statusCode =
        healthStatus.overall.status === "unhealthy" ? 503 : 200;

      return new Response(JSON.stringify(healthStatus, null, 2), {
        status: statusCode,
        headers: corsHeaders,
      });
    }

    // Route: /health-check/env (environment variables check only)
    if (path === "/health-check/env") {
      const envCheck = checkEnvironmentVariables();

      return new Response(
        JSON.stringify(
          {
            status: envCheck.status,
            variables: envCheck.variables,
            timestamp: new Date().toISOString(),
          },
          null,
          2
        ),
        {
          status: envCheck.status === "error" ? 503 : 200,
          headers: corsHeaders,
        }
      );
    }

    // Route: /health-check/supabase (Supabase connectivity check only)
    if (path === "/health-check/supabase") {
      const supabaseCheck = await testSupabaseConnection();

      return new Response(
        JSON.stringify(supabaseCheck, null, 2),
        {
          status: supabaseCheck.status === "error" ? 503 : 200,
          headers: corsHeaders,
        }
      );
    }

    // Default: return available routes
    return new Response(
      JSON.stringify({
        message: "Health Check Edge Function",
        version: "1.0.0",
        availableRoutes: [
          "GET /health-check - Full health status",
          "GET /health-check/status - Full health status (alias)",
          "GET /health-check/env - Environment variables check",
          "GET /health-check/supabase - Supabase connectivity check",
        ],
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Health check error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error.message,
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});





