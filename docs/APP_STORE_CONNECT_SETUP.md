# App Store Connect - New App Setup Guide

## 📱 Step-by-Step Form Configuration

Fill out the "New App" form with these values:

### 1. **Platforms** ✅

- [x] **iOS** ← Check this box (uncheck others)

### 2. **Company Name** 📝

Enter your company/developer name:

- Example: `Fluid Investment Group` (or your actual company name)
- This appears as the seller name in the App Store
- Max 500 characters

### 3. **Name** 📱

Enter: **`Kids Call Home`**

- This is your app's display name in the App Store
- Max 30 characters
- Must match your app's actual name

### 4. **Primary Language** 🌐

Select: **`English (U.S.)`** (or your preferred language)

- This is the primary language for your app listing
- You can add more languages later

### 5. **Bundle ID** 🔑

**IMPORTANT:** You need to register this first!

**Your Bundle ID Details:**

- **App ID Prefix (Team ID)**: `786BYGA3LW` ✅ (auto-filled by Apple)
- **Description**: `Kids Call Home iOS App`
- **Bundle ID**: `com.kidscallhome.app` (explicit)
- **Platform**: iOS only

**Option A: If Bundle ID already exists:**

- Click the dropdown
- Select: **`com.kidscallhome.app`**

**Option B: If Bundle ID doesn't exist yet:**

1. Click the blue link: **"Register a new bundle ID in Certificates, Identifiers & Profiles"**
2. This opens a new tab/window
3. Fill out:
   - **Platform**: Select **iOS** only (uncheck others)
   - **App ID Prefix**: `786BYGA3LW` (auto-filled)
   - **Description**: `Kids Call Home iOS App`
   - **Bundle ID**: `com.kidscallhome.app` (explicit)
   - **Capabilities**: Enable Push Notifications, Associated Domains (see BUNDLE_ID_CAPABILITIES.md)
4. Click **Continue** → **Register**
5. Go back to the "New App" form
6. Refresh the Bundle ID dropdown
7. Select: **`com.kidscallhome.app`**

### 6. **SKU** 🏷️

Enter: **`kidscallhome-ios-001`**

- SKU = Stock Keeping Unit (unique identifier for your records)
- Can be any unique string (letters, numbers, hyphens)
- Examples: `kidscallhome-ios-001`, `kids-call-home-ios`, `kch-ios-v1`
- This is for your internal tracking only

### 7. **User Access** 👥

Select: **`Full Access`** (recommended)

- **Full Access**: All team members can manage the app
- **Limited Access**: Only specific users can manage (for large teams)

### 8. **Create Button** ✅

- Once all fields are filled, the **Create** button will become active (blue)
- Click **Create**

## ⚠️ Important Notes

### Bundle ID Must Match

Your Bundle ID **must be exactly**: `com.kidscallhome.app`

- This matches your `capacitor.config.ts` file
- This matches your `codemagic.yaml` configuration
- **Do NOT change this** - it must match exactly!

### After Creating the App

Once you click **Create**, you'll be taken to the app's main page. Then:

1. **Find Your Apple ID** (numeric):

   - Click **App Information** in the left sidebar
   - Find the **Apple ID** field (numeric, like `1234567890`)
   - Copy this number

2. **Update codemagic.yaml**:

   - Open `codemagic.yaml` (project root)
   - Line 19: Replace `"1234567890"` with your actual Apple ID
   - Save and commit

3. **Complete App Store Listing**:
   - Add app description
   - Upload screenshots
   - Set pricing
   - Add privacy policy URL
   - (These can be done later)

## 📋 Quick Reference

| Field                | Value                  |
| -------------------- | ---------------------- |
| **Platforms**        | ✅ iOS                 |
| **Company Name**     | Fluid Investment Group LLC     |
| **Name**             | `Kids Call Home`       |
| **Primary Language** | `English (U.S.)`       |
| **Bundle ID**        | `com.kidscallhome.app` |
| **App ID Prefix**    | `786BYGA3LW` (Team ID) |
| **SKU**              | `kidscallhome-ios-001` |
| **User Access**      | `Full Access`          |

## 🎯 Next Steps After Creation

1. ✅ Copy the numeric Apple ID from App Information
2. ✅ Update `codemagic.yaml` line 19 with the Apple ID
3. ✅ Set up code signing certificate in Codemagic
4. ✅ Start your first build!

## ❓ Troubleshooting

### "Bundle ID not found"

- You need to register it first (click the blue link)
- Make sure it's exactly `com.kidscallhome.app`

### "Name already in use"

- Try: `Kids Call Home` or `KidsCallHome` (if available)
- App Store names must be unique

### "SKU already exists"

- Change SKU to: `kidscallhome-ios-002` or add date: `kidscallhome-ios-2024`
