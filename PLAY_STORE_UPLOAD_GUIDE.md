# Google Play Store Upload Guide

## Understanding the Errors

### Error 1: "You need to upload an APK or Android App Bundle"

**Solution:** You need to build and upload an Android App Bundle (AAB) file. See steps below.

### Error 2: "You can't rollout this release because it doesn't allow any existing users to upgrade"

**Solution:** This happens when:

- You're trying to create a production release but haven't uploaded a bundle yet
- The bundle you uploaded has a lower versionCode than existing releases
- Start with an Internal Testing or Closed Testing track first

### Error 3: "This release does not add or remove any app bundles"

**Solution:** You need to actually upload a bundle file. The release was created but no bundle was added.

### Warning 1: Advertising ID Declaration

**Solution:** ✅ **FIXED** - We've added the opt-out declaration in AndroidManifest.xml since your app doesn't use advertising IDs.

### Warning 2: No Testers Configured

**Solution:** Configure testers in Play Console under Testing > Internal testing or Closed testing.

### Error 4: Privacy Policy Required (CAMERA permission)

**Solution:** Your app uses `android.permission.CAMERA` which requires a privacy policy URL. See "Privacy Policy Setup" section below.

---

## Step-by-Step: Building and Uploading

### 1. Build the Web App First

```bash
npm run build
```

### 2. Sync Capacitor

```bash
npx cap sync android
```

### 3. Build the Android App Bundle (AAB)

```bash
cd android
./gradlew bundleRelease
```

**On Windows:**

```bash
cd android
gradlew.bat bundleRelease
```

The AAB file will be created at:

```
android/app/build/outputs/bundle/release/app-release.aab
```

### 4. Alternative: Build APK (for testing)

```bash
cd android
gradlew.bat assembleRelease
```

APK will be at:

```
android/app/build/outputs/apk/release/app-release.apk
```

---

## Uploading to Play Console

### Option A: Internal Testing (Recommended for First Release)

1. **Go to Play Console** → Your App → Testing → Internal testing
2. **Create a new release** (or edit existing)
3. **Upload the AAB file** (`app-release.aab`)
4. **Add release notes** (use your short release notes)
5. **Save** (don't promote to production yet)
6. **Add testers:**
   - Go to Testers tab
   - Create email list or use Google Groups
   - Add your test email addresses
7. **Review and roll out** to internal testers

### Option B: Production Release

**⚠️ Only do this after testing!**

1. **Go to** Production → Create new release
2. **Upload AAB file**
3. **Add release notes**
4. **Review and roll out**

---

## Version Management

Your current version in `android/app/build.gradle`:

- `versionCode 1` - Internal version number (must increase with each upload)
- `versionName "1.0"` - User-visible version

**Important:** Every time you upload a new release, you MUST increase `versionCode`:

- First release: `versionCode 1`
- Second release: `versionCode 2`
- etc.

---

## Privacy Policy Setup

⚠️ **REQUIRED** - Your app uses `CAMERA` and `RECORD_AUDIO` permissions, which require a privacy policy URL.

### Why You Need a Privacy Policy

Google Play requires a privacy policy for apps that:

- Access the camera (for video calls)
- Record audio (for voice/video calls)
- Access user data
- Use sensitive permissions

### Steps to Add Privacy Policy

1. **Create a Privacy Policy Page**

   - Host it on your website (e.g., `https://yourdomain.com/privacy`)
   - Or use a free service like:
     - [Privacy Policy Generator](https://www.privacypolicygenerator.info/)
     - [Termly](https://termly.io/)
     - [iubenda](https://www.iubenda.com/)

2. **What to Include:**

   - What data you collect (camera, microphone, user accounts)
   - How you use the data (video/voice calls, user authentication)
   - How you store/protect the data
   - Third-party services (Supabase, etc.)
   - User rights (data deletion, etc.)

3. **Add to Play Console:**

   - Go to **Policy → App content**
   - Find **"Privacy Policy"** section
   - Enter your privacy policy URL
   - Save

4. **Example Privacy Policy Content:**
   ```
   - We collect: Camera and microphone data for video/voice calls
   - We use: Real-time communication between family members
   - We store: User accounts and call history (as needed for app functionality)
   - We share: Only with other users in the same family account
   - We protect: Data encrypted in transit and at rest via Supabase
   - User rights: Contact us to delete your account and data
   ```

---

## Advertising ID Declaration

✅ **Already Fixed** - The manifest now includes:

```xml
<uses-permission android:name="com.google.android.gms.permission.AD_ID" tools:node="remove" />
```

This tells Google Play that your app does NOT use advertising IDs.

**In Play Console:**

1. Go to Policy → App content
2. Find "Advertising ID" section
3. Select "No, my app does not use an advertising ID"
4. Save

---

## Quick Checklist

- [ ] Build web app: `npm run build`
- [ ] Sync Capacitor: `npx cap sync android`
- [ ] **Increment versionCode** in `android/app/build.gradle` (if re-uploading)
- [ ] Build AAB: `cd android && .\bundleRelease.ps1` (or `gradlew.bat bundleRelease`)
- [ ] Upload AAB to Play Console (Internal Testing track)
- [ ] **Add Privacy Policy URL** in Play Console (Policy → App content)
- [ ] Add testers in Play Console
- [ ] Complete Advertising ID declaration in Play Console
- [ ] Add release notes
- [ ] Review and roll out to testers

---

## Troubleshooting

### "Gradle build failed"

- Make sure you have Android SDK installed
- Check `android/local.properties` has correct `sdk.dir` path
- Try: `cd android && gradlew.bat clean && gradlew.bat bundleRelease`

### "AAB file too large"

- Check bundle size in Play Console
- Consider enabling ProGuard/R8 (set `minifyEnabled true` in build.gradle)
- Use Android App Bundle (AAB) instead of APK (smaller downloads)

### "Version code already used"

- Increase `versionCode` in `android/app/build.gradle` (currently set to 2)
- Rebuild and upload new AAB

### "Privacy policy required for CAMERA permission"

- Create a privacy policy page on your website
- Add the URL in Play Console → Policy → App content → Privacy Policy
- The policy must explain how you use camera/microphone data

---

## Next Steps After Upload

1. **Wait for review** (can take a few hours to days)
2. **Test with internal testers**
3. **Fix any issues** and upload new version
4. **Promote to production** when ready
