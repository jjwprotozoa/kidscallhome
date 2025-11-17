# Native App Device Tracking

## Overview

The device tracking system is designed to work seamlessly across:
- **PWA (Progressive Web App)**: Uses browser fingerprinting
- **Native App Wrappers** (iOS/Android): Uses MAC address (Android) or device IDs when available

## Device Identification Methods

### PWA (Web Browser)
- **Method**: Browser fingerprinting
- **Identifier Format**: `web-{hash}` (e.g., `web-x8jclu`)
- **Characteristics Used**:
  - User agent
  - Screen resolution & color depth
  - Canvas fingerprinting
  - Hardware concurrency & memory
  - Platform & language
  - Touch capabilities
  - Device pixel ratio

**Note**: MAC addresses are not accessible from web browsers due to security/privacy restrictions. Browser fingerprinting is the industry standard for web apps.

### Native Apps (iOS/Android)

#### Priority Order:
1. **MAC Address** (Android only, if available) - Format: `mac-{macaddress}`
2. **Native Device ID** (Capacitor/Cordova) - Format: `native-{deviceId}` or `cordova-{uuid}`
3. **Browser Fingerprinting** (fallback)

#### Android
- **MAC Address**: Available via custom Capacitor plugin (see `NATIVE_APP_MAC_ADDRESS_SETUP.md`)
- **Device ID**: Available via `@capacitor/device` plugin
- **Note**: Android 6.0+ randomizes MAC addresses for privacy

#### iOS
- **MAC Address**: **BLOCKED** by Apple (deprecated since iOS 7)
- **Device ID**: Available via `@capacitor/device` plugin (IdentifierForVendor)
- **Fallback**: Uses Device ID instead of MAC address

#### Supported Frameworks:
- **Capacitor**: Uses `@capacitor/device` plugin + custom MAC address plugin (Android)
- **Cordova**: Uses `cordova-plugin-device`
- **React Native**: Can inject device ID/MAC via WebView messaging

## Implementation

### Device Tracking Function

The system automatically detects the environment and uses the appropriate method:

```typescript
// For device tracking (database) - uses async version
const deviceIdentifier = await generateDeviceIdentifierAsync();

// For device authorization (localStorage) - uses sync version
const deviceId = generateDeviceIdentifier();
```

### Native App Setup

#### Capacitor

1. Install Capacitor Device plugin:
   ```bash
   npm install @capacitor/device
   npx cap sync
   ```

2. The system will automatically detect Capacitor and use device ID

#### Cordova

1. Install Cordova Device plugin:
   ```bash
   cordova plugin add cordova-plugin-device
   ```

2. The system will automatically detect Cordova and use device UUID

#### React Native

For React Native WebView, inject device ID via postMessage:

```javascript
// In React Native code
import DeviceInfo from 'react-native-device-info';

const deviceId = await DeviceInfo.getUniqueId();

// Inject into WebView
webViewRef.current.postMessage(JSON.stringify({
  type: 'DEVICE_ID',
  deviceId: deviceId
}));
```

Then update `deviceTracking.ts` to listen for this message.

## Device Authorization

Device authorization (for skipping family code) uses synchronous fingerprinting:
- Works immediately without async delays
- Consistent across page loads
- Works in both PWA and native wrappers

## Benefits of Native Device IDs

When wrapped as native apps:
- **More Stable**: Device ID persists across app reinstalls (iOS) or factory resets (Android)
- **More Accurate**: True device identifier vs browser fingerprint
- **Better Security**: Can't be spoofed as easily as browser fingerprinting
- **Cross-Browser**: Same device ID regardless of browser used in WebView

## Migration Path

When wrapping the PWA:
1. Install native device plugin (Capacitor/Cordova)
2. System automatically detects and uses native ID
3. Existing browser fingerprints continue to work
4. New devices will use native IDs when available

## Testing

- **PWA**: Test in browser - should use `web-{hash}` format
- **Android Native**: Test on physical device - should use `mac-{macaddress}` format (if plugin installed) or `native-{id}`
- **iOS Native**: Test on device - should use `native-{id}` format (MAC address blocked)
- **Device Management**: All formats appear in parent's device list with MAC address stored separately

## MAC Address Support

See `NATIVE_APP_MAC_ADDRESS_SETUP.md` for detailed setup instructions for Android MAC address tracking.

**Quick Summary**:
- ✅ Android: MAC address available via custom plugin
- ❌ iOS: MAC address blocked, uses Device ID instead
- ❌ Web/PWA: MAC address not accessible, uses browser fingerprinting

