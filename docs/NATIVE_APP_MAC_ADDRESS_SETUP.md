# Native App MAC Address Setup Guide

## Overview

This guide explains how to set up MAC address tracking for native Android and iOS apps. The system automatically attempts to retrieve MAC addresses for native apps, with fallback to device IDs or browser fingerprinting.

## Platform Support

### Android
- ✅ **MAC Address**: Available via custom native plugin (requires Android 6.0+ permissions)
- ✅ **Device ID**: Available via Capacitor Device plugin
- ✅ **Android ID**: More reliable than MAC address (persists across factory resets)

### iOS
- ❌ **MAC Address**: **BLOCKED** by Apple (deprecated since iOS 7)
- ✅ **Device ID**: Available via Capacitor Device plugin (IdentifierForVendor)
- ✅ **Device ID**: Persists across app reinstalls

## Implementation Priority

The system uses the following priority order for device identification:

1. **MAC Address** (Android only, if available)
2. **Native Device ID** (Capacitor/Cordova device ID)
3. **Browser Fingerprinting** (fallback for PWA or if native methods fail)

## Setup Instructions

### Step 1: Install Capacitor (if not already installed)

```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android
npm install @capacitor/device
npx cap init
```

### Step 2: Create Custom MAC Address Plugin (Android)

Since standard Capacitor plugins don't expose MAC addresses, you'll need a custom plugin for Android.

#### Option A: Use Capacitor Plugin Generator

```bash
npm install -g @capacitor/cli
npx @capacitor/plugin generate
# Follow prompts:
# - Plugin name: mac-address
# - Package ID: com.kidscallhome.macaddress
# - Class name: MacAddress
```

#### Option B: Manual Plugin Creation

Create the following files:

**`src/capacitor-plugins/mac-address/src/MacAddressPlugin.ts`**
```typescript
import { registerPlugin } from '@capacitor/core';

export interface MacAddressPlugin {
  getMacAddress(): Promise<{ macAddress: string | null }>;
}

const MacAddress = registerPlugin<MacAddressPlugin>('MacAddress', {
  web: () => import('./web').then(m => new m.MacAddressWeb()),
});

export * from './definitions';
export { MacAddress };
```

**`src/capacitor-plugins/mac-address/src/web.ts`**
```typescript
import { WebPlugin } from '@capacitor/core';
import type { MacAddressPlugin } from './definitions';

export class MacAddressWeb extends WebPlugin implements MacAddressPlugin {
  async getMacAddress(): Promise<{ macAddress: string | null }> {
    // MAC address not available in web browsers
    return { macAddress: null };
  }
}
```

**`src/capacitor-plugins/mac-address/android/src/main/java/com/kidscallhome/macaddress/MacAddressPlugin.java`**
```java
package com.kidscallhome.macaddress;

import android.net.wifi.WifiManager;
import android.net.wifi.WifiInfo;
import android.content.Context;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "MacAddress")
public class MacAddressPlugin extends Plugin {

    @PluginMethod
    public void getMacAddress(PluginCall call) {
        try {
            WifiManager wifiManager = (WifiManager) getContext().getSystemService(Context.WIFI_SERVICE);
            WifiInfo wifiInfo = wifiManager.getConnectionInfo();
            String macAddress = wifiInfo.getMacAddress();
            
            JSObject ret = new JSObject();
            if (macAddress != null && !macAddress.equals("02:00:00:00:00:00")) {
                // Android 6.0+ returns randomized MAC, check if it's real
                ret.put("macAddress", macAddress);
            } else {
                ret.put("macAddress", null);
            }
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to get MAC address", e);
        }
    }
}
```

**`src/capacitor-plugins/mac-address/android/src/main/AndroidManifest.xml`**
```xml
<manifest>
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
</manifest>
```

### Step 3: Register Plugin in Capacitor Config

**`capacitor.config.ts`**
```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kidscallhome.app',
  appName: 'Kids Call Home',
  webDir: 'dist',
  plugins: {
    Device: {
      // Device plugin configuration
    },
  },
};

export default config;
```

### Step 4: Update TypeScript Code

The code is already set up to use the MAC address plugin. Update `src/utils/deviceTracking.ts` to use your custom plugin:

