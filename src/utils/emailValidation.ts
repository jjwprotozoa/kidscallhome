// src/utils/emailValidation.ts
// Purpose: Email validation and typo correction utilities

/**
 * Normalize email: trim whitespace and convert to lowercase
 */
export function normalizeEmail(email: string): string {
  if (!email || typeof email !== "string") {
    return "";
  }
  return email.trim().toLowerCase();
}

/**
 * Basic email validation: one "@", at least one ".", no spaces, domain has at least 2 chars TLD
 */
export function isValidEmailBasic(email: string): boolean {
  if (!email || typeof email !== "string") {
    return false;
  }

  const trimmed = email.trim();
  
  // Must have exactly one "@"
  const atCount = (trimmed.match(/@/g) || []).length;
  if (atCount !== 1) {
    return false;
  }

  // No spaces allowed
  if (/\s/.test(trimmed)) {
    return false;
  }

  // Split by "@" to get local and domain parts
  const parts = trimmed.split("@");
  if (parts.length !== 2) {
    return false;
  }

  const [localPart, domainPart] = parts;

  // Local part must not be empty
  if (!localPart || localPart.length === 0) {
    return false;
  }

  // Domain must have at least one "."
  if (!domainPart.includes(".")) {
    return false;
  }

  // TLD must be at least 2 characters
  const domainParts = domainPart.split(".");
  const tld = domainParts[domainParts.length - 1];
  if (!tld || tld.length < 2) {
    return false;
  }

  return true;
}

/**
 * Common email domain typos and their corrections
 */
const DOMAIN_TYPOS: Record<string, string> = {
  // Gmail typos
  "gmail.con": "gmail.com",
  "gmail.co": "gmail.com",
  "gmal.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmail.coom": "gmail.com",
  "gmail.cop": "gmail.com",
  "gmail.cpm": "gmail.com",
  "gmai.com": "gmail.com",
  "gmaol.com": "gmail.com",
  "gmil.com": "gmail.com",
  
  // Hotmail typos
  "hotnail.com": "hotmail.com",
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmali.com": "hotmail.com",
  "hotmal.com": "hotmail.com",
  
  // Outlook typos
  "outlok.com": "outlook.com",
  "outlokc.com": "outlook.com",
  "outlook.co": "outlook.com",
  "outlook.con": "outlook.com",
  
  // Yahoo typos
  "yaho.com": "yahoo.com",
  "yhoo.com": "yahoo.com",
  "yahoo.co": "yahoo.com",
  "yahoo.con": "yahoo.com",
  
  // iCloud typos
  "iclud.com": "icloud.com",
  "icloud.co": "icloud.com",
  "icloud.con": "icloud.com",
  "iclod.com": "icloud.com",
  
  // AOL typos
  "aol.co": "aol.com",
  "aol.con": "aol.com",
  
  // Protonmail typos
  "protonmail.co": "protonmail.com",
  "protonmail.con": "protonmail.com",
  
  // Yandex typos
  "yandex.co": "yandex.com",
  "yandex.con": "yandex.com",
};

/**
 * Suggest email correction for common domain typos
 * Returns the corrected email if a typo is detected, null otherwise
 */
export function suggestEmailCorrection(email: string): string | null {
  if (!email || typeof email !== "string") {
    return null;
  }

  const trimmed = email.trim();
  
  // Must have "@" to check domain
  if (!trimmed.includes("@")) {
    return null;
  }

  const parts = trimmed.split("@");
  if (parts.length !== 2) {
    return null;
  }

  const [localPart, domainPart] = parts;

  // Check if domain matches a known typo (case-insensitive)
  const normalizedDomain = domainPart.toLowerCase();
  const correctedDomain = DOMAIN_TYPOS[normalizedDomain];

  if (correctedDomain) {
    // Return corrected email with original local part
    return `${localPart}@${correctedDomain}`;
  }

  return null;
}

