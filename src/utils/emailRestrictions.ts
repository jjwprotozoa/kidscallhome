// src/utils/emailRestrictions.ts
// Purpose: Detect likely restricted email domains (school/child-managed accounts)

import { normalizeEmail } from "./emailValidation";

/**
 * Extract domain from email address
 */
export function getEmailDomain(email: string): string {
  if (!email || typeof email !== "string") {
    return "";
  }

  const normalized = normalizeEmail(email);
  if (!normalized) {
    return "";
  }

  const parts = normalized.split("@");
  if (parts.length !== 2) {
    return "";
  }

  return parts[1] || "";
}

/**
 * Common personal email providers that should NOT be flagged as restricted
 */
const ALLOWED_PERSONAL_DOMAINS = new Set([
  "gmail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
]);

/**
 * Keywords that suggest a school or child-managed email domain
 * (case-insensitive matching)
 * Note: "ps" is checked as a token (domain segment), not substring
 */
const RESTRICTED_KEYWORDS = [
  "k12",
  "school",
  "schools",
  "student",
  "students",
  "district",
  "isd",
  "usd",
  "publicschool",
  "myschool",
];

/**
 * Check if email domain contains restricted keywords
 * For "ps", only matches if it appears as a standalone domain segment
 */
function domainContainsRestrictedKeywords(domain: string): boolean {
  const lowerDomain = domain.toLowerCase();
  
  // Split domain into parts (by dots and hyphens) for token-based matching
  const domainParts = lowerDomain.split(/[.-]/);
  
  // Check standard keywords (substring match is safe for these)
  const standardKeywords = RESTRICTED_KEYWORDS.filter(k => k !== "ps");
  if (standardKeywords.some((keyword) => lowerDomain.includes(keyword))) {
    return true;
  }
  
  // Special handling for "ps" - only match if it's a standalone segment
  // e.g., springdaleps.org ✅ but capsule.com ❌
  if (domainParts.includes("ps")) {
    return true;
  }
  
  return false;
}

/**
 * Check if email domain is likely restricted (school or child-managed account)
 * Uses conservative heuristic to avoid over-blocking
 * 
 * Order of checks (important for accuracy):
 * 1. Normalize + get domain
 * 2. If domain in allowlist → return false (allowlist wins)
 * 3. If endsWith .edu → return true
 * 4. If keyword token match → return true
 * 5. Else return false
 */
export function isLikelyRestrictedEmail(email: string): boolean {
  const domain = getEmailDomain(email);
  if (!domain) {
    return false;
  }

  // STEP 1: Always allow common personal providers (allowlist wins no matter what)
  // This prevents false positives for custom domains on Google Workspace, etc.
  if (ALLOWED_PERSONAL_DOMAINS.has(domain)) {
    return false;
  }

  // STEP 2: Check if domain ends with .edu (educational institutions)
  if (domain.endsWith(".edu")) {
    return true;
  }

  // STEP 3: Check if domain contains restricted keywords (token-based for "ps")
  if (domainContainsRestrictedKeywords(domain)) {
    return true;
  }

  return false;
}

/**
 * Get the reason why an email is considered restricted
 * Returns null if email is not restricted
 */
export function getRestrictionReason(
  email: string
): "school_or_child_account" | null {
  if (!isLikelyRestrictedEmail(email)) {
    return null;
  }

  // All restrictions are for school/child accounts
  return "school_or_child_account";
}

