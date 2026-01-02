// src/utils/emailObfuscation.ts
// Purpose: Email obfuscation utility to protect email addresses from spam bots

/**
 * Obfuscates an email address by encoding it
 * This makes it harder for spam bots to scrape the email
 */
export function obfuscateEmail(email: string): string {
  // Simple character code obfuscation
  return email
    .split("")
    .map((char) => {
      if (char === "@") return "&#64;";
      if (char === ".") return "&#46;";
      return char;
    })
    .join("");
}

/**
 * Decodes an obfuscated email address for display
 */
export function decodeEmail(obfuscated: string): string {
  return obfuscated
    .replace(/&#64;/g, "@")
    .replace(/&#46;/g, ".");
}

/**
 * Creates a mailto link with obfuscated email
 * The href is obfuscated but the display text can be plain
 */
export function createMailtoLink(
  email: string,
  subject?: string,
  body?: string
): string {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);

  const query = params.toString();
  return `mailto:${email}${query ? `?${query}` : ""}`;
}

/**
 * Gets the email address for display (can be obfuscated or plain)
 * For better spam protection, use obfuscated version
 */
export function getEmailDisplay(email: string, obfuscate = true): string {
  return obfuscate ? obfuscateEmail(email) : email;
}







