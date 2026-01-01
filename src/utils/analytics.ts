// src/utils/analytics.ts
// Comprehensive analytics tracking for Kids Call Home
// Tracks AARRR metrics: Acquisition, Activation, Retention, Revenue, Referral

/**
 * Analytics event categories for GA4
 */
type EventCategory =
  | "acquisition"    // How users find us
  | "activation"     // First value moment
  | "engagement"     // Ongoing usage
  | "retention"      // Return visits
  | "revenue"        // Subscription events
  | "referral"       // Viral growth
  | "technical"      // App health
  | "funnel";        // Marketing funnel

/**
 * All trackable analytics events
 */
export type AnalyticsEvent =
  // Acquisition events
  | "page_view"
  | "landing_page_view"
  | "seo_page_view"
  
  // Activation events (first value)
  | "signup_started"
  | "signup_complete"
  | "email_verified"
  | "child_added"
  | "first_call_made"
  | "first_message_sent"
  | "family_setup_complete"
  
  // Engagement events
  | "call_started"
  | "call_completed"
  | "call_duration"
  | "message_sent"
  | "family_member_invited"
  | "family_member_joined"
  | "child_login_success"
  | "child_login_failed"
  | "device_authorized"
  | "pwa_installed"
  | "app_opened"
  
  // Retention events
  | "return_visit"
  | "weekly_active"
  | "monthly_active"
  
  // Revenue events
  | "pricing_viewed"
  | "upgrade_started"
  | "subscription_started"
  | "subscription_renewed"
  | "subscription_cancelled"
  | "subscription_reactivated"
  
  // Referral events
  | "referral_link_copied"
  | "referral_link_shared"
  | "referral_signup"
  | "referral_converted"
  
  // Technical events
  | "call_failed"
  | "call_quality_poor"
  | "webrtc_error"
  | "network_error"
  | "permission_denied"
  | "error_occurred";

/**
 * Event parameters interface
 */
interface EventParams {
  // Common params
  event_category?: EventCategory;
  event_label?: string;
  value?: number;
  
  // User context
  user_type?: "parent" | "child" | "family_member" | "anonymous";
  
  // Call-specific
  call_duration_seconds?: number;
  call_type?: "video" | "audio";
  call_quality?: "excellent" | "good" | "fair" | "poor";
  call_end_reason?: "completed" | "failed" | "cancelled" | "timeout" | "network";
  
  // Subscription-specific
  plan_type?: "free" | "family_monthly" | "family_annual";
  plan_price?: number;
  currency?: string;
  
  // Referral-specific
  referral_code?: string;
  referral_source?: string;
  
  // Technical
  error_type?: string;
  error_message?: string;
  platform?: "web" | "pwa" | "android" | "ios";
  
  // Page context
  page_path?: string;
  page_title?: string;
  
  // Custom
  [key: string]: unknown;
}

/**
 * Check if analytics is enabled (respects cookie consent)
 */
function isAnalyticsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  
  // Check cookie consent
  const consent = localStorage.getItem("cookie-consent");
  if (consent) {
    try {
      const parsed = JSON.parse(consent);
      if (parsed.analytics === false) return false;
    } catch {
      // Invalid consent data, default to enabled
    }
  }
  
  return true;
}

/**
 * Get the gtag function if available
 */
function getGtag(): ((...args: unknown[]) => void) | null {
  if (typeof window === "undefined") return null;
  const gtag = (window as { gtag?: (...args: unknown[]) => void }).gtag;
  return typeof gtag === "function" ? gtag : null;
}

/**
 * Get or initialize dataLayer
 */
function getDataLayer(): unknown[] {
  if (typeof window === "undefined") return [];
  const win = window as { dataLayer?: unknown[] };
  win.dataLayer = win.dataLayer || [];
  return win.dataLayer;
}

/**
 * Track an analytics event
 * Sends to GA4 via gtag, queues in dataLayer if gtag not loaded
 */
export function trackEvent(
  eventName: AnalyticsEvent,
  params?: EventParams
): void {
  if (!isAnalyticsEnabled()) return;

  try {
    const gtag = getGtag();
    const eventParams = {
      ...params,
      timestamp: Date.now(),
    };

    if (gtag) {
      // gtag is loaded, use it directly
      gtag("event", eventName, eventParams);
    } else {
      // Queue in dataLayer for when gtag loads
      const dataLayer = getDataLayer();
      dataLayer.push({
        event: eventName,
        ...eventParams,
      });
    }

    // Dev logging
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log("[Analytics]", eventName, eventParams);
    }
  } catch (error) {
    // Analytics should never break the app
    if (import.meta.env.DEV) {
      console.warn("[Analytics Error]", error);
    }
  }
}

// ============================================================
// ACQUISITION TRACKING
// ============================================================

/**
 * Track page view with SEO context
 */
