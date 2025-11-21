# Android App Signing Setup

## Yes, Your App MUST Be Signed!

Google Play Store **requires** all apps to be signed before upload. You have two options:

---

## Option 1: Google Play App Signing (Recommended) ⭐

**Best for:** Most developers - Google manages your signing key securely

### How It Works:

1. You create an **upload key** (you manage this)
2. You sign your app with the upload key
3. Upload to Play Store
4. Google re-signs with their **app signing key** (they manage this)
5. Users get the app signed by Google's key

### Benefits:

- ✅ Google securely stores your app signing key
- ✅ If you lose your upload key, Google can reset it
- ✅ Better security
- ✅ Google can optimize APKs for different devices

### Setup Steps:

#### 1. Generate Upload Keystore

```bash
cd android/app
keytool -genkey -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

**You'll be asked for:**

- Password (remember this!)
- Your name
- Organization name
- City, State, Country
- Confirm password

**Important:** Save the password and keystore file securely!

#### 2. Create keystore.properties file

Create `android/keystore.properties`:

```properties
storePassword=YOUR_KEYSTORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=upload
storeFile=app/upload-keystore.jks
```

**⚠️ DO NOT commit this file to git!** Add to `.gitignore`

#### 3. Update build.gradle

See the updated `android/app/build.gradle` - signing config is already added.

#### 4. Build Signed AAB

```bash
cd android
gradlew.bat bundleRelease
```

The signed AAB will be at: `android/app/build/outputs/bundle/release/app-release.aab`

#### 5. First Upload to Play Store

- Upload the AAB
- Google will ask if you want to use Google Play App Signing
- **Select YES** - this is recommended
- Google will generate the app signing key

---

## Option 2: Manage Your Own Signing Key

**Best for:** Advanced users who want full control

### Setup:

Same as Option 1, but when Google asks about App Signing, select "No" and manage the key yourself.

**⚠️ Warning:** If you lose this key, you can NEVER update your app again!

---

## Quick Setup Script

Run this in PowerShell from the project root:

```powershell
# Navigate to android/app
cd android/app

# Generate keystore (you'll be prompted for info)
keytool -genkey -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload

# Go back to android directory
cd ..

# Create keystore.properties (you'll need to edit with your passwords)
@"
storePassword=YOUR_KEYSTORE_PASSWORD_HERE
keyPassword=YOUR_KEY_PASSWORD_HERE
keyAlias=upload
storeFile=app/upload-keystore.jks
"@ | Out-File -FilePath keystore.properties -Encoding utf8

Write-Host "✅ Keystore created!"
Write-Host "⚠️  IMPORTANT: Edit android/keystore.properties with your actual passwords"
Write-Host "⚠️  IMPORTANT: Add keystore.properties and upload-keystore.jks to .gitignore"
```

---

## Security Checklist

- [ ] Keystore file (`upload-keystore.jks`) is backed up securely
- [ ] Passwords are saved in a password manager
- [ ] `keystore.properties` is in `.gitignore`
- [ ] `upload-keystore.jks` is in `.gitignore`
- [ ] You know where your keystore is stored

---

## .gitignore Updates Needed

Add to `.gitignore`:

```
android/keystore.properties
android/app/upload-keystore.jks
android/app/*.jks
android/app/*.keystore
```

---

## Building the Signed AAB

After setup:

```bash
# Build web app
npm run build

# Sync Capacitor
npx cap sync android

# Build signed AAB
cd android
gradlew.bat bundleRelease
```

The signed AAB will be at:

```
android/app/build/outputs/bundle/release/app-release.aab
```

---

## Troubleshooting

### "Keystore file not found"

- Make sure `keystore.properties` has correct path
- Path should be relative to `android/` directory
- Example: `storeFile=app/upload-keystore.jks`

### "Password incorrect"

- Check `keystore.properties` passwords match keystore
- Make sure no extra spaces in the file

### "Key alias not found"

- Make sure `keyAlias=upload` matches the alias you used when creating keystore

---

## Next Steps After Signing

1. ✅ Build signed AAB
2. ✅ Upload to Play Console (Internal Testing first)
3. ✅ Enable Google Play App Signing when prompted
4. ✅ Complete app information in Play Console
5. ✅ Submit for review


