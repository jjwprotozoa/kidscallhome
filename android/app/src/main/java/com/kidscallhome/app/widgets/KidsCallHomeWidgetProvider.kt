// android/app/src/main/java/com/kidscallhome/app/widgets/KidsCallHomeWidgetProvider.kt
// Android home screen widget provider
// Purpose: Handles widget updates and click actions for KidsCallHome widget

package com.kidscallhome.app.widgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.Color
import android.os.Build
import android.widget.RemoteViews
import com.kidscallhome.app.MainActivity
import com.kidscallhome.app.R
import org.json.JSONObject

class KidsCallHomeWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)

        // Handle custom broadcast to update widget
        if (intent.action == ACTION_UPDATE_WIDGET) {
            updateAllWidgets(context)
        }
    }

    companion object {
        const val ACTION_UPDATE_WIDGET = "com.kidscallhome.app.UPDATE_WIDGET"
        private const val PREFS_NAME = "widget_prefs"
        private const val KEY_WIDGET_DATA = "widget_data"

        /**
         * Load widget data from SharedPreferences
         * Data is stored by React app via localStorage sync
         */
        private fun loadWidgetData(context: Context): WidgetData? {
            return try {
                val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                val jsonString = prefs.getString(KEY_WIDGET_DATA, null)
                
                if (jsonString == null) {
                    return null
                }

                val json = JSONObject(jsonString)
                WidgetData(
                    childId = json.optString("childId", null).takeIf { it.isNotEmpty() },
                    childName = json.optString("childName", "Call Home"),
                    childAvatarColor = json.optString("childAvatarColor", "#3B82F6"),
                    unreadCount = json.optInt("unreadCount", 0),
                    lastCallTime = json.optString("lastCallTime", null).takeIf { it.isNotEmpty() }
                )
            } catch (e: Exception) {
                android.util.Log.e("WidgetProvider", "Error loading widget data", e)
                null
            }
        }

        /**
         * Store widget data to SharedPreferences
         * Called from React app via Capacitor bridge or BroadcastReceiver
         */
        fun storeWidgetData(context: Context, data: WidgetData) {
            try {
                val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                val json = JSONObject().apply {
                    put("childId", data.childId ?: "")
                    put("childName", data.childName)
                    put("childAvatarColor", data.childAvatarColor)
                    put("unreadCount", data.unreadCount)
                    put("lastCallTime", data.lastCallTime ?: "")
                    put("updatedAt", System.currentTimeMillis())
                }
                prefs.edit().putString(KEY_WIDGET_DATA, json.toString()).apply()
            } catch (e: Exception) {
                android.util.Log.e("WidgetProvider", "Error storing widget data", e)
            }
        }

        data class WidgetData(
            val childId: String?,
            val childName: String,
            val childAvatarColor: String,
            val unreadCount: Int,
            val lastCallTime: String?
        )

        fun updateAppWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            val views = RemoteViews(context.packageName, R.layout.widget_kids_call_home)

            // Load real data from SharedPreferences
            val widgetData = loadWidgetData(context)
            
            val childName = widgetData?.childName ?: "Call Home"
            val subtitle = if (widgetData?.lastCallTime != null) {
                "Tap to call ${childName}"
            } else {
                "Tap to start a call"
            }
            val unreadCount = widgetData?.unreadCount ?: 0

            views.setTextViewText(R.id.text_child_name, childName)
            views.setTextViewText(R.id.text_subtitle, subtitle)

            // Set avatar background color if available
            if (widgetData != null) {
                try {
                    val color = Color.parseColor(widgetData.childAvatarColor)
                    views.setInt(R.id.image_child_avatar, "setColorFilter", color)
                } catch (e: Exception) {
                    // Invalid color, use default
                }
            }

            // Show/hide unread badge
            if (unreadCount > 0) {
                views.setTextViewText(R.id.text_unread_badge, unreadCount.toString())
                views.setViewVisibility(R.id.text_unread_badge, android.view.View.VISIBLE)
            } else {
                views.setViewVisibility(R.id.text_unread_badge, android.view.View.GONE)
            }

            // Intent to open app and route to "quick call" screen
            // Include childId in URI if available for direct routing
            val uriString = if (widgetData?.childId != null) {
                "kidscallhome://widget?fromWidget=true&widgetAction=quick_call&childId=${widgetData.childId}"
            } else {
                "kidscallhome://widget?fromWidget=true&widgetAction=quick_call"
            }

            val launchIntent = Intent(context, MainActivity::class.java).apply {
                action = Intent.ACTION_VIEW
                data = android.net.Uri.parse(uriString)
                putExtra("fromWidget", true)
                putExtra("widgetAction", "quick_call")
                if (widgetData?.childId != null) {
                    putExtra("childId", widgetData.childId)
                }
            }

            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }

            val pendingIntent = PendingIntent.getActivity(
                context,
                appWidgetId,
                launchIntent,
                flags
            )

            // Tap anywhere on the widget root to trigger call routing in app
            views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }

        fun updateAllWidgets(context: Context) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val componentName = ComponentName(context, KidsCallHomeWidgetProvider::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)
            for (id in appWidgetIds) {
                updateAppWidget(context, appWidgetManager, id)
            }
        }
    }
}

