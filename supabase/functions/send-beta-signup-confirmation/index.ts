// supabase/functions/send-beta-signup-confirmation/index.ts
// Edge function to send beta signup confirmation emails

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
    const { email, platform, appVersion, userName } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({
          error: "Missing required field: email",
        }),
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // Build beta page URL
    const baseUrl = Deno.env.get("SITE_URL") || "https://kidscallhome.com";
    const betaUrl = `${baseUrl}/beta`;

    // Email subject
    const subject = "Welcome to Kids Call Home Beta! 🎉";

    // App theme colors (matching the app's primary blue)
    const primaryColor = "#3B82F6"; // hsl(217 100% 59%)
    const primaryColorDark = "#2563EB";
    const backgroundColor = "#F9FAFB";
    const textColor = "#1F2937";
    const textColorMuted = "#6B7280";

    // Email HTML body - styled to match app theme
    const htmlBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Beta Signup Confirmation</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: ${textColor}; background-color: #ffffff; margin: 0; padding: 0;">
          <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: ${backgroundColor};">
            <tr>
              <td style="padding: 40px 20px;">
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, ${primaryColor} 0%, ${primaryColorDark} 100%); padding: 40px 30px; text-align: center;">
                      <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                        🎉 Welcome to Beta!
                      </h1>
                      <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 18px; opacity: 0.95;">
                        Kids Call Home Beta Testing Program
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      <p style="font-size: 18px; margin: 0 0 20px 0; color: ${textColor};">
                        Hi ${userName || "there"},
                      </p>
                      
                      <p style="font-size: 16px; margin: 0 0 20px 0; color: ${textColor};">
                        Thank you for joining the Kids Call Home beta testing program! We're excited to have you on board.
                      </p>
                      
                      <div style="background-color: ${backgroundColor}; border-left: 4px solid ${primaryColor}; padding: 20px; margin: 30px 0; border-radius: 4px;">
                        <p style="font-size: 16px; margin: 0 0 10px 0; color: ${textColor}; font-weight: 600;">
                          What's Next?
                        </p>
                        <ul style="margin: 0; padding-left: 20px; color: ${textColorMuted}; font-size: 15px;">
                          <li style="margin-bottom: 8px;">Try out new features before they're released</li>
                          <li style="margin-bottom: 8px;">Share your feedback and suggestions</li>
                          <li style="margin-bottom: 8px;">Report bugs and help us improve</li>
                          <li>Be part of shaping the future of Kids Call Home</li>
                        </ul>
                      </div>
                      
                      <div style="text-align: center; margin: 40px 0;">
                        <a href="${betaUrl}" 
                           style="display: inline-block; background: ${primaryColor}; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);">
                          Submit Feedback
                        </a>
                      </div>
                      
                      <div style="border-top: 1px solid #E5E7EB; padding-top: 30px; margin-top: 30px;">
                        <p style="font-size: 14px; color: ${textColorMuted}; margin: 0 0 10px 0;">
                          <strong>Your Beta Details:</strong>
                        </p>
                        <table role="presentation" style="width: 100%; border-collapse: collapse;">
                          ${platform ? `<tr><td style="padding: 8px 0; color: ${textColorMuted}; font-size: 14px;">Platform:</td><td style="padding: 8px 0; color: ${textColor}; font-size: 14px; font-weight: 600; text-transform: capitalize;">${platform}</td></tr>` : ''}
                          ${appVersion ? `<tr><td style="padding: 8px 0; color: ${textColorMuted}; font-size: 14px;">App Version:</td><td style="padding: 8px 0; color: ${textColor}; font-size: 14px; font-weight: 600;">${appVersion}</td></tr>` : ''}
                        </table>
                      </div>
                      
                      <p style="font-size: 14px; color: ${textColorMuted}; margin: 30px 0 0 0; border-top: 1px solid #E5E7EB; padding-top: 20px;">
                        You can submit feedback anytime by visiting the <a href="${betaUrl}" style="color: ${primaryColor}; text-decoration: none; font-weight: 600;">Beta Testing page</a> in the app.
                      </p>
                      
                      <p style="font-size: 14px; color: ${textColorMuted}; margin: 20px 0 0 0;">
                        Questions? Reply to this email or contact us at <a href="mailto:support@kidscallhome.com" style="color: ${primaryColor}; text-decoration: none;">support@kidscallhome.com</a>
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: ${backgroundColor}; padding: 30px; text-align: center; border-top: 1px solid #E5E7EB;">
                      <p style="font-size: 12px; color: ${textColorMuted}; margin: 0;">
                        © ${new Date().getFullYear()} Kids Call Home. All rights reserved.
                      </p>
                      <p style="font-size: 12px; color: ${textColorMuted}; margin: 10px 0 0 0;">
                        <a href="${baseUrl}/info" style="color: ${primaryColor}; text-decoration: none;">Privacy Policy</a> | 
                        <a href="${baseUrl}/info" style="color: ${primaryColor}; text-decoration: none;">Terms of Service</a>
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    // Email plain text body
    const textBody = `
Welcome to Kids Call Home Beta! 🎉

Hi ${userName || "there"},

Thank you for joining the Kids Call Home beta testing program! We're excited to have you on board.

What's Next?
- Try out new features before they're released
- Share your feedback and suggestions
- Report bugs and help us improve
- Be part of shaping the future of Kids Call Home

Submit Feedback: ${betaUrl}

Your Beta Details:
${platform ? `Platform: ${platform}\n` : ''}${appVersion ? `App Version: ${appVersion}\n` : ''}

You can submit feedback anytime by visiting the Beta Testing page in the app: ${betaUrl}

Questions? Reply to this email or contact us at support@kidscallhome.com

© ${new Date().getFullYear()} Kids Call Home. All rights reserved.
    `;

    // Send email using Supabase's built-in email service first
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
              "Email service not configured. Beta signup successful but confirmation email not sent.",
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
    console.error("Error sending beta signup confirmation email:", error);
    // Return generic error to prevent information leakage
    return new Response(
      JSON.stringify({
        error: "Failed to send confirmation email",
      }),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
});

