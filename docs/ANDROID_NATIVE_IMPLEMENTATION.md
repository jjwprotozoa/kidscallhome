# Android Native Implementation Guide

## Overview

This document describes the native Android features added to KidsCallHome for Play Store submission. All features are **additive enhancements** that wrap existing React components without modifying core call or messaging logic.

## Architecture

The native Android implementation uses **Capacitor** as a bridge between the React web app and native Android APIs. This approach:

- ✅ Preserves all existing web app functionality
- ✅ Adds native Android features (notifications, widgets, shortcuts)
- ✅ Maintains separation between web and native code
- ✅ Does NOT modify protected call engine (`src/features/calls/`)

## Components Added

### 1. Native Android Utilities (`src/utils/nativeAndroid.ts`)

Provides wrappers for Capacitor plugins:
- Platform detection (`isNativeAndroid()`, `isNativePlatform()`)
- Vibration patterns (`vibrate()`, `vibratePattern()`)
- Push notifications (`showIncomingCallNotification()`, `showMessageNotification()`)
- Initialization (`initializeNativeAndroid()`)

### 2. Android Incoming Call Component (`src/components/native/AndroidIncomingCall.tsx`)

Enhances existing `GlobalIncomingCall` component with:
- Native Android CallStyle notifications (Android 11+)
- Vibration patterns for incoming calls
- High-priority notifications with accept/decline actions
- Fullscreen call UI support

**Integration**: Automatically wraps `GlobalIncomingCall` when running on Android.

### 3. Android Notification Wrapper (`src/components/native/AndroidNotificationWrapper.tsx`)

Enhances message notifications with:
- Native Android high-priority notifications
- Vibration feedback
- Deep linking support

## Android-Specific Features

### 1. Incoming Call UI

**Implementation**: Uses Android's `CallStyle` notification template (Android 11+) for native fullscreen call UI.

**Features**:
- Fullscreen incoming call interface
- Vibration patterns (`[200, 100, 200, 100, 200]`)
- Ringtone playback (via existing `useAudioNotifications` hook)
- Accept/Decline actions in notification

**Files**:
- `src/components/native/AndroidIncomingCall.tsx`
- `src/utils/nativeAndroid.ts` (notification functions)

### 2. High-Priority Notifications

**Implementation**: Uses Capacitor `@capacitor/push-notifications` and `@capacitor/local-notifications` plugins.

**Features**:
- High-priority call notifications with accept/decline actions
- Message notifications with vibration
- Deep linking to app routes

**Files**:
- `src/utils/nativeAndroid.ts` (`showIncomingCallNotification()`, `showMessageNotification()`)

### 3. Home Screen Widget

**Implementation**: Android App Widget API.

**Features**:
- One-tap "Call Home" button
- Shows last contact information
- Launches app to call screen

**Files**:
- `android/app/src/main/res/xml/widget_info.xml`
- `android/app/src/main/res/layout/widget_layout.xml`
- `android/app/src/main/res/values/strings.xml`

**Note**: Widget implementation requires native Android code in `MainActivity.java` (to be added during Capacitor sync).

### 4. App Icon Quick Actions

**Implementation**: Android App Shortcuts API.

**Features**:
- "Start Call" - Opens parent dashboard
- "Open Info" - Opens info/compliance page
- "Add Kid" - Opens children management page

**Files**:
- `android/app/src/main/res/xml/shortcuts.xml`
- `android/app/src/main/res/values/strings.xml`

**Usage**: Long-press app icon to see shortcuts.

## Build Configuration

### Codemagic CI/CD (`codemagic.yaml`)

**Features**:
- Automated Android App Bundle (AAB) builds
- Keystore signing configuration
- Optional Play Store publishing
- Environment variable management

**Setup**:
1. Add keystore credentials to Codemagic UI (environment variables)
2. Configure `android_keystore` group with:
   - `KEYSTORE_PASSWORD`
   - `KEY_ALIAS`
   - `KEY_PASSWORD`
3. Optionally add `google_play` group for Play Store publishing

### Capacitor Configuration (`capacitor.config.ts`)

**Settings**:
- App ID: `com.kidscallhome.app`
- App Name: `Kids Call Home`
- Web Directory: `dist`
- Android scheme: `https`
- Plugin configurations (SplashScreen, PushNotifications, LocalNotifications)

