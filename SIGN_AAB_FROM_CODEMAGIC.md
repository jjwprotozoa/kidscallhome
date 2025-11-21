# Signing AAB File from Codemagic

If you have an **unsigned AAB file** from Codemagic, you need to sign it before uploading to Google Play Store.

## Quick Solution: Sign the Existing AAB

### Prerequisites
- You have the AAB file from Codemagic
- You have the keystore file: `android/app/upload-keystore.jks`
- You know the keystore password (from `android/keystore.properties`)

### Step 1: Locate Your Files

Your keystore info:
- **Keystore file**: `android/app/upload-keystore.jks`
- **Keystore password**: `KidsCallHome2025` (from keystore.properties)
- **Key alias**: `upload`
- **Key password**: `KidsCallHome2025`

### Step 2: Sign the AAB File

Run this command in PowerShell (replace `path/to/your-app.aab` with your actual AAB file path):

```powershell
# Navigate to where your AAB file is
cd "path/to/your/aab/file/location"

# Sign the AAB using jarsigner
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 `
  -keystore "C:\Users\DevBox\MiniApps\KidsCallHome\kidscallhome\kidscallhome\android\app\upload-keystore.jks" `
  -storepass "KidsCallHome2025" `
  -keypass "KidsCallHome2025" `
  "your-app.aab" `
  "upload"

# Verify the signature
jarsigner -verify -verbose -certs "your-app.aab"
```

### Step 3: Align the AAB (Optional but Recommended)

If you have `zipalign` (comes with Android SDK), align the AAB:

```powershell
# Find zipalign (usually in Android SDK build-tools)
# Example path: C:\Users\YourName\AppData\Local\Android\Sdk\build-tools\34.0.0\zipalign.exe

zipalign -v 4 "your-app.aab" "your-app-aligned.aab"
```

**Note**: AAB files are already aligned by default, so this step is usually not needed.

### Step 4: Verify the Signed AAB

```powershell
# Check if the AAB is signed
jarsigner -verify -verbose -certs "your-app.aab"
```

You should see:
```
jar verified.
```

## Alternative: Use apksigner (More Modern)

If you have `apksigner` (Android SDK build-tools 24.0.3+):

```powershell
# Sign with apksigner
apksigner sign `
  --ks "C:\Users\DevBox\MiniApps\KidsCallHome\kidscallhome\kidscallhome\android\app\upload-keystore.jks" `
  --ks-pass pass:"KidsCallHome2025" `
  --key-pass pass:"KidsCallHome2025" `
  --ks-key-alias upload `
  "your-app.aab"

# Verify
apksigner verify --verbose "your-app.aab"
```

**Note**: `apksigner` is designed for APK files. For AAB files, `jarsigner` is the standard tool.

## Better Long-Term Solution: Configure Codemagic to Sign Automatically

To avoid manually signing every build, configure Codemagic to sign during the build process.

### Option A: Upload Keystore to Codemagic (Recommended)

1. **Upload your keystore to Codemagic**:
   - Go to Codemagic dashboard
   - Navigate to **Settings → Environment variables**
   - Find or create the `android_keystore` group
   - Add these variables:
     - `CM_KEYSTORE_PATH`: Path to your keystore (e.g., `android/app/upload-keystore.jks`)
     - `CM_KEYSTORE_PASSWORD`: `KidsCallHome2025`
     - `CM_KEY_PASSWORD`: `KidsCallHome2025`
     - `CM_KEYSTORE_ALIAS`: `upload`

2. **Upload the keystore file**:
   - In Codemagic, go to **Settings → Code signing identities**
   - Upload `android/app/upload-keystore.jks` as an Android keystore
   - Codemagic will make it available during builds

3. **Update codemagic.yaml** to use the keystore:

Add this script step before the "Build Android App Bundle" step:

```yaml
- name: Set up Android keystore for signing
  script: |
    if [ ! -z "$CM_KEYSTORE_PATH" ] && [ -f "$CM_KEYSTORE_PATH" ]; then
      echo "✅ Keystore found at: $CM_KEYSTORE_PATH"
      
      # Create keystore.properties file for Gradle
      cat > android/keystore.properties << EOF
      storePassword=$CM_KEYSTORE_PASSWORD
      keyPassword=$CM_KEY_PASSWORD
      keyAlias=$CM_KEYSTORE_ALIAS
      storeFile=$(echo $CM_KEYSTORE_PATH | sed 's|^android/||')
      EOF
      
      echo "✅ Created keystore.properties"
      echo "Keystore alias: $CM_KEYSTORE_ALIAS"
    else
      echo "⚠️ No keystore configured - build will be unsigned"
      echo "CM_KEYSTORE_PATH: $CM_KEYSTORE_PATH"
    fi
```

### Option B: Use Codemagic's Keystore Management

1. In Codemagic dashboard, go to **Settings → Code signing identities**
2. Click **Add Android keystore**
3. Upload your `upload-keystore.jks` file
4. Enter the passwords
5. Codemagic will automatically use it during builds

Then update `codemagic.yaml` to reference it:

```yaml
environment:
  groups:
    - android_keystore  # This group should contain your keystore
```

## Verification Checklist

After signing, verify:

- [ ] AAB file is signed (use `jarsigner -verify`)
- [ ] File size is reasonable (not 0 bytes)
- [ ] You can upload it to Play Console
- [ ] Play Console accepts the signature

## Troubleshooting

### "jarsigner: unable to sign jar"
- Make sure Java is installed and in PATH
- Verify keystore file path is correct
- Check passwords are correct

### "keystore password was incorrect"
- Double-check the password from `keystore.properties`
- Make sure there are no extra spaces or newlines

### "alias upload does not exist"
- Verify the alias matches what's in `keystore.properties` (should be `upload`)

### Play Store Rejects the AAB
- Make sure you're using the same keystore for all releases
- If this is your first release, you can use any keystore
- If updating an existing app, you MUST use the same keystore as before

## Next Steps

1. ✅ Sign your AAB file using the commands above
2. ✅ Upload to Google Play Console
3. ✅ When prompted, enable **Google Play App Signing** (recommended)
4. ✅ Configure Codemagic for automatic signing in future builds

---

**Security Note**: Never commit your keystore file or passwords to git. They should already be in `.gitignore`.



