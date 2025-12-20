# Codemagic Setup Checklist ✅

## ✅ App Store Connect - COMPLETE
You've already completed App Store Connect setup!

## 📋 Final Steps to Complete Codemagic Setup

### 1. Update `codemagic.yaml` with Your Apple ID

**File**: `codemagic.yaml` (project root)

**Line 19**: Replace `"1234567890"` with your actual Apple ID:

```yaml
APP_STORE_APPLE_ID: "YOUR_ACTUAL_APPLE_ID"   # Get this from App Store Connect
```

**How to find your Apple ID:**
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click **My Apps** → Select **Kids Call Home**
3. Click **App Information** tab
4. Find **Apple ID** (it's a numeric ID like `1234567890`)

### 2. Verify App Store Connect API Key Name

**File**: `codemagic.yaml` (line 12)

Make sure the integration name matches what you set in Codemagic:

```yaml
integrations:
  app_store_connect: codemagic   # ← Must match Codemagic Team Settings
```

**To verify in Codemagic:**
1. Go to **Team Settings** → **Developer Portal** → **Manage keys**
2. Check the name of your App Store Connect API key
3. If it's different from `codemagic`, update line 12 in `codemagic.yaml`

### 3. Set Up Code Signing Certificate in Codemagic

**In Codemagic Dashboard:**

1. Go to **Team Settings** → **Code signing identities** → **iOS certificates**
2. Click **Generate new certificate** (or upload existing)
3. Select certificate type: **Apple Distribution**
4. Enter a **Reference name**: `ios_distribution` (or any name you prefer)
5. Enter certificate password (remember this!)
6. Click **Generate**

**Note**: The workflow will automatically use this certificate for signing.

### 4. Commit and Push `codemagic.yaml`

```bash
git add codemagic.yaml
git commit -m "Add Codemagic iOS build configuration"
git push
```

### 5. Add App to Codemagic

1. Go to [Codemagic](https://codemagic.io)
2. Click **Add application**
3. Select your repository (KidsCallHome)
4. Select **codemagic.yaml** as configuration file
5. Click **Finish**

### 6. Start Your First Build

1. In Codemagic, select your app
2. Select the **iOS Capacitor Build** workflow
3. Click **Start new build**
4. Monitor the build logs

## 🎯 What Happens During Build

The workflow will automatically:
1. ✅ Install npm dependencies
2. ✅ Build your web app
3. ✅ Generate iOS project (if it doesn't exist)
4. ✅ Configure iOS permissions (camera, microphone, photos, notifications)
5. ✅ Install CocoaPods dependencies
6. ✅ Set up code signing
7. ✅ Increment build number (if Apple ID is configured)
8. ✅ Build IPA file
9. ✅ Upload to TestFlight (if code signing is configured)

## ⚠️ Common Issues & Solutions

### Build fails: "Code signing error"
- **Solution**: Make sure you've generated/uploaded the code signing certificate in Codemagic Team Settings

### Build fails: "App Store Connect API key not found"
- **Solution**: Verify the integration name in `codemagic.yaml` matches the key name in Codemagic Team Settings

### Build fails: "iOS project not found"
- **Solution**: The workflow generates it automatically. Check build logs for the "Sync Capacitor iOS" step

### Build succeeds but TestFlight upload fails
- **Solution**: 
  1. Verify `APP_STORE_APPLE_ID` is correct
  2. Check that your app record exists in App Store Connect
  3. Ensure code signing certificate is valid

## 📱 After First Successful Build

1. **Download IPA**: Available in Codemagic artifacts
2. **TestFlight**: Build will be automatically uploaded to TestFlight
3. **Beta Testing**: Add testers in App Store Connect → TestFlight
4. **App Store**: When ready, change `submit_to_app_store: false` to `true` in `codemagic.yaml`

## 🎉 You're All Set!

Once you complete steps 1-3 above, your iOS builds will run automatically on every push to your repository!

