// src/utils/widgetData.ts
// Widget data utilities for Android home screen widget
// Purpose: Fetch and prepare data for widget display (last-called child, unread counts)

import { supabase } from "@/integrations/supabase/client";

export interface WidgetData {
  childId: string | null;
  childName: string;
  childAvatarColor: string;
  unreadCount: number;
  lastCallTime: string | null;
}

/**
 * Fetch widget data for parent user
 * Returns data for the last-called child, or first child if no calls exist
 */
export async function fetchWidgetData(): Promise<WidgetData | null> {
  try {
    // Check if user is authenticated (parent)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      return null;
    }

    const parentId = session.user.id;

    // Get all children for this parent
    const { data: children, error: childrenError } = await supabase
      .from("children")
      .select("id, name, avatar_color")
      .eq("parent_id", parentId)
      .order("created_at", { ascending: false });

    if (childrenError) {
      console.error("Error fetching children for widget:", childrenError);
      return null;
    }

    if (!children || children.length === 0) {
      return null;
    }

    // Find the last-called child (most recent call)
    const { data: lastCall, error: callError } = await supabase
      .from("calls")
      .select("child_id, created_at")
      .eq("parent_id", parentId)
      .in("status", ["ringing", "active", "ended"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (callError) {
      console.error("Error fetching last call for widget:", callError);
      // Continue with first child as fallback
    }

    // Determine which child to show
    let selectedChild = children[0]; // Default to first child
    if (lastCall) {
      const lastCalledChild = children.find((c) => c.id === lastCall.child_id);
      if (lastCalledChild) {
        selectedChild = lastCalledChild;
      }
    }

    // Get unread message count for selected child
    const { count: unreadCount, error: unreadError } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("child_id", selectedChild.id)
      .eq("sender_type", "child")
      .is("read_at", null);

    if (unreadError) {
      console.error("Error fetching unread count for widget:", unreadError);
    }

    return {
      childId: selectedChild.id,
      childName: selectedChild.name,
      childAvatarColor: selectedChild.avatar_color || "#3B82F6",
      unreadCount: unreadCount || 0,
      lastCallTime: lastCall?.created_at || null,
    };
  } catch (error) {
    console.error("Error fetching widget data:", error);
    return null;
  }
}

/**
 * Store widget data in localStorage (for web) and prepare for native storage
 */
export function storeWidgetData(data: WidgetData | null): void {
  // Check if localStorage is available
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  
  if (!data) {
    localStorage.removeItem("widget_data");
    return;
  }

  const widgetData = {
    ...data,
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem("widget_data", JSON.stringify(widgetData));
  
  // Dispatch event for native Android to pick up
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("widgetDataUpdated", { detail: widgetData })
    );
  }
}

/**
 * Load widget data from localStorage
 */
export function loadWidgetData(): WidgetData | null {
  try {
    const stored = localStorage.getItem("widget_data");
    if (!stored) {
      return null;
    }

    const data = JSON.parse(stored);
    // Remove metadata fields
    const { updatedAt, ...widgetData } = data;
    return widgetData as WidgetData;
  } catch (error) {
    console.error("Error loading widget data:", error);
    return null;
  }
}