export function trackPageView(
  pagePath: string,
  pageTitle?: string,
  isLandingPage = false
): void {
  const eventName = isLandingPage ? "landing_page_view" : "page_view";
  trackEvent(eventName, {
    event_category: "acquisition",
    page_path: pagePath,
    page_title: pageTitle,
  });
}

/**
 * Track SEO landing page view
 */
export function trackSEOPageView(pagePath: string, pageTitle: string): void {
  trackEvent("seo_page_view", {
    event_category: "acquisition",
    page_path: pagePath,
    page_title: pageTitle,
    event_label: "seo_landing",
  });
}

// ============================================================
// ACTIVATION TRACKING
// ============================================================

/**
 * Track signup started
 */
export function trackSignupStarted(source?: string): void {
  trackEvent("signup_started", {
    event_category: "activation",
    event_label: source,
  });
}

/**
 * Track signup completed
 */
export function trackSignupComplete(
  userType: "parent" | "family_member" = "parent",
  hasReferral = false
): void {
  trackEvent("signup_complete", {
    event_category: "activation",
    user_type: userType,
    referral_signup: hasReferral,
  });
}

/**
 * Track email verification
 */
export function trackEmailVerified(): void {
  trackEvent("email_verified", {
    event_category: "activation",
  });
}

/**
 * Track child added to family
 */
export function trackChildAdded(childCount: number): void {
  trackEvent("child_added", {
    event_category: "activation",
    value: childCount,
    event_label: childCount === 1 ? "first_child" : "additional_child",
  });
}

/**
 * Track first call made (activation milestone)
 */
export function trackFirstCallMade(callType: "video" | "audio" = "video"): void {
  trackEvent("first_call_made", {
    event_category: "activation",
    call_type: callType,
  });
}

/**
 * Track first message sent
 */
export function trackFirstMessageSent(): void {
  trackEvent("first_message_sent", {
    event_category: "activation",
  });
}

/**
 * Track family setup complete (all activation steps done)
 */
export function trackFamilySetupComplete(
  childCount: number,
  familyMemberCount: number
): void {
  trackEvent("family_setup_complete", {
    event_category: "activation",
    value: childCount,
    family_member_count: familyMemberCount,
  });
}

// ============================================================
// ENGAGEMENT TRACKING
// ============================================================

/**
 * Track call started
 */
export function trackCallStarted(
  callType: "video" | "audio",
  userType: "parent" | "child" | "family_member"
): void {
  trackEvent("call_started", {
    event_category: "engagement",
    call_type: callType,
    user_type: userType,
  });
}

/**
 * Track call completed
 */
export function trackCallCompleted(
  durationSeconds: number,
  callType: "video" | "audio",
  quality?: "excellent" | "good" | "fair" | "poor"
): void {
  trackEvent("call_completed", {
    event_category: "engagement",
    call_duration_seconds: durationSeconds,
    call_type: callType,
    call_quality: quality,
    value: durationSeconds,
  });

  // Also track duration as separate event for easier analysis
  trackEvent("call_duration", {
    event_category: "engagement",
    value: durationSeconds,
    call_type: callType,
  });
}

/**
 * Track message sent
 */
export function trackMessageSent(
  userType: "parent" | "child" | "family_member"
): void {
  trackEvent("message_sent", {
    event_category: "engagement",
    user_type: userType,
  });
}

/**
 * Track family member invited
 */
export function trackFamilyMemberInvited(): void {
  trackEvent("family_member_invited", {
    event_category: "engagement",
  });
}

/**
 * Track family member joined
 */
export function trackFamilyMemberJoined(fromInvite = true): void {
  trackEvent("family_member_joined", {
    event_category: "engagement",
    event_label: fromInvite ? "from_invite" : "direct",
  });
}

/**
 * Track child login
 */
export function trackChildLogin(success: boolean, method?: string): void {
  trackEvent(success ? "child_login_success" : "child_login_failed", {
    event_category: "engagement",
    event_label: method,
  });
}

/**
 * Track device authorization
 */
export function trackDeviceAuthorized(): void {
  trackEvent("device_authorized", {
    event_category: "engagement",
  });
}

/**
 * Track PWA installation
 */
export function trackPWAInstalled(): void {
  trackEvent("pwa_installed", {
    event_category: "engagement",
    platform: "pwa",
  });
}

/**
 * Track app opened (for retention)
 */
export function trackAppOpened(
  userType: "parent" | "child" | "family_member"
): void {
  trackEvent("app_opened", {
    event_category: "retention",
    user_type: userType,
  });
}

// ============================================================
// REVENUE TRACKING
// ============================================================

/**
 * Track pricing page viewed
 */
export function trackPricingViewed(source?: string): void {
  trackEvent("pricing_viewed", {
    event_category: "revenue",
    event_label: source,
  });
}

/**
 * Track upgrade flow started
 */
