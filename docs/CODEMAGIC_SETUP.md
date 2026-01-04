# Codemagic CI/CD Setup Guide

This guide explains how to configure Codemagic for Android and iOS builds.

## Android Build Configuration

### Required: Android Keystore Setup

The Android build requires a keystore for signing release builds. Configure the following in Codemagic:

1. **Go to Codemagic Dashboard**
   - Navigate to: **Teams → Code Signing → Environment Variables**
   - Find or create the group: **`android_keystore`**

2. **Add the following environment variables:**

   | Variable Name | Description | Example |
   | ------------- | ----------- | ------- |
   | `CM_KEYSTORE_PATH` | Path to your `.jks` keystore file | `/path/to/upload-keystore.jks` |
   | `CM_KEYSTORE_PASSWORD` | Password for the keystore | `your-keystore-password` |
   | `CM_KEY_ALIAS` | Alias name of the key in the keystore | `upload` |
   | `CM_KEY_PASSWORD` | Password for the key alias | `your-key-password` |

3. **If you don't have a keystore yet:**

   Generate one using the following command:

   ```bash
   keytool -genkey -v -keystore upload-keystore.jks \
     -keyalg RSA -keysize 2048 -validity 10000 \
     -alias upload
   ```

   Then upload the `.jks` file to Codemagic and set `CM_KEYSTORE_PATH` to point to it.

### Required: Google Play Store Publishing

The Android build can automatically publish to Google Play Store (similar to iOS App Store publishing).

