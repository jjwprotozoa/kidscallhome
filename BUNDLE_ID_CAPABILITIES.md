# Bundle ID Capabilities Configuration

## ✅ Required Capabilities for Kids Call Home

For your **Kids Call Home** video calling and messaging app, enable these capabilities:

### 1. **Push Notifications** ✅ **REQUIRED**

- **Enable**: ✅ Check this box
- **Why**: Essential for receiving call and message notifications when the app is closed
- **Used for**: Alerting users about incoming calls and new messages

### 2. **Associated Domains** ✅ **RECOMMENDED**

- **Enable**: ✅ Check this box
- **Why**: Allows deep linking (e.g., `kidscallhome://call/123`)
- **Used for**: Opening the app from links, better user experience
- **Note**: You'll need to configure domains later in Xcode

### 3. **Sign In with Apple** ⚠️ **OPTIONAL**

- **Enable**: Only if you plan to use Apple Sign In
- **Why**: Alternative login method for users
- **Used for**: User authentication
- **Note**: Requires additional configuration

### 4. **In-App Purchase** ⚠️ **OPTIONAL**

- **Enable**: Only if you have subscriptions/in-app purchases
- **Why**: For paid features or subscriptions
- **Used for**: Monetization features
- **Note**: Based on your code, you might have subscriptions - enable if needed

## ❌ Do NOT Enable (Not Needed)

**Do NOT enable these** - they're not needed for your app:

- ❌ Apple Pay / Apple Pay Later
- ❌ HealthKit
- ❌ HomeKit
- ❌ Game Center
- ❌ Maps
- ❌ NFC Tag Reading
- ❌ Wallet
- ❌ DriverKit (development only)
- ❌ Most other capabilities

## 📋 Minimum Configuration

**At minimum, enable:**

1. ✅ **Push Notifications** (REQUIRED)

**Recommended additions:** 2. ✅ **Associated Domains** (for deep linking)

**If you have subscriptions:** 3. ✅ **In-App Purchase**

## 🔧 Step-by-Step

1. **Platform**: Select **iOS** only ✅ (uncheck iPadOS, macOS, tvOS, watchOS, visionOS)

2. **App ID Prefix (Team ID)**: `786BYGA3LW` ✅ (auto-filled by Apple)

3. **Description**: `Kids Call Home iOS App` ✅ (already filled)

4. **Bundle ID**: `com.kidscallhome.app` (explicit) ✅ (already filled)

5. **Capabilities to Enable**:

   - Scroll down and find **Push Notifications**
   - ✅ Check the box next to **Push Notifications**
   - ✅ Check the box next to **Associated Domains** (recommended)
   - ✅ Check **In-App Purchase** (if you have subscriptions)
   - ❌ Skip **Sign In with Apple** (not needed for this app)

6. **Click Continue** → **Register**

## ⚠️ Important Notes

- **You can add capabilities later** - Don't worry if you miss something
- **Push Notifications is essential** - Make sure to enable this one
- **Capabilities can be modified** after registration if needed
- **Some capabilities require additional setup** in Xcode later

## 🎯 After Registration

Once registered:

1. Go back to the "New App" form
2. Refresh the Bundle ID dropdown
3. Select `com.kidscallhome.app`
4. Complete the app creation

## 📱 What Each Capability Does

| Capability             | Purpose                                  | Required?                    |
| ---------------------- | ---------------------------------------- | ---------------------------- |
| **Push Notifications** | Receive notifications when app is closed | ✅ YES                       |
| **Associated Domains** | Deep linking, universal links            | ⭐ Recommended               |
| **In-App Purchase**    | Subscriptions, paid features             | ⚠️ If you have subscriptions |
| **Sign In with Apple** | Apple authentication                     | ⚠️ Optional                  |
