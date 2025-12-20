# iOS Setup Guide for Kids Call Home

## Overview

This guide explains how to set up iOS deployment for the Kids Call Home Capacitor app using Codemagic CI/CD.

## Current Status

✅ **Completed:**
- Added `@capacitor/ios` package to `package.json`
- Updated `capacitor.config.ts` with iOS configuration
- Added iOS workflow to `codemagic.yaml`

❌ **Still Required:**
- Generate iOS native project
- Configure iOS permissions
- Set up code signing certificates
- Configure App Store Connect API key

## Step-by-Step Setup

### ✅ No MacBook Required!

The iOS project will be **automatically generated** in Codemagic during the build process. You don't need a MacBook or Xcode installed locally.

### 1. iOS Project Generation (Automatic)

The `codemagic.yaml` workflow automatically:
- ✅ Generates the iOS project if it doesn't exist (`npx cap add ios`)
- ✅ Configures iOS permissions in `Info.plist` automatically
- ✅ Syncs Capacitor to copy your web app into the iOS project
- ✅ Installs CocoaPods dependencies
- ✅ Builds the IPA file

**You don't need to do anything for this step** - it happens automatically in Codemagic!

### 2. iOS Permissions (Automatic Configuration)

The workflow automatically configures these permissions in `Info.plist`:

- **Camera**: For video calls
- **Microphone**: For audio in video calls
- **Photo Library**: For sharing photos
- **Notifications**: For call and message alerts

These are set automatically during the build, so no manual configuration needed!

### 3. Set Up Code Signing in Codemagic

#### 3.1 Create App Store Connect API Key

1. Log in to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to **Users and Access > Integrations > App Store Connect API**
3. Click **+** to generate a new API key
4. Enter name: "Codemagic CI/CD"
5. Select access level: **App Manager** (recommended)
6. Click **Generate**
7. **Download the `.p8` key file** (can only be downloaded once!)
8. Note the **Issuer ID** (above the keys table)
9. Note the **Key ID** (from the generated key)

#### 3.2 Add API Key to Codemagic

1. Open Codemagic Team settings
2. Go to **Team integrations > Developer Portal > Manage keys**
3. Click **Add key**
4. Enter:
   - **API key name**: `codemagic` (or your preferred name)
   - **Issuer ID**: (from step 3.1)
   - **Key ID**: (from step 3.1)
   - Upload the `.p8` file
5. Click **Save**

#### 3.3 Upload Code Signing Certificate

**Option A: Generate New Certificate (Recommended)**

1. In Codemagic Team settings, go to **codemagic.yaml settings > Code signing identities**
2. Open **iOS certificates** tab
3. Click **Generate new certificate**
4. Select certificate type: **Apple Distribution** (for App Store)
5. Enter certificate password (remember this!)
6. Enter **Reference name**: `ios_distribution` (used in codemagic.yaml)
7. Click **Generate**

**Option B: Upload Existing Certificate**

1. Export your certificate from Keychain Access as `.p12`
2. In Codemagic, click **Upload certificate**
3. Upload the `.p12` file
4. Enter certificate password
5. Enter **Reference name**: `ios_distribution`

#### 3.4 Configure Environment Variables in Codemagic

1. Go to your app settings in Codemagic
2. Navigate to **Environment variables**
3. Create a new group called `app_store_connect` (or use existing)
4. Add variables:
   - `APP_STORE_CONNECT_API_KEY_ID`: Your Key ID from step 3.1
   - `APP_STORE_CONNECT_ISSUER_ID`: Your Issuer ID from step 3.1
   - `APP_STORE_CONNECT_API_KEY`: The contents of your `.p8` file (or use file upload)

### 4. Create App Record in App Store Connect

Before you can publish, you need to create an app record:

1. Log in to [App Store Connect](https://appstoreconnect.apple.com)
2. Go to **My Apps** > **+** > **New App**
3. Fill in:
   - **Platform**: iOS
   - **Name**: Kids Call Home
   - **Primary Language**: English
   - **Bundle ID**: `com.kidscallhome.app` (must match your app)
   - **SKU**: `kidscallhome-ios-001` (unique identifier)
4. Click **Create**
5. Note the **Apple ID** (numeric ID) - you'll need this for `APP_STORE_APPLE_ID`

### 5. Update codemagic.yaml

Update the iOS workflow in `codemagic.yaml` with your App Store Connect Apple ID:

```yaml
vars:
  APP_STORE_APPLE_ID: "1234567890"  # Replace with your app's Apple ID
```

Also update the `integrations` section at the top of the file:

```yaml
integrations:
  app_store_connect: codemagic  # Match the API key name from step 3.2
```

### 6. Test the Build

1. Commit all changes (including `ios/` folder) to your repository
2. Push to your main branch
3. In Codemagic, select the **iOS Build** workflow
4. Click **Start new build**
5. Monitor the build logs

## Differences from Native iOS Apps

The Codemagic documentation you referenced is for **native iOS apps** (pure Xcode projects). Since Kids Call Home uses **Capacitor**, the build process is slightly different:

### Key Differences:

1. **Project Structure**: Capacitor uses `ios/App/App.xcworkspace` instead of a direct `.xcodeproj`
2. **Build Process**: 
   - First build the web app (`npm run build`)
   - Then sync Capacitor (`npx cap sync ios`)
   - Finally build the iOS wrapper
3. **Dependencies**: Uses CocoaPods (managed automatically by Capacitor)
4. **Web Content**: The iOS app wraps your web app from the `dist/` folder

## Troubleshooting

### Build Fails: "No such module 'Capacitor'"

**Solution**: Run `pod install` in `ios/App/` directory. This is already included in the workflow.

### Build Fails: "Code signing error"

**Solution**: 
1. Verify certificates are uploaded in Codemagic
2. Check bundle identifier matches: `com.kidscallhome.app`
3. Ensure provisioning profiles are configured correctly

### Build Fails: "Missing Info.plist keys"

**Solution**: Add the required permission descriptions to `ios/App/App/Info.plist` (see step 6).

### iOS Project Not Found

**Solution**: The workflow automatically generates the iOS project if it doesn't exist. If you see this error, check the build logs for the "Add iOS platform" step.

## Next Steps After First Build

1. **TestFlight**: Once the build succeeds, configure TestFlight distribution
2. **App Store**: Prepare App Store listing (screenshots, description, etc.)
3. **Privacy Policy**: Ensure privacy policy URL is set in App Store Connect
4. **App Review**: Submit for App Store review

## Resources

- [Capacitor iOS Documentation](https://capacitorjs.com/docs/ios)
- [Codemagic iOS Code Signing](https://docs.codemagic.io/code-signing-yaml/signing-ios/)
- [App Store Connect API](https://developer.apple.com/documentation/appstoreconnectapi)
- [Apple Developer Program](https://developer.apple.com/programs/)

## Checklist

- [x] Installed `@capacitor/ios` package ✅ (Already done)
- [x] iOS project generation ✅ (Automatic in Codemagic)
- [x] iOS permissions configuration ✅ (Automatic in workflow)
- [ ] Created App Store Connect API key
- [ ] Added API key to Codemagic
- [ ] Uploaded/generated code signing certificate
- [ ] Created app record in App Store Connect
- [ ] Updated `codemagic.yaml` with Apple ID (set `APP_STORE_APPLE_ID` variable)
- [ ] Tested build in Codemagic

**Note**: You don't need to commit the `ios/` folder - it will be generated automatically during the build!

