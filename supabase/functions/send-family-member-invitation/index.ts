// supabase/functions/send-family-member-invitation/index.ts
// Edge function to send family member invitation emails

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

// Helper function to validate Content-Type
function validateContentType(req: Request): boolean {
  const contentType = req.headers.get("content-type");
  return contentType?.includes("application/json") || false;
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // SECURITY: Validate Content-Type for POST requests
  if (req.method === "POST" && !validateContentType(req)) {
    return new Response(
      JSON.stringify({
        error: "Invalid Content-Type. Expected application/json",
      }),
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        {
          status: 401,
          headers: corsHeaders,
        }
      );
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify user is authenticated
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    // Parse request body
    const { invitationToken, email, name, relationship, parentName } =
      await req.json();

    if (!invitationToken || !email || !name) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: invitationToken, email, name",
        }),
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // Build invitation URL
    const baseUrl = Deno.env.get("SITE_URL") || "https://kidscallhome.com";
    const invitationUrl = `${baseUrl}/family-member/invite/${invitationToken}`;

    // Email subject
    const subject = `${
      parentName || "A family member"
    } invited you to Kids Call Home`;

    // Email HTML body
    const htmlBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Family Invitation</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">You're Invited!</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">
              Hi ${name},
            </p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              ${
                parentName || "A family member"
              } has invited you to join Kids Call Home as a ${
      relationship || "family member"
    }. 
              You'll be able to make video calls and send messages with the children in the family.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${invitationUrl}" 
                 style="display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                Accept Invitation
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              Or copy and paste this link into your browser:<br>
              <a href="${invitationUrl}" style="color: #667eea; word-break: break-all;">${invitationUrl}</a>
            </p>
            
            <p style="font-size: 14px; color: #666; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
              This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
        </body>
      </html>
    `;

    // Email plain text body
    const textBody = `
Hi ${name},

${
  parentName || "A family member"
} has invited you to join Kids Call Home as a ${
      relationship || "family member"
    }. 
You'll be able to make video calls and send messages with the children in the family.

Accept your invitation by clicking this link:
${invitationUrl}

This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
    `;

    // Send email using Supabase's built-in email service
    // Note: This requires Supabase email to be configured
    // Alternative: Use a service like Resend, SendGrid, or AWS SES
    const { data: emailData, error: emailError } =
      await supabaseClient.functions.invoke("send-email", {
        body: {
          to: email,
          subject: subject,
          html: htmlBody,
          text: textBody,
        },
      });

    // If built-in email function doesn't exist, try using Resend API directly
    if (emailError || !emailData) {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");

      if (resendApiKey) {
        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "Kids Call Home <noreply@kidscallhome.com>",
            to: email,
            subject: subject,
            html: htmlBody,
            text: textBody,
          }),
        });

        if (!resendResponse.ok) {
          const errorText = await resendResponse.text();
          console.error("Resend API error:", errorText);
          throw new Error(`Failed to send email: ${errorText}`);
        }

        const resendData = await resendResponse.json();
        return new Response(
          JSON.stringify({
            success: true,
            messageId: resendData.id,
            method: "resend",
          }),
          {
            status: 200,
            headers: corsHeaders,
          }
        );
      } else {
        // No email service configured - return success but log warning
        console.warn("No email service configured. Email not sent.");
        return new Response(
          JSON.stringify({
            success: false,
            warning:
              "Email service not configured. Invitation created but email not sent.",
          }),
          {
            status: 200,
            headers: corsHeaders,
          }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        messageId: emailData?.id,
        method: "supabase",
      }),
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    // Log detailed error server-side only
    console.error("Error sending invitation email:", error);
    // Return generic error to prevent information leakage
    return new Response(
      JSON.stringify({
        error: "Failed to send invitation email",
      }),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
});
