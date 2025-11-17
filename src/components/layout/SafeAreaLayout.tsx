// src/components/layout/SafeAreaLayout.tsx
// Reusable safe-area layout wrapper component for device-agnostic safe-area support

import React from "react";
import { cn } from "@/lib/utils";

interface SafeAreaLayoutProps {
  children: React.ReactNode;
  className?: string;
  withTopInset?: boolean;
  withBottomInset?: boolean;
}

export const SafeAreaLayout: React.FC<SafeAreaLayoutProps> = ({
  children,
  className,
  withTopInset = true,
  withBottomInset = true,
}) => {
  return (
    <div
      className={cn(
        "safe-area-layout min-h-[100dvh] w-full overflow-x-hidden", // 100dvh avoids iOS 100vh bugs, prevent horizontal scroll
        {
          "safe-area-top": withTopInset,
          "safe-area-bottom": withBottomInset,
        },
        className
      )}
    >
      {children}
    </div>
  );
};

