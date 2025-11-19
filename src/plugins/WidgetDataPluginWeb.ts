// src/plugins/WidgetDataPluginWeb.ts
// Web implementation of WidgetDataPlugin (no-op for web)
// Purpose: Provides web fallback so plugin can be used in React code

import { WebPlugin } from '@capacitor/core';
import type { WidgetDataPlugin } from './WidgetDataPlugin';

export class WidgetDataPluginWeb extends WebPlugin implements WidgetDataPlugin {
  async syncWidgetData(): Promise<{ success: boolean }> {
    // Web fallback - data is already in localStorage
    return { success: true };
  }

  async updateWidget(): Promise<{ success: boolean }> {
    // Web fallback - widgets not supported on web
    return { success: true };
  }
}