## Installation & Setup

### 1. Install Dependencies

```bash
npm install
```

This installs all Capacitor plugins:
- `@capacitor/core`
- `@capacitor/android`
- `@capacitor/app`
- `@capacitor/haptics`
- `@capacitor/push-notifications`
- `@capacitor/local-notifications`
- `@capacitor/device`

### 2. Build Web App

```bash
npm run build
```

### 3. Sync Capacitor

```bash
npm run cap:sync
```

This:
- Copies `dist/` to Android project
- Syncs plugin configurations
- Updates Android manifest

### 4. Open Android Studio

```bash
npm run cap:android
```

### 5. Build & Test

In Android Studio:
- Build → Build Bundle(s) / APK(s)
- Run on device/emulator

## Android Manifest Requirements

The following permissions are automatically added by Capacitor plugins:

```xml
<!-- Push Notifications -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

<!-- Vibration -->
<uses-permission android:name="android.permission.VIBRATE" />

<!-- Widget -->
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
```

## Testing Checklist

### Incoming Call UI
- [ ] Incoming call shows fullscreen notification (Android 11+)
- [ ] Vibration pattern plays correctly
- [ ] Ringtone plays
- [ ] Accept button navigates to call screen
- [ ] Decline button ends call

### Notifications
- [ ] Push notification permission requested on first launch
- [ ] Call notifications show with accept/decline actions
- [ ] Message notifications show correctly
- [ ] Notifications deep link to correct routes

### Widget
- [ ] Widget appears in widget picker
- [ ] Widget displays "Call Home" button
- [ ] Tapping widget launches app
- [ ] Widget updates correctly

### App Shortcuts
- [ ] Long-press app icon shows shortcuts
- [ ] "Start Call" opens parent dashboard
- [ ] "Open Info" opens info page
- [ ] "Add Kid" opens children list

### Compliance Pages
- [ ] `/info` page loads correctly
- [ ] All compliance content displays
- [ ] Links work correctly
- [ ] Mobile responsive layout works

## Protected Areas

The following areas were **NOT modified**:

- ✅ `src/features/calls/` - Call engine remains untouched
- ✅ `src/components/layout/SafeAreaLayout.tsx` - Safe area layout unchanged
- ✅ `src/index.css` - Safe area CSS variables unchanged
- ✅ Core authentication, subscription, device management logic unchanged

## Files Changed/Added

### New Files
- `codemagic.yaml` - CI/CD configuration
- `capacitor.config.ts` - Capacitor configuration
- `src/utils/nativeAndroid.ts` - Native Android utilities
- `src/components/native/AndroidIncomingCall.tsx` - Android call UI wrapper
- `src/components/native/AndroidNotificationWrapper.tsx` - Notification wrapper
- `android/app/src/main/res/xml/shortcuts.xml` - App shortcuts config
- `android/app/src/main/res/xml/widget_info.xml` - Widget config
- `android/app/src/main/res/layout/widget_layout.xml` - Widget layout
- `android/app/src/main/res/values/strings.xml` - String resources
- `docs/ANDROID_NATIVE_IMPLEMENTATION.md` - This file

### Modified Files
- `package.json` - Added Capacitor dependencies and scripts
- `src/App.tsx` - Added native Android initialization
- `src/components/GlobalIncomingCall.tsx` - Integrated Android call wrapper

## Next Steps

1. **Install Capacitor**: Run `npm install` to install dependencies
2. **Build Web App**: Run `npm run build`
3. **Sync Capacitor**: Run `npm run cap:sync`
4. **Open Android Studio**: Run `npm run cap:android`
5. **Configure Keystore**: Set up signing in Android Studio or Codemagic
6. **Test on Device**: Build and test all features
7. **Configure Codemagic**: Add keystore credentials and set up CI/CD
8. **Submit to Play Store**: Use Codemagic to build and publish AAB

## References

- [Codemagic Android Guide](https://docs.codemagic.io/yaml-quick-start/building-a-native-android-app/)
- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Android CallStyle Notifications](https://developer.android.com/develop/ui/views/notifications/call-style)
- [Android App Widgets](https://developer.android.com/develop/ui/views/appwidgets)
- [Android App Shortcuts](https://developer.android.com/develop/ui/views/shortcuts)

