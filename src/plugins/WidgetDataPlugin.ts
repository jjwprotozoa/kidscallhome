// src/plugins/WidgetDataPlugin.ts
// Capacitor plugin for syncing widget data to Android SharedPreferences
// Purpose: Bridge between React app and native Android widget data storage

import { registerPlugin } from '@capacitor/core';

export interface WidgetDataPlugin {
  /**
   * Sync widget data to Android SharedPreferences
   * This allows the widget to read real-time data even when app is closed
   */
  syncWidgetData(data: {
    childId: string | null;
    childName: string;
    childAvatarColor: string;
    unreadCount: number;
    lastCallTime: string | null;
  }): Promise<{ success: boolean }>;
  
  /**
   * Trigger widget update after data sync
   */
  updateWidget(): Promise<{ success: boolean }>;
}

const WidgetDataPlugin = registerPlugin<WidgetDataPlugin>('WidgetData', {
  web: () => import('./WidgetDataPluginWeb').then(m => new m.WidgetDataPluginWeb()),
});

export { WidgetDataPlugin };

