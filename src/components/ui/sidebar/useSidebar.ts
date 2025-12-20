// src/components/ui/sidebar/useSidebar.ts
// Purpose: Sidebar state hook

import * as React from "react";
import { SidebarContext as SidebarContextType } from "./types";
import { SidebarContext } from "./SidebarProvider";

export function useSidebar(): SidebarContextType {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }
  return context;
}