export function trackUpgradeStarted(planType: string): void {
  trackEvent("upgrade_started", {
    event_category: "revenue",
    plan_type: planType,
  });
}

/**
 * Track subscription started (conversion!)
 */
export function trackSubscriptionStarted(
  planType: "family_monthly" | "family_annual",
  price: number,
  currency = "USD",
  hasReferral = false
): void {
  trackEvent("subscription_started", {
    event_category: "revenue",
    plan_type: planType,
    plan_price: price,
    currency: currency,
    value: price,
    referral_converted: hasReferral,
  });

  // Also send as GA4 purchase event for e-commerce tracking
  const gtag = getGtag();
  if (gtag) {
    gtag("event", "purchase", {
      transaction_id: `sub_${Date.now()}`,
      value: price,
      currency: currency,
      items: [
        {
          item_id: planType,
          item_name: planType === "family_monthly" ? "Family Plan Monthly" : "Family Plan Annual",
          price: price,
          quantity: 1,
        },
      ],
    });
  }
}

/**
 * Track subscription cancelled
 */
export function trackSubscriptionCancelled(
  planType: string,
  reason?: string
): void {
  trackEvent("subscription_cancelled", {
    event_category: "revenue",
    plan_type: planType,
    event_label: reason,
  });
}

/**
 * Track subscription reactivated
 */
export function trackSubscriptionReactivated(planType: string): void {
  trackEvent("subscription_reactivated", {
    event_category: "revenue",
    plan_type: planType,
  });
}

// ============================================================
// REFERRAL TRACKING
// ============================================================

/**
 * Track referral link copied
 */
export function trackReferralLinkCopied(referralCode: string): void {
  trackEvent("referral_link_copied", {
    event_category: "referral",
    referral_code: referralCode,
  });
}

/**
 * Track referral link shared
 */
export function trackReferralLinkShared(
  referralCode: string,
  shareMethod?: string
): void {
  trackEvent("referral_link_shared", {
    event_category: "referral",
    referral_code: referralCode,
    event_label: shareMethod,
  });
}

/**
 * Track referral signup (someone signed up with a referral code)
 */
export function trackReferralSignup(referralCode: string): void {
  trackEvent("referral_signup", {
    event_category: "referral",
    referral_code: referralCode,
  });
}

/**
 * Track referral converted (referral led to subscription)
 */
export function trackReferralConverted(referralCode: string): void {
  trackEvent("referral_converted", {
    event_category: "referral",
    referral_code: referralCode,
  });
}

// ============================================================
// TECHNICAL/ERROR TRACKING
// ============================================================

/**
 * Track call failed
 */
export function trackCallFailed(
  reason: string,
  callType: "video" | "audio" = "video"
): void {
  trackEvent("call_failed", {
    event_category: "technical",
    call_type: callType,
    call_end_reason: "failed",
    error_type: reason,
  });
}

/**
 * Track poor call quality
 */
export function trackCallQualityPoor(
  quality: "fair" | "poor",
  durationSeconds: number
): void {
  trackEvent("call_quality_poor", {
    event_category: "technical",
    call_quality: quality,
    call_duration_seconds: durationSeconds,
  });
}

/**
 * Track WebRTC error
 */
export function trackWebRTCError(errorType: string): void {
  trackEvent("webrtc_error", {
    event_category: "technical",
    error_type: errorType,
  });
}

/**
 * Track network error
 */
export function trackNetworkError(errorType: string): void {
  trackEvent("network_error", {
    event_category: "technical",
    error_type: errorType,
  });
}

/**
 * Track permission denied (camera/mic)
 */
export function trackPermissionDenied(
  permissionType: "camera" | "microphone" | "notifications"
): void {
  trackEvent("permission_denied", {
    event_category: "technical",
    error_type: permissionType,
  });
}

/**
 * Track general error
 */
export function trackError(
  errorType: string,
  errorMessage?: string,
  context?: string
): void {
  trackEvent("error_occurred", {
    event_category: "technical",
    error_type: errorType,
    error_message: errorMessage?.slice(0, 100), // Limit length
    event_label: context,
  });
}

// ============================================================
// USER PROPERTIES
// ============================================================

/**
 * Set user properties for better segmentation in GA4
 */
export function setUserProperties(properties: {
  user_type?: "parent" | "child" | "family_member";
  has_subscription?: boolean;
  child_count?: number;
  family_member_count?: number;
  account_age_days?: number;
  platform?: "web" | "pwa" | "android" | "ios";
}): void {
  const gtag = getGtag();
  if (gtag) {
    gtag("set", "user_properties", properties);
  }

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log("[Analytics] User properties set:", properties);
  }
}

/**
 * Set user ID for cross-device tracking (use hashed ID, not PII)
 */
export function setUserId(hashedUserId: string): void {
  const gtag = getGtag();
  if (gtag) {
    gtag("set", { user_id: hashedUserId });
  }
}

