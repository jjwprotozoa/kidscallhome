// src/components/SEOHead.tsx
// Reusable SEO component for setting page-specific meta tags
// Updates document title, meta description, and Open Graph tags

import { useEffect } from "react";

interface SEOHeadProps {
  title: string;
  description: string;
  path: string; // e.g., "/pricing" - will be appended to base URL
  ogImage?: string; // Optional custom OG image, defaults to main OG image
  noIndex?: boolean; // Set to true to prevent indexing (e.g., for error pages)
}

const BASE_URL = "https://www.kidscallhome.com";
const DEFAULT_OG_IMAGE = `${BASE_URL}/og/kidscallhome-og.png`;

export const SEOHead = ({
  title,
  description,
  path,
  ogImage = DEFAULT_OG_IMAGE,
  noIndex = false,
}: SEOHeadProps) => {
  useEffect(() => {
    // Update document title
    const fullTitle = title.includes("Kids Call Home")
      ? title
      : `${title} | Kids Call Home`;
    document.title = fullTitle;

    // Helper to update or create meta tag
    const setMetaTag = (
      name: string,
      content: string,
      isProperty = false
    ) => {
      const attribute = isProperty ? "property" : "name";
      let element = document.querySelector(
        `meta[${attribute}="${name}"]`
      ) as HTMLMetaElement | null;

      if (element) {
        element.setAttribute("content", content);
      } else {
        element = document.createElement("meta");
        element.setAttribute(attribute, name);
        element.setAttribute("content", content);
        document.head.appendChild(element);
      }
    };

    // Helper to update or create link tag
    const setLinkTag = (rel: string, href: string) => {
      let element = document.querySelector(
        `link[rel="${rel}"]`
      ) as HTMLLinkElement | null;

      if (element) {
        element.setAttribute("href", href);
      } else {
        element = document.createElement("link");
        element.setAttribute("rel", rel);
        element.setAttribute("href", href);
        document.head.appendChild(element);
      }
    };

    const fullUrl = `${BASE_URL}${path}`;

    // Standard meta tags
    setMetaTag("description", description);
    setMetaTag("robots", noIndex ? "noindex,nofollow" : "index,follow");

    // Canonical URL
    setLinkTag("canonical", fullUrl);

    // Open Graph tags
    setMetaTag("og:title", fullTitle, true);
    setMetaTag("og:description", description, true);
    setMetaTag("og:url", fullUrl, true);
    setMetaTag("og:image", ogImage, true);
    setMetaTag("og:type", "website", true);
    setMetaTag("og:site_name", "Kids Call Home", true);

    // Twitter Card tags
    setMetaTag("twitter:card", "summary_large_image");
    setMetaTag("twitter:title", fullTitle);
    setMetaTag("twitter:description", description);
    setMetaTag("twitter:image", ogImage);

    // Cleanup function to restore defaults when component unmounts
    return () => {
      // Reset to default title
      document.title =
        "Kids Call Home – Safe Video Calls for Kids Without a Phone Number or SIM Card";
      
      // Reset canonical to home
      setLinkTag("canonical", BASE_URL + "/");
      
      // Reset meta description to default
      setMetaTag(
        "description",
        "Safe video calling and messaging app for kids. Family-only contacts controlled by parents. Works on most phones and tablets over Wi‑Fi or mobile data, no phone number or SIM card required. No ads. Privacy-respecting analytics only."
      );
      
      // Reset robots
      setMetaTag("robots", "index,follow,max-image-preview:large");
    };
  }, [title, description, path, ogImage, noIndex]);

  // This component doesn't render anything visible
  return null;
};

export default SEOHead;

