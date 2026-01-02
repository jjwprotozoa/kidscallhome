// src/components/layout/PageContentLayout.tsx
// Purpose: Wrapper component that provides consistent top padding for page content
// to account for fixed navigation bar. Single source of truth for layout spacing.

import React from "react";
import { cn } from "@/lib/utils";

interface PageContentLayoutProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * PageContentLayout - Wraps page content with consistent top padding
 * to prevent overlap with fixed navigation bar.
 * 
 * Navigation bar height is 4rem (64px, h-16), so content needs matching padding-top.
 * This ensures page titles and content are always visible below the navbar.
 */
export const PageContentLayout: React.FC<PageContentLayoutProps> = ({
  children,
  className,
}) => {
  return (
    <main
      className={cn(
        "pt-[var(--navbar-height)]", // 4rem = 64px, matches navbar h-16
        className
      )}
    >
      {children}
    </main>
  );
};




