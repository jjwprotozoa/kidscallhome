# iOS Build Quick Start (No MacBook Required!)

## ✅ What's Already Done

Your iOS build is **fully automated** in Codemagic! No MacBook needed.

### Completed Setup:
- ✅ `@capacitor/ios` package installed
- ✅ iOS workflow added to `codemagic.yaml`
- ✅ Automatic iOS project generation
- ✅ Automatic permission configuration
- ✅ Capacitor sync and CocoaPods setup

## 🚀 What You Need to Do

### 1. Set Up Code Signing (One-Time Setup)

#### A. Create App Store Connect API Key
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. **Users and Access > Integrations > App Store Connect API**
3. Click **+** → Name: "Codemagic" → Access: **App Manager**
4. **Download the `.p8` file** (only available once!)
5. Note the **Issuer ID** and **Key ID**

#### B. Add to Codemagic
1. Codemagic → **Team Settings > Developer Portal > Manage keys**
2. Click **Add key**
3. Enter Issuer ID, Key ID, upload `.p8` file
4. Name it: `codemagic` (or update workflow to match your name)

#### C. Generate Code Signing Certificate
1. Codemagic → **Team Settings > Code signing identities > iOS certificates**
2. Click **Generate new certificate**
3. Type: **Apple Distribution**
4. Reference name: `ios_distribution` (or update workflow)

#### D. Create App Record
1. App Store Connect → **My Apps > + > New App**
2. Bundle ID: `com.kidscallhome.app`
3. Note the **Apple ID** (numeric)

#### E. Update Workflow Variable
In Codemagic app settings, add environment variable:
- `APP_STORE_APPLE_ID`: Your app's Apple ID from step D

### 2. Start Your First Build

1. Commit and push your code (including `codemagic.yaml`)
2. In Codemagic, select **iOS Build** workflow
3. Click **Start new build**
4. Wait for the build to complete (~10-15 minutes)

## 📱 What Happens Automatically

The workflow will:
1. ✅ Install npm dependencies
2. ✅ Build your web app (`npm run build`)
3. ✅ Generate iOS project (`npx cap sync ios` creates it if missing)
4. ✅ Configure camera, microphone, photo, notification permissions
5. ✅ Install CocoaPods dependencies
6. ✅ Set up code signing certificates
7. ✅ Build IPA file
8. ✅ (Optional) Upload to TestFlight/App Store

## 🎯 Next Steps After First Successful Build

1. **Download IPA** from Codemagic artifacts
2. **TestFlight**: Configure beta testers in App Store Connect
3. **App Store**: Prepare listing (screenshots, description, privacy policy)
4. **Submit**: Submit for App Store review

## ❓ Troubleshooting

### Build fails: "iOS project not found"
- **Solution**: The workflow generates it automatically. Check build logs for the "Sync Capacitor iOS" step.

### Build fails: "Code signing error"
- **Solution**: Verify certificates are uploaded in Codemagic Team Settings

### Build fails: "Missing permissions"
- **Solution**: Permissions are configured automatically. If missing, check Info.plist in build logs.

### Can't find App Store Connect API key
- **Solution**: Make sure you downloaded the `.p8` file when you created it (can only download once!)

## 📚 Full Documentation

See `docs/IOS_SETUP.md` for detailed step-by-step instructions.