```typescript
// In getMacAddress() function, add:
if (typeof window !== 'undefined' && (window as any).Capacitor?.Plugins?.MacAddress) {
  try {
    const result = await (window as any).Capacitor.Plugins.MacAddress.getMacAddress();
    if (result?.macAddress) {
      return result.macAddress;
    }
  } catch (e) {
    console.warn("MAC address not available:", e);
  }
}
```

### Step 5: Sync Capacitor

```bash
npx cap sync android
```

### Step 6: Build and Test

```bash
npm run build
npx cap open android
```

## Android MAC Address Limitations

### Android 6.0+ (API 23+)
- **Randomized MAC**: Android 6.0+ randomizes MAC addresses for privacy
- **WiFi MAC**: May return `02:00:00:00:00:00` (randomized)
- **Real MAC**: Requires root access or special permissions

### Recommended Approach
Instead of relying on MAC address, use:
1. **Android ID** (via Device plugin) - More reliable
2. **Device ID** (via Device plugin) - Unique per device
3. **Combination**: MAC address + Device ID for better tracking

## iOS Setup

### iOS Limitations
- **MAC Address**: Completely blocked by Apple (deprecated since iOS 7)
- **Alternative**: Use IdentifierForVendor (via Capacitor Device plugin)

### iOS Setup Steps

```bash
npm install @capacitor/ios
npx cap add ios
npx cap sync ios
npx cap open ios
```

The system will automatically use IdentifierForVendor instead of MAC address on iOS.

## Testing

### Test MAC Address Retrieval

1. **Build the app**:
   ```bash
   npm run build
   npx cap sync android
   ```

2. **Run on device** (MAC address requires physical device, not emulator)

3. **Check logs**:
   - Look for `mac_address` in device tracking logs
   - Check database `devices.mac_address` column

### Expected Behavior

- **Android (with plugin)**: Should return MAC address or `null` if unavailable
- **iOS**: Will always return `null` for MAC, but use Device ID
- **PWA/Web**: Will always return `null` for MAC, use browser fingerprinting

## Database Schema

The `devices` table includes:
- `mac_address` TEXT (nullable) - Stores MAC address if available
- `device_identifier` TEXT - Primary identifier (MAC, Device ID, or fingerprint)

## Troubleshooting

### MAC Address Returns Null

1. **Check permissions**: Ensure `ACCESS_WIFI_STATE` permission is granted
2. **Android version**: Android 6.0+ randomizes MAC addresses
3. **Physical device**: Emulators may not have real MAC addresses
4. **Plugin registration**: Verify plugin is properly registered

### Plugin Not Found

1. **Sync Capacitor**: Run `npx cap sync android`
2. **Check imports**: Verify plugin is imported correctly
3. **Rebuild**: Clean and rebuild the Android project

### iOS Always Returns Null

This is **expected behavior**. iOS blocks MAC address access. The system will use Device ID instead.

## Alternative: Use Android ID Instead

If MAC address proves unreliable, you can modify the code to prioritize Android ID:

```typescript
// In generateDeviceIdentifierAsync()
// Try Android ID first (more reliable than MAC)
const deviceId = await getNativeDeviceId();
if (deviceId) {
  return deviceId; // Use device ID instead of MAC
}
```

## Security Considerations

1. **Privacy**: MAC addresses are considered sensitive data
2. **GDPR**: Ensure compliance with data protection regulations
3. **Storage**: MAC addresses are stored encrypted in the database
4. **Access**: Only parents can view their own device MAC addresses

## Next Steps

1. ✅ Install Capacitor and plugins
2. ✅ Create custom MAC address plugin (Android)
3. ✅ Test on physical Android device
4. ✅ Verify MAC address appears in database
5. ✅ Set up iOS app (will use Device ID instead)

## References

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Capacitor Device Plugin](https://capacitorjs.com/docs/apis/device)
- [Android MAC Address Limitations](https://developer.android.com/about/versions/marshmallow/android-6.0-changes#behavior-hardware-id)
- [iOS IdentifierForVendor](https://developer.apple.com/documentation/uikit/uidevice/1620059-identifierforvendor)

