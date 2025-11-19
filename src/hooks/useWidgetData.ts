// src/hooks/useWidgetData.ts
// Hook to fetch and update widget data for Android home screen widget
// Purpose: Automatically updates widget data when app is active

import { useEffect, useRef } from "react";
import { fetchWidgetData, storeWidgetData } from "@/utils/widgetData";
import { isNativeAndroid, syncWidgetDataToNative } from "@/utils/nativeAndroid";
import { useBadgeStore } from "@/stores/badgeStore";

/**
 * Hook to manage widget data updates
 * Fetches data from Supabase and stores it for widget access
 */
export function useWidgetData() {
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const unreadByChild = useBadgeStore((s) => s.unreadMessagesByChild);

  useEffect(() => {
    if (!isNativeAndroid()) {
      return; // Only run on native Android
    }

    const updateWidgetData = async () => {
      try {
        const widgetData = await fetchWidgetData();
        
        if (widgetData) {
          // Update unread count from badge store (more accurate, real-time)
          const storeUnreadCount = unreadByChild[widgetData.childId] || 0;
          widgetData.unreadCount = storeUnreadCount;
          
          // Store in localStorage (for web fallback)
          storeWidgetData(widgetData);
          
          // Sync to native Android SharedPreferences
          await syncWidgetDataToNative(widgetData);
          
          // Trigger widget update via BroadcastReceiver
          // This requires a Capacitor plugin to send broadcast
          // For now, widget will read from SharedPreferences on next update
        }
      } catch (error) {
        console.error("Error updating widget data:", error);
      }
    };

    // Initial update
    updateWidgetData();

    // Update every 5 minutes when app is active
    updateIntervalRef.current = setInterval(updateWidgetData, 5 * 60 * 1000);

    // Also update when badge counts change
    const handleBadgeUpdate = () => {
      updateWidgetData();
    };

    // Listen for badge store updates
    const unsubscribe = useBadgeStore.subscribe(
      (state) => state.unreadMessagesByChild,
      handleBadgeUpdate
    );

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
      unsubscribe();
    };
  }, [unreadByChild]);
}

