// src/components/layout/ParentLayout.tsx
// Purpose: Shared layout wrapper for all /parent/* routes
// Provides consistent top padding to prevent Navigation overlap with page content

import React from "react";
import Navigation from "@/components/Navigation";
import { cn } from "@/lib/utils";

interface ParentLayoutProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * ParentLayout - Shared wrapper for all parent pages
 *
 * Features:
 * - Renders Navigation component (fixed at top)
 * - Applies padding-top using CSS variable --kch-topnav-h (set by Navigation component)
 * - Ensures all page content renders below the navbar
 * - Single source of truth for parent page layout
 */
export const ParentLayout: React.FC<ParentLayoutProps> = ({
  children,
  className,
}) => {
  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 w-full overflow-x-hidden">
      <Navigation />
      <main
        className={cn(
          "w-full",
          // Use CSS variable set by Navigation component, fallback to 56px
          "pt-[var(--kch-topnav-h,56px)]",
          className
        )}
      >
        {children}
      </main>
    </div>
  );
};





