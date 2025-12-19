// kidscallhome/vite-plugin-defer-css.ts
// Vite plugin to defer CSS loading and prevent render blocking for faster FCP/LCP

import type { Plugin } from 'vite';

/**
 * Vite plugin that defers CSS loading to prevent render blocking.
 * Converts CSS <link> tags to async loading using preload + onload pattern.
 * This improves FCP and LCP by allowing HTML to render before CSS is fully loaded.
 */
export function deferCssPlugin(): Plugin {
  return {
    name: 'defer-css',
    apply: 'build', // Only apply during build
    enforce: 'post', // Run after Vite's HTML plugin injects CSS links
    transformIndexHtml: {
      order: 'post', // Run after other transformIndexHtml hooks
      handler(html: string) {
      // Find all CSS link tags in the HTML
      // Pattern matches: <link rel="stylesheet" href="..."> or <link href="..." rel="stylesheet">
      // Handles different attribute orders and quote styles
      const cssLinkRegex = /<link\s+(?:[^>]*\s+)?rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>|<link\s+(?:[^>]*\s+)?href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*>/gi;
      
      let transformedHtml = html;
      const cssLinks: Array<{ full: string; href: string }> = [];
      
      // Collect all CSS links
      let match;
      while ((match = cssLinkRegex.exec(html)) !== null) {
        // match[1] is href when rel comes first, match[2] is href when href comes first
        const href = match[1] || match[2];
        if (href) {
          cssLinks.push({
            full: match[0],
            href: href,
          });
        }
      }
      
      // Replace each CSS link with async loading pattern
      cssLinks.forEach(({ full, href }) => {
        // Skip if already using preload pattern (avoid double-processing)
        if (full.includes('rel="preload"') || full.includes("rel='preload'")) {
          return;
        }
        
        // Extract any existing attributes (like integrity, crossorigin)
        const attributesMatch = full.match(/<link\s+([^>]+)>/);
        const attributes = attributesMatch ? attributesMatch[1] : '';
        
        // Extract crossorigin if present
        const crossoriginMatch = attributes.match(/crossorigin=["']?([^"'\s>]+)["']?/i);
        const crossorigin = crossoriginMatch ? ` crossorigin="${crossoriginMatch[1]}"` : '';
        
        // Create async CSS loading pattern:
        // 1. Preload the CSS file
        // 2. Use onload to convert preload to stylesheet
        // 3. Fallback noscript for browsers without JS
        const asyncCss = `
    <link rel="preload" href="${href}" as="style"${crossorigin} onload="this.onload=null;this.rel='stylesheet'">
    <noscript><link rel="stylesheet" href="${href}"${crossorigin}></noscript>`;
        
        transformedHtml = transformedHtml.replace(full, asyncCss);
      });
      
        return transformedHtml;
      },
    },
  };
}

