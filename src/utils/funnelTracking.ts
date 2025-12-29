// src/utils/funnelTracking.ts
// Purpose: Minimal funnel tracking for trust-gated decision funnel
// Tracks only essential events: page views, intent signals, and conversion intent

/**
 * Funnel event types - minimal set for trust-gated decision funnel
 */
export type FunnelEventType =
  | "view_home"
  | "view_info"
  | "click_comparison"
  | "click_trust"
  | "click_faq"
  | "click_primary_cta"
  | "start_signup"
  | "confidence_signal";

/**
 * Intent type for CTA tracking - normalizes user intent stage
 */
export type IntentType = "explore" | "compare" | "trust" | "commit";

interface FunnelEvent {
  event: FunnelEventType;
  timestamp: number;
  metadata?: {
    source?: string;
    section?: string;
    cta_text?: string;
    [key: string]: unknown;
  };
}

/**
 * Track funnel event
 * Sends to Google Analytics (gtag) if available, otherwise logs locally
 */
export function trackFunnelEvent(
  event: FunnelEventType,
  metadata?: FunnelEvent["metadata"]
): void {
  const funnelEvent: FunnelEvent = {
    event,
    timestamp: Date.now(),
    metadata,
  };

  // Send to Google Analytics if available
  if (typeof window !== "undefined") {
    const gtag = (window as { gtag?: (command: string, event: string, params?: Record<string, unknown>) => void }).gtag;
    if (gtag) {
      try {
        gtag("event", event, {
          event_category: "funnel",
          ...metadata,
        });
      } catch (error) {
        // Silently fail - analytics shouldn't break the app
        console.warn("Funnel tracking error:", error);
      }
    }
  }

  // Also log locally in dev mode for debugging
  if (import.meta.env.DEV) {
    // Dev-only logging for funnel debugging
    // eslint-disable-next-line no-console
    console.log("[FUNNEL]", funnelEvent);
  }
}

/**
 * Track page view
 */
export function trackPageView(page: "home" | "info"): void {
  if (page === "home") {
    trackFunnelEvent("view_home");
  } else if (page === "info") {
    trackFunnelEvent("view_info");
  }
}

/**
 * Track comparison section interaction
 */
export function trackComparisonClick(source?: string): void {
  trackFunnelEvent("click_comparison", { source });
}

/**
 * Track trust signals section interaction
 */
export function trackTrustClick(source?: string): void {
  trackFunnelEvent("click_trust", { source });
}

/**
 * Track FAQ interaction
 */
export function trackFAQClick(question?: string): void {
  trackFunnelEvent("click_faq", { question });
}

/**
 * Track primary CTA click with intent type normalization
 */
export function trackPrimaryCTA(
  ctaText: string,
  intentType: IntentType,
  section?: string
): void {
  trackFunnelEvent("click_primary_cta", {
    cta_text: ctaText,
    intent_type: intentType,
    section,
  });
}

/**
 * Track signup start
 */
export function trackSignupStart(source?: string): void {
  trackFunnelEvent("start_signup", { source });
}

/**
 * Track confidence signal - unspoken yes from user
 * Fires when:
 * - User scrolls past TrustSignalsSection
 * - User opens ≥3 FAQ questions
 * - User spends ≥90 seconds on /info
 * 
 * IMPORTANT: Debounced per session - fires only once per session
 * The first trigger is the valuable data (which signal converted them)
 */
export function trackConfidenceSignal(trigger: "scroll_trust" | "faq_depth" | "time_on_page"): void {
  // Check if confidence signal already fired this session
  const sessionKey = "kch_confidence_fired";
  const hasFired = sessionStorage.getItem(sessionKey);
  
  if (hasFired) {
    // Already fired this session - skip (binary confidence, not frequency)
    return;
  }

  // Mark as fired and track the first trigger (most valuable data)
  sessionStorage.setItem(sessionKey, "true");
  trackFunnelEvent("confidence_signal", {
    trigger,
    first_trigger: trigger, // Explicitly mark as first trigger
  });
}