1. **Create Google Play API Service Account**
   - Go to [Google Play Console](https://play.google.com/console)
   - Navigate to: **Setup → API access**
   - Click **Create new service account**
   - Follow the Google Cloud Console link to create the service account
   - Download the JSON key file for the service account
   - Back in Play Console, grant the service account access to your app
   - Grant permissions: **View app information** and **Manage production releases** (or **Manage testing releases** for internal/alpha/beta tracks)

2. **Configure Integration in Codemagic**
   - Go to: **Codemagic → Teams → Integrations → Google Play**
   - Click **Add Integration**
   - Name it: **`google_play`** (must match the name in `codemagic.yaml`)
   - Upload the JSON key file from step 1

3. **Verify Integration Name**
   - The integration name in Codemagic must match the name in `codemagic.yaml`
   - Current name: **`google_play`** (line 10 in `codemagic.yaml`)
   - To change: Update both the Codemagic integration name AND the YAML file

4. **Configure Publishing Track**
   - In `codemagic.yaml`, the `track` is set to `internal` (for testing)
   - Options: `internal`, `alpha`, `beta`, `production`
   - Change `track: production` when ready for public releases
   - Set `submit_as_draft: false` to auto-submit for review, or `true` to upload as draft

### Troubleshooting Android Build

**Error: `CM_KEYSTORE_PATH is not set!`**

- ✅ Solution: The keystore is now in the repository at `android/upload-keystore.jks`
- ✅ If using environment variables, configure the `android_keystore` environment group in Codemagic Team Settings

**Error: Google Play publishing failed**

- ✅ Verify the integration `google_play` exists in Codemagic
- ✅ Check that the service account JSON key is valid and not expired
- ✅ Ensure the service account has the correct permissions in Google Play Console
- ✅ Verify the package name matches: `com.kidscallhome.app`
- ✅ Check that the track (`internal`, `alpha`, `beta`, `production`) exists in Play Console

---

## iOS Build Configuration

### Required: App Store Connect Integration

The iOS build requires App Store Connect API credentials for publishing to TestFlight and the App Store.

1. **Create App Store Connect API Key**
   - Go to [App Store Connect](https://appstoreconnect.apple.com)
   - Navigate to: **Users and Access → Keys → App Store Connect API**
   - Click **Generate API Key**
   - Download the `.p8` private key file
   - Note the **Key ID** and **Issuer ID**

2. **Configure Integration in Codemagic**
   - Go to: **Codemagic → Teams → Integrations → App Store Connect**
   - Click **Add Integration**
   - Name it: **`codemagic`** (must match the name in `codemagic.yaml`)
   - Enter the following:
     - **Key ID**: From App Store Connect
     - **Issuer ID**: From App Store Connect
     - **Private Key**: Paste the contents of the `.p8` file

3. **Verify Integration Name**
   - The integration name in Codemagic must match the name in `codemagic.yaml`
   - Current name: **`codemagic`** (line 761 and 1325 in `codemagic.yaml`)
   - To change: Update both the Codemagic integration name AND the YAML file

### Required: iOS Code Signing

1. **Go to Codemagic → Teams → Code Signing**
   - Find or create the group: **`ios_certificates`**

2. **Add the following:**
   - **Distribution Certificate** (not Development)
   - **App Store Provisioning Profile** (not Development/Ad Hoc)
   - The provisioning profile must be for bundle ID: **`com.kidscallhome.app`**

3. **Verify Bundle ID**
   - The bundle ID in the provisioning profile must match exactly: `com.kidscallhome.app`
   - Check in: **Apple Developer Portal → Certificates, Identifiers & Profiles**

### Required: TestFlight Beta Groups

If you're using `beta_groups` in the publishing configuration:

1. **Create Beta Groups in App Store Connect**
   - Go to: **App Store Connect → TestFlight → Groups**
   - Create groups like "Internal Testers", "External Testers", etc.

2. **Update `codemagic.yaml`**
   - The group names in `beta_groups` must match exactly
   - Current configuration uses: `"Internal Testers"`
   - If the group doesn't exist, publishing will fail

### Troubleshooting iOS Publishing

**Error: `Failed to publish App.ipa to App Store Connect`**

Common causes and solutions:

1. **Integration not found**
   - ✅ Verify the integration named `codemagic` exists in Codemagic
   - ✅ Check that the integration name matches exactly (case-sensitive)

2. **Invalid API credentials**
   - ✅ Verify the Key ID, Issuer ID, and Private Key are correct
   - ✅ Ensure the API key has **App Manager** or **Admin** role in App Store Connect
   - ✅ Check that the API key hasn't expired

3. **IPA file not found**
   - ✅ Check the build logs to see if the IPA was created
   - ✅ Verify the IPA path: `build/ios/ipa/*.ipa`
   - ✅ The build step should show: `✅ IPA found: build/ios/ipa/App.ipa`

4. **Bundle ID mismatch**
   - ✅ Verify `APP_STORE_APPLE_ID` matches your app in App Store Connect
   - ✅ Current value: `6756827237` (line 772 in `codemagic.yaml`)
   - ✅ Find your Apple ID in: **App Store Connect → My Apps → [Your App] → App Information**

5. **Beta group doesn't exist**
   - ✅ If using `beta_groups`, ensure the group exists in App Store Connect
   - ✅ Or comment out the `beta_groups` section to disable auto-distribution

6. **Provisioning profile issues**
   - ✅ Ensure you have an **App Store** provisioning profile (not Development)
   - ✅ Verify the profile is for bundle ID: `com.kidscallhome.app`
   - ✅ Check that the certificate hasn't expired

---

## Quick Checklist

### Android

- [ ] `android_keystore` environment group created
- [ ] `CM_KEYSTORE_PATH` set (points to uploaded `.jks` file)
- [ ] `CM_KEYSTORE_PASSWORD` set
- [ ] `CM_KEY_ALIAS` set
- [ ] `CM_KEY_PASSWORD` set

### iOS

- [ ] App Store Connect API key created
- [ ] Integration `codemagic` created in Codemagic
- [ ] Integration contains: Key ID, Issuer ID, Private Key
- [ ] `ios_certificates` group contains Distribution Certificate
- [ ] `ios_certificates` group contains App Store Provisioning Profile
- [ ] Provisioning profile is for bundle ID: `com.kidscallhome.app`
- [ ] `APP_STORE_APPLE_ID` is set correctly (currently: `6756827237`)
- [ ] TestFlight beta groups exist (if using `beta_groups`)

---

## Additional Resources

- [Codemagic Android Code Signing](https://docs.codemagic.io/code-signing/android-code-signing/)
- [Codemagic iOS Code Signing](https://docs.codemagic.io/code-signing/ios-code-signing/)
- [Codemagic App Store Connect Integration](https://docs.codemagic.io/publishing-yaml/distribution/#app-store-connect)
- [App Store Connect API Keys](https://developer.apple.com/documentation/appstoreconnectapi/creating_api_keys_for_app_store_connect_api)
