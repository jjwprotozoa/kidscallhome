# iOS Provisioning Profile Fix Guide

## Error Message

```
No matching profiles found for bundle identifier "com.kidscallhome.app" and distribution type "app_store"
```

## Root Cause

Codemagic cannot find a provisioning profile for your bundle identifier. This happens when:

1. The provisioning profile doesn't exist in Apple Developer Portal
2. The App Store Connect API key doesn't have permissions to create profiles automatically
3. The bundle identifier isn't registered in Apple Developer Portal
4. The certificate isn't set up correctly in Codemagic

## Solution Steps

### Step 1: Verify Bundle ID Exists in Apple Developer Portal

1. Go to [Apple Developer Portal](https://developer.apple.com/account/resources/identifiers/list/bundleId)
2. Search for `com.kidscallhome.app`
3. If it doesn't exist:
   - Click **+** to create new App ID
   - Description: `Kids Call Home`
   - Bundle ID: Select **Explicit** → Enter `com.kidscallhome.app`
   - Capabilities: Enable any needed (Push Notifications, etc.)
   - Click **Continue** → **Register**

### Step 2: Verify App Store Connect API Key Permissions

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to **Users and Access** → **Integrations** → **App Store Connect API**
3. Find your API key (named `codemagic` or your custom name)
4. Verify it has **App Manager** or **Admin** access level
   - **App Manager** can create provisioning profiles
   - **Developer** access cannot create profiles

### Step 3: Create Provisioning Profile Manually (If Automatic Creation Fails)

#### Option A: Create via Apple Developer Portal (Recommended)

1. Go to [Apple Developer Portal - Profiles](https://developer.apple.com/account/resources/profiles/list)
2. Click **+** to create new profile
3. Select **App Store** distribution type
4. Click **Continue**
5. Select App ID: **com.kidscallhome.app**
6. Click **Continue**
7. Select your **Apple Distribution** certificate
   - If you don't have one, generate it first:
     - Go to [Certificates](https://developer.apple.com/account/resources/certificates/list)
     - Click **+** → **Apple Distribution** → Follow steps
8. Enter Profile Name: `Kids Call Home App Store`
9. Click **Generate**
10. **Download the profile** (`.mobileprovision` file)

#### Option B: Let Codemagic Create Automatically

If your App Store Connect API key has **App Manager** or **Admin** access, Codemagic should create the profile automatically. The updated `codemagic.yaml` includes diagnostics to help identify issues.

### Step 4: Verify Certificate in Codemagic

1. Go to Codemagic → **Team Settings** → **Code signing identities** → **iOS certificates**
2. Verify you have an **Apple Distribution** certificate
3. If missing:
   - Click **Generate new certificate**
   - Type: **Apple Distribution**
   - Reference name: `ios_distribution` (or your preferred name)
   - Click **Generate**

### Step 5: Verify Bundle ID in Xcode Project

The updated `codemagic.yaml` automatically checks and fixes bundle identifier mismatches. If you're still having issues:

1. Open `ios/App/App.xcodeproj` in Xcode (or check `project.pbxproj`)
2. Verify `PRODUCT_BUNDLE_IDENTIFIER` is set to `com.kidscallhome.app`
3. If different, update it to match exactly

### Step 6: Re-run Build

After completing the above steps:

1. Commit and push your updated `codemagic.yaml`
2. Trigger a new build in Codemagic
3. Check the build logs for the "Verify bundle identifier" and "Set up provisioning profiles" steps
4. The diagnostics will show what's happening

## Diagnostic Output

The updated workflow will show:

```
=== Verifying Bundle Identifier ===
Expected Bundle ID: com.kidscallhome.app
Bundle ID in Info.plist: com.kidscallhome.app
✅ Bundle ID matches

=== Setting Up Provisioning Profiles ===
Bundle ID: com.kidscallhome.app
Distribution Type: app_store
```

If you see warnings or errors, follow the troubleshooting steps above.

## Quick Checklist

- [ ] Bundle ID `com.kidscallhome.app` exists in Apple Developer Portal
- [ ] App Store Connect API key has **App Manager** or **Admin** access
- [ ] **Apple Distribution** certificate exists in Codemagic Team Settings
- [ ] Provisioning profile exists (or Codemagic can create it automatically)
- [ ] Bundle ID in Xcode project matches `com.kidscallhome.app` exactly

## Still Having Issues?

If the error persists after completing all steps:

1. **Check Build Logs**: Look for specific error messages in the "Set up provisioning profiles" step
2. **Verify API Key**: Ensure the integration name in `codemagic.yaml` matches your API key name in Codemagic
3. **Manual Profile Upload**: If automatic creation fails, manually create and upload the profile to Codemagic
4. **Contact Support**: Codemagic support can help diagnose API key permission issues

## Related Documentation

- [Codemagic iOS Code Signing Guide](https://docs.codemagic.io/code-signing-yaml/signing-ios/)
- [Apple Developer Portal - App IDs](https://developer.apple.com/account/resources/identifiers/list/bundleId)
- [Apple Developer Portal - Provisioning Profiles](https://developer.apple.com/account/resources/profiles/list)




