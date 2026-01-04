# Scripts Directory

Utility scripts for local development and build management.

## Android Signing Scripts

### Sign Android Builds Locally

Since the keystore is kept local (not in git) for security, use these scripts to sign unsigned builds downloaded from Codemagic:

**Windows (PowerShell):**
```powershell
.\scripts\sign-android-build.ps1 app-release-unsigned.apk
.\scripts\sign-android-build.ps1 app-release-unsigned.aab
```

**Mac/Linux (Bash):**
```bash
chmod +x scripts/sign-android-build.sh
./scripts/sign-android-build.sh app-release-unsigned.apk
./scripts/sign-android-build.sh app-release-unsigned.aab
```

**Custom keystore location:**
```powershell
.\scripts\sign-android-build.ps1 app-release-unsigned.apk "path/to/keystore.jks" "password" "alias" "key-password"
```

### Workflow

1. **Build in Codemagic** - Builds will be unsigned (no keystore configured)
2. **Download artifacts** - Download APK/AAB from Codemagic build artifacts
3. **Sign locally** - Use the signing script with your local keystore
4. **Upload to Play Store** - Use the signed APK/AAB

### Requirements

- Java JDK (for `jarsigner` and `keytool`)
- Android SDK build-tools (for `apksigner` - optional, falls back to jarsigner)
- Keystore file: `android/upload-keystore.jks` (keep this local, never commit to git)

### Generate Keystore (if needed)

```bash
keytool -genkey -v -keystore android/upload-keystore.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias upload
```
