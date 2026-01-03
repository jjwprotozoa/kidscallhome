// src/features/referrals/utils/referralHelpers.ts
// Purpose: Centralized referral link and message generation utilities

import { getGeneralShareMessage } from "./shareMessages";

const BASE_URL = typeof window !== "undefined" ? window.location.origin : "https://kidscallhome.com";

/**
 * Generates a referral share link with optional source parameter for analytics
 * @param referralCode - The user's referral code
 * @param source - Optional source identifier (e.g., 'top_nav_share', 'referrals_page')
 * @returns The referral URL with ref parameter and optional source parameter
 */
export const getReferralShareLink = (
  referralCode: string,
  source?: string
): string => {
  if (!referralCode) {
    return BASE_URL;
  }

  const url = new URL(`${BASE_URL}/parent/auth`);
  url.searchParams.set("ref", referralCode);
  
  if (source) {
    url.searchParams.set("source", source);
  }

  return url.toString();
};

/**
 * Generates a referral share message with code and link
 * @param referralCode - The user's referral code
 * @param referralUrl - The referral URL
 * @returns Formatted share message
 * @deprecated Use getGeneralShareMessage from shareMessages instead
 */
export const getReferralMessage = (
  referralCode: string,
  referralUrl: string
): string => {
  return getGeneralShareMessage(referralCode, referralUrl);
};

