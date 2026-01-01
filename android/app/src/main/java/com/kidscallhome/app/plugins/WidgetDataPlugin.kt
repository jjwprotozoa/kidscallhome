// android/app/src/main/java/com/kidscallhome/app/plugins/WidgetDataPlugin.kt
// Capacitor plugin for syncing widget data to Android SharedPreferences
// Purpose: Bridge between React app and native Android widget data storage

package com.kidscallhome.app.plugins

import android.content.Intent
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.kidscallhome.app.widgets.KidsCallHomeWidgetProvider

@CapacitorPlugin(name = "WidgetData")
class WidgetDataPlugin : Plugin() {

    @PluginMethod
    fun syncWidgetData(call: PluginCall) {
        try {
            val data = call.data

            // Extract widget data from JSObject
            val childId = data.getString("childId")
            val childName = data.getString("childName", "Call Home") ?: "Call Home"
            val childAvatarColor = data.getString("childAvatarColor", "#3B82F6") ?: "#3B82F6"
            val unreadCount = data.getInt("unreadCount", 0)
            val lastCallTime = data.getString("lastCallTime")

            // Create WidgetData object
            val widgetData = KidsCallHomeWidgetProvider.Companion.WidgetData(
                childId = childId,
                childName = childName,
                childAvatarColor = childAvatarColor,
                unreadCount = unreadCount,
                lastCallTime = lastCallTime
            )

            // Store in SharedPreferences via widget provider
            KidsCallHomeWidgetProvider.storeWidgetData(context, widgetData)

            // Trigger widget update
            val updateIntent = Intent(KidsCallHomeWidgetProvider.ACTION_UPDATE_WIDGET)
            context.sendBroadcast(updateIntent)

            val result = JSObject()
            result.put("success", true)
            call.resolve(result)
        } catch (e: Exception) {
            call.reject("Failed to sync widget data: ${e.message}", e)
        }
    }

    @PluginMethod
    fun updateWidget(call: PluginCall) {
        try {
            // Trigger widget update
            val updateIntent = Intent(KidsCallHomeWidgetProvider.ACTION_UPDATE_WIDGET)
            context.sendBroadcast(updateIntent)

            val result = JSObject()
            result.put("success", true)
            call.resolve(result)
        } catch (e: Exception) {
            call.reject("Failed to update widget: ${e.message}", e)
        }
    }
}

