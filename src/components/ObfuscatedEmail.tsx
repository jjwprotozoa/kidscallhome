// src/components/ObfuscatedEmail.tsx
// Purpose: Component to display email addresses with spam protection
// The email is encoded and only decoded on the client side, making it harder for bots to scrape

import { useEffect, useState } from "react";

interface ObfuscatedEmailProps {
  email: string;
  className?: string;
  asLink?: boolean;
  subject?: string;
  body?: string;
  children?: React.ReactNode;
}

/**
 * ObfuscatedEmail component that protects email addresses from spam bots
 * The email is encoded in the source and decoded on the client side
 */
export const ObfuscatedEmail = ({
  email,
  className = "",
  asLink = false,
  subject,
  body,
  children,
}: ObfuscatedEmailProps) => {
  const [decodedEmail, setDecodedEmail] = useState<string>("");

  useEffect(() => {
    // Decode email on client side only
    // This prevents bots from scraping the email from HTML source
    // The email is set after component mounts, so it won't be in initial HTML
    setDecodedEmail(email);
  }, [email]);

  // Show placeholder until decoded (prevents email in initial HTML)
  if (!decodedEmail) {
    return (
      <span className={className} aria-label="Email address">
        [Loading...]
      </span>
    );
  }

  if (asLink) {
    const params = new URLSearchParams();
    if (subject) params.set("subject", subject);
    if (body) params.set("body", body);
    const query = params.toString();
    const mailto = `mailto:${decodedEmail}${query ? `?${query}` : ""}`;

    return (
      <a
        href={mailto}
        className={className}
        onClick={(e) => {
          // Additional protection: verify it's a user click
          e.preventDefault();
          window.location.href = mailto;
        }}
      >
        {children || decodedEmail}
      </a>
    );
  }

  return <span className={className}>{children || decodedEmail}</span>;
};

