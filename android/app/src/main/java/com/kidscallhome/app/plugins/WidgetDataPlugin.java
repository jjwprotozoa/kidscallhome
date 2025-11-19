// android/app/src/main/java/com/kidscallhome/app/plugins/WidgetDataPlugin.java
// Capacitor plugin for syncing widget data to Android SharedPreferences
// Purpose: Bridge between React app and native Android widget data storage

package com.kidscallhome.app.plugins;

import android.content.Context;
import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.kidscallhome.app.widgets.KidsCallHomeWidgetProvider;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "WidgetData")
public class WidgetDataPlugin extends Plugin {

    @PluginMethod
    public void syncWidgetData(PluginCall call) {
        try {
            JSObject data = call.getData();
            
            // Extract widget data from JSObject
            String childId = data.getString("childId");
            String childName = data.getString("childName", "Call Home");
            String childAvatarColor = data.getString("childAvatarColor", "#3B82F6");
            int unreadCount = data.getInteger("unreadCount", 0);
            String lastCallTime = data.getString("lastCallTime");

            // Create WidgetData object
            KidsCallHomeWidgetProvider.WidgetData widgetData = 
                new KidsCallHomeWidgetProvider.WidgetData(
                    childId,
                    childName,
                    childAvatarColor,
                    unreadCount,
                    lastCallTime
                );

            // Store in SharedPreferences via widget provider
            KidsCallHomeWidgetProvider.storeWidgetData(getContext(), widgetData);

            // Trigger widget update
            Intent updateIntent = new Intent(KidsCallHomeWidgetProvider.ACTION_UPDATE_WIDGET);
            getContext().sendBroadcast(updateIntent);

            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to sync widget data: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void updateWidget(PluginCall call) {
        try {
            // Trigger widget update
            Intent updateIntent = new Intent(KidsCallHomeWidgetProvider.ACTION_UPDATE_WIDGET);
            getContext().sendBroadcast(updateIntent);

            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to update widget: " + e.getMessage(), e);
        }
    }
}

